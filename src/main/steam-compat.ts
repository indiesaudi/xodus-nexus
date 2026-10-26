import { promises as fs } from 'node:fs';
import path from 'node:path';
import { run } from './process.js';
import { detectProtonLayout, locateProtonWine, type ProtonLayout } from './proton-layout.js';
import { installRuntimeComponents, runtimeComponentChecksums, verifiedRuntimeComponents } from './proton.js';

/**
 * Running a game under the compatibility tool Steam selected for its shortcut.
 * The shortcut's launch options end in `%command%`, so the thin client receives
 * Steam's own command (reaper, Steam Linux Runtime, `proton <verb> <exe>`).
 * Nexus keeps every word up to the verb and only replaces Steam's placeholder
 * executable with the decrypted launch view's entry.
 */
export interface SteamProtonCommand {
  /** Steam's command up to and including `proton <verb>`; the game executable follows. */
  prefix: string[];
  protonRoot: string;
}

const VERBS = new Set(['waitforexitandrun', 'run']);
const MAX_WORDS = 64;

/** Steam's Proton command, or undefined for a shortcut without a compatibility tool. */
export function steamProtonCommand(words: readonly string[] | undefined): SteamProtonCommand | undefined {
  if (!words?.length) return undefined;
  if (words.length > MAX_WORDS || words.some(word => !word || /[\0\r\n]/.test(word))) throw new Error('Invalid Steam launch command.');
  for (let index = words.length - 2; index >= 0; index--) {
    const word = words[index];
    if (path.basename(word) !== 'proton' || !VERBS.has(words[index + 1])) continue;
    if (!path.isAbsolute(word)) throw new Error('Steam passed a relative Proton path.');
    return { prefix: words.slice(0, index + 2), protonRoot: path.dirname(word) };
  }
  return undefined;
}

/**
 * The overlay: the runtime's GDK and service DLLs, loaded natively in any
 * Proton. Not mscoree: loaded as native it cannot find the Proton's Mono.
 */
export const OVERLAY_COMPONENTS = ['xgameruntime.dll', 'winhttp.dll', 'libnghttp2.dll', 'windows.web.dll', 'twinapi.appcore.dll'];
const OPTIONAL_OVERLAY_COMPONENTS = ['d3dcompiler_47.dll'];
const overlayOverrides = (names: string[]) => {
  const wine = names.filter(name => name !== 'libnghttp2.dll').map(name => name.replace(/\.dll$/, ''));
  return `${wine.join(',')}=n,b;libnghttp2=n`;
};

async function ownedDirectory(directory: string, what: string): Promise<void> {
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid?.() || (stat.mode & 0o022)) {
    throw new Error(`Unsafe ${what}: ${directory}`);
  }
}

/**
 * The prefix Steam created for this shortcut. Only `steamapps/compatdata/<appid>`
 * of a Steam root is accepted, owned by this user, never through a symlink.
 */
export async function steamCompatData(env: NodeJS.ProcessEnv): Promise<{ compatData: string; prefix: string }> {
  const given = env.STEAM_COMPAT_DATA_PATH;
  if (!given || !path.isAbsolute(given)) throw new Error('Steam did not pass a compatibility data path for this game.');
  const compatData = await fs.realpath(given);
  if (!/^\d+$/.test(path.basename(compatData)) || path.basename(path.dirname(compatData)) !== 'compatdata' ||
    path.basename(path.dirname(path.dirname(compatData))) !== 'steamapps') throw new Error(`Unexpected Steam compatibility data path: ${compatData}`);
  await ownedDirectory(compatData, 'Steam compatibility data directory');
  return { compatData, prefix: path.join(compatData, 'pfx') };
}

/**
 * Whether Proton has set up (or upgraded) the prefix to its own version: it
 * writes the `CURRENT_PREFIX_VERSION` of its `proton` script (not the content
 * of its `version` file) to `compatdata/<appid>/version`.
 */
async function prefixReady(compatData: string, protonRoot: string): Promise<boolean> {
  try {
    await fs.access(path.join(compatData, 'pfx', 'drive_c', 'windows', 'system32'));
    const [prefixVersion, script] = await Promise.all([
      fs.readFile(path.join(compatData, 'version'), 'utf8'),
      fs.readFile(path.join(protonRoot, 'proton'), 'utf8'),
    ]);
    const current = script.match(/^CURRENT_PREFIX_VERSION\s*=\s*["']([^"'\n]+)["']/m)?.[1];
    return Boolean(current) && prefixVersion.trim() === current;
  } catch { return false; }
}

const BUILTIN_MARKER = Buffer.from('Wine builtin DLL');

/**
 * Wine replaces a system32 file that carries its builtin marker with the
 * Proton's own builtin of that name, so the overlay is installed without the
 * marker (after its checksum was verified) and loads as the native override.
 */
export function withoutBuiltinMarker(bytes: Buffer): Buffer {
  if (!bytes.subarray(0x40, 0x40 + BUILTIN_MARKER.length).equals(BUILTIN_MARKER)) return bytes;
  const copy = Buffer.from(bytes);
  copy.fill(0, 0x40, 0x40 + BUILTIN_MARKER.length);
  return copy;
}

/**
 * The layout Steam's Proton will really use. Its `proton` script runs the
 * arm64 loader (`files/bin-arm64`) unless `PROTON_USE_ARM64=0`, which a FEX
 * preset may set to run the x86_64 loader under FEX instead.
 */
export async function steamProtonLayout(protonRoot: string, env: NodeJS.ProcessEnv): Promise<ProtonLayout> {
  if (env.PROTON_USE_ARM64 === '0') {
    const x86 = path.join(protonRoot, 'files', 'bin', 'wine');
    if (await fs.access(x86).then(() => true, () => false)) return detectProtonLayout(x86);
  }
  return detectProtonLayout(await locateProtonWine(protonRoot));
}

const PE_MACHINES: Record<number, ProtonLayout['peArch']> = { 0x8664: 'x86_64-windows', 0xaa64: 'aarch64-windows' };

/** The PE architecture of a prepared prefix, read from its system32 kernel32 (ARM64X reports ARM64). */
export async function prefixArchitecture(prefix: string): Promise<ProtonLayout['peArch'] | undefined> {
  let handle;
  try {
    handle = await fs.open(path.join(prefix, 'drive_c', 'windows', 'system32', 'kernel32.dll'), 'r');
    const header = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead < 0x40 || header.toString('latin1', 0, 2) !== 'MZ') return undefined;
    const pe = header.readUInt32LE(0x3c);
    if (pe + 6 > bytesRead || header.toString('latin1', pe, pe + 4) !== 'PE\0\0') return undefined;
    return PE_MACHINES[header.readUInt16LE(pe + 4)];
  } catch { return undefined; }
  finally { await handle?.close().catch(() => undefined); }
}

async function requireSameArchitecture(prefix: string, layout: ProtonLayout): Promise<void> {
  const existing = await prefixArchitecture(prefix);
  // Never rebuild or mix a prefix: it holds the game's local saves.
  if (existing && existing !== layout.peArch) {
    throw new Error(`This game's Steam prefix was set up for ${existing}, but the selected Proton runs ${layout.peArch}. Switch back to a ${existing} Proton in Steam, or back up and delete ${path.dirname(prefix)} so Proton creates a new prefix.`);
  }
}

/**
 * The Nexus runtime release whose components match `peArch`: the active one
 * first, then any other installed release beside it (x86_64 and aarch64
 * runtimes can be installed together).
 */
export async function overlayRuntime(activeProtonRoot: string, peArch: ProtonLayout['peArch']): Promise<{ root: string; checksums: Record<string, string> } | undefined> {
  const releases = path.dirname(activeProtonRoot);
  const siblings = await fs.readdir(releases, { withFileTypes: true }).catch(() => []);
  const candidates = [activeProtonRoot, ...siblings.filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => path.join(releases, entry.name)).filter(root => root !== activeProtonRoot).sort().reverse()];
  for (const root of candidates) {
    try {
      const stat = await fs.lstat(root);
      if (!stat.isDirectory() || stat.uid !== process.getuid?.() || (stat.mode & 0o022)) continue;
      const checksums = await runtimeComponentChecksums(root, peArch);
      if (checksums && OVERLAY_COMPONENTS.every(name => checksums[name])) return { root, checksums };
    } catch { /* Not a usable runtime release. */ }
  }
  return undefined;
}

export interface SteamOverlay {
  layout: ProtonLayout;
  /** Environment for the game: native overrides for the overlay DLLs. */
  environment: Record<string, string>;
}

/**
 * Prepares Steam's prefix for a Nexus game. Proton sets up or upgrades a prefix
 * when it runs, replacing system32 DLLs, so a fresh or outdated prefix is first
 * brought up with a no-op command; the checked overlay is written afterwards
 * and again before every launch.
 */
export async function prepareSteamOverlay(command: SteamProtonCommand, nexusProtonRoot: string,
  env: NodeJS.ProcessEnv, onLine: (line: string) => void): Promise<SteamOverlay> {
  const { compatData, prefix } = await steamCompatData(env);
  const layout = await steamProtonLayout(command.protonRoot, env);
  const runtime = await overlayRuntime(nexusProtonRoot, layout.peArch);
  if (!runtime) throw new Error(`No installed Nexus runtime has ${layout.peArch} components for this Proton. Install the Nexus runtime for that architecture or clear the compatibility tool in Steam.`);
  if (runtime.root !== nexusProtonRoot) onLine(`Using the ${layout.peArch} components of the installed Nexus runtime ${path.basename(runtime.root)}.`);
  // Validate before Proton or Nexus changes anything in the prefix. The
  // ARM64X d3dcompiler_47 carries the shader fix on arm64; take it when present.
  const names = [...OVERLAY_COMPONENTS, ...OPTIONAL_OVERLAY_COMPONENTS.filter(name => runtime.checksums[name])];
  const components = await verifiedRuntimeComponents(runtime.root, layout.peArch, runtime.checksums, names);
  await requireSameArchitecture(prefix, layout);
  if (!await prefixReady(compatData, command.protonRoot)) {
    onLine('Preparing the Steam Proton prefix for this game…');
    const result = await run(command.prefix[0], [...command.prefix.slice(1), 'C:\\windows\\system32\\cmd.exe', '/c', 'exit'], { env, maxOutput: 1_000_000 });
    if (!await prefixReady(compatData, command.protonRoot)) {
      const detail = result.output.split('\n').map(line => line.trim()).filter(Boolean).slice(-3).join(' | ');
      throw new Error(`Steam's Proton did not prepare its prefix (code ${result.code})${detail ? `: ${detail}` : ''}`);
    }
  }
  await requireSameArchitecture(prefix, layout);
  for (const directory of [prefix, path.join(prefix, 'drive_c'), path.join(prefix, 'drive_c', 'windows'), path.join(prefix, 'drive_c', 'windows', 'system32')]) {
    await ownedDirectory(directory, 'Steam prefix directory');
  }
  await installRuntimeComponents(prefix, components.map(({ name, bytes }) => ({ name, bytes: withoutBuiltinMarker(bytes) })));
  onLine(`Applied the Nexus runtime overlay (${layout.peArch}) to the Steam prefix ${prefix}.`);
  const overrides = [env.WINEDLLOVERRIDES, overlayOverrides(names)].filter(Boolean).join(';');
  return { layout, environment: { WINEDLLOVERRIDES: overrides } };
}

/**
 * The private directory that holds the decrypted launch view: under the user's
 * runtime directory (tmpfs, cleared at logout and reboot), mode 0700, shared
 * into the Steam Linux Runtime container through STEAM_COMPAT_MOUNTS.
 */
export async function launchViewDirectory(env: NodeJS.ProcessEnv, profileId: string): Promise<string> {
  const runtime = env.XDG_RUNTIME_DIR;
  if (!runtime || !path.isAbsolute(runtime)) throw new Error('XDG_RUNTIME_DIR is not set; Steam Proton launches need a private runtime directory.');
  await ownedDirectory(runtime, 'runtime directory');
  let directory = runtime;
  for (const segment of ['xodus-nexus', 'views', profileId]) {
    directory = path.join(directory, segment);
    await fs.mkdir(directory, { mode: 0o700 }).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; });
    await ownedDirectory(directory, 'launch view directory');
    await fs.chmod(directory, 0o700);
  }
  // A force-stopped backend (SIGTERM/SIGKILL) cannot remove its view. One
  // game runs per profile, so views left here are stale before a launch.
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('.xodus-chain-')) continue;
    await fs.rm(path.join(directory, entry.name), { recursive: true, force: true });
  }
  return directory;
}

const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

/** The "wine" the backend runs: Steam's command with the launch view's entry appended. */
export async function writeSteamLauncher(directory: string, command: SteamProtonCommand): Promise<string> {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await ownedDirectory(directory, 'launch wrapper directory');
  const file = path.join(directory, 'steam-proton');
  const temporary = `${file}.tmp-${process.pid}`;
  await fs.writeFile(temporary, `#!/bin/sh\nexec ${command.prefix.map(shellQuote).join(' ')} "$@"\n`, { mode: 0o700, flag: 'w' });
  await fs.rename(temporary, file);
  return file;
}

/** Shares the game folder and the launch view with the Steam Linux Runtime container. */
export function steamCompatMounts(env: NodeJS.ProcessEnv, paths: string[]): string {
  return [env.STEAM_COMPAT_MOUNTS, ...paths].filter(Boolean).join(':');
}
