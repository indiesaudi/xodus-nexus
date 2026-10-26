import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { launchViewDirectory, OVERLAY_COMPONENTS, overlayRuntime, prefixArchitecture, prepareSteamOverlay, steamCompatData, steamCompatMounts, steamProtonCommand, steamProtonLayout, writeSteamLauncher } from './steam-compat.js';
import { splitSteamCommand } from '../client/index.js';

const linux = process.platform === 'linux';
const proton = '/home/deck/.steam/root/compatibilitytools.d/GE-Proton10/proton';
const chain = ['/steam/reaper', 'SteamLaunch', 'AppId=3000000000', '--', '/steam/SteamLinuxRuntime_sniper/_v2-entry-point', '--verb=waitforexitandrun', '--', proton, 'waitforexitandrun', '/bin/sh'];

describe('Steam launch command', () => {
  it('keeps Steam\'s command up to the Proton verb and drops the placeholder executable', () => {
    expect(steamProtonCommand(chain)).toEqual({ prefix: chain.slice(0, -1), protonRoot: path.dirname(proton) });
  });
  it('treats a shortcut without a compatibility tool as a Nexus runtime launch', () => {
    expect(steamProtonCommand(undefined)).toBeUndefined();
    expect(steamProtonCommand(['/bin/sh'])).toBeUndefined();
    expect(steamProtonCommand(['/steam/reaper', 'SteamLaunch', 'AppId=1', '--', '/bin/sh'])).toBeUndefined();
    expect(steamProtonCommand(['/opt/proton', 'unknownverb', '/bin/sh'])).toBeUndefined();
  });
  it('rejects relative Proton paths, control characters and oversized commands', () => {
    expect(() => steamProtonCommand(['proton', 'waitforexitandrun', '/bin/sh'])).toThrow('relative');
    expect(() => steamProtonCommand([proton, 'waitforexitandrun', 'a\nb'])).toThrow();
    expect(() => steamProtonCommand(Array(65).fill('x'))).toThrow();
  });
  it('splits the shortcut arguments from Steam\'s command', () => {
    const own = ['--nexus-profile', '/p', '--launch-game', '0123456789abcdef'];
    expect(splitSteamCommand(own)).toEqual({ own });
    expect(splitSteamCommand([...own, ...chain])).toEqual({ own, steamCommand: chain });
  });
  it('adds mounts after any Steam already set', () => {
    expect(steamCompatMounts({}, ['/games/a', '/run/user/1000/v'])).toBe('/games/a:/run/user/1000/v');
    expect(steamCompatMounts({ STEAM_COMPAT_MOUNTS: '/mnt/x' }, ['/games/a'])).toBe('/mnt/x:/games/a');
  });
});

describe.skipIf(!linux)('Steam prefix and overlay', () => {
  let root: string;
  beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-steam-compat-')); });
  afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

  async function compatData(appid = '3000000000') {
    const directory = path.join(root, 'Steam/steamapps/compatdata', appid);
    await fs.mkdir(path.join(directory, 'pfx/drive_c/windows/system32'), { recursive: true, mode: 0o755 });
    return directory;
  }

  async function runtime(peArch = 'x86_64-windows', corrupt?: string) {
    const nexus = path.join(root, 'nexus-runtime');
    const directory = path.join(nexus, 'files/lib/wine', peArch);
    await fs.mkdir(directory, { recursive: true });
    const components: Record<string, string> = {};
    for (const name of OVERLAY_COMPONENTS) {
      const bytes = Buffer.from(`component ${name}`);
      await fs.writeFile(path.join(directory, name), name === corrupt ? Buffer.from('tampered') : bytes);
      components[name] = createHash('sha256').update(bytes).digest('hex');
    }
    await fs.writeFile(path.join(nexus, 'XODUS_NEXUS_PATCH.json'), JSON.stringify({ componentsByArch: { [peArch]: components } }));
    return nexus;
  }

  async function steamProton(compat: string, script = 'exit 0') {
    const protonRoot = path.join(root, 'GE-Proton');
    await fs.mkdir(path.join(protonRoot, 'files/bin'), { recursive: true });
    await fs.writeFile(path.join(protonRoot, 'files/bin/wine'), Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, ...Array(10).fill(0), 0x3e, 0]));
    await fs.writeFile(path.join(protonRoot, 'version'), '1 GE-Proton10\n');
    await fs.writeFile(path.join(protonRoot, 'proton'), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
    await fs.writeFile(path.join(compat, 'version'), '1 GE-Proton10\n');
    return { prefix: [path.join(protonRoot, 'proton'), 'waitforexitandrun'], protonRoot };
  }

  it('accepts only a steamapps/compatdata/<appid> directory of this user', async () => {
    const compat = await compatData();
    expect(await steamCompatData({ STEAM_COMPAT_DATA_PATH: compat })).toEqual({ compatData: compat, prefix: path.join(compat, 'pfx') });
    await expect(steamCompatData({})).rejects.toThrow('compatibility data path');
    await expect(steamCompatData({ STEAM_COMPAT_DATA_PATH: path.join(root, 'Steam') })).rejects.toThrow('Unexpected');
    await fs.chmod(compat, 0o777);
    await expect(steamCompatData({ STEAM_COMPAT_DATA_PATH: compat })).rejects.toThrow('Unsafe');
  });

  it('writes the checked overlay into system32 and sets native overrides', async () => {
    const compat = await compatData();
    const command = await steamProton(compat);
    const lines: string[] = [];
    const overlay = await prepareSteamOverlay(command, await runtime(), { STEAM_COMPAT_DATA_PATH: compat, WINEDLLOVERRIDES: 'dinput8=n,b' }, line => lines.push(line));
    for (const name of OVERLAY_COMPONENTS) expect(await fs.readFile(path.join(compat, 'pfx/drive_c/windows/system32', name), 'utf8')).toBe(`component ${name}`);
    expect(overlay.layout.peArch).toBe('x86_64-windows');
    expect(overlay.environment.WINEDLLOVERRIDES).toMatch(/^dinput8=n,b;xgameruntime,.*=n,b;libnghttp2=n$/);
    expect(lines.join('\n')).toContain('Applied the Nexus runtime overlay');
  });

  it('changes nothing when a component checksum or the architecture does not match', async () => {
    const compat = await compatData();
    const command = await steamProton(compat);
    const env = { STEAM_COMPAT_DATA_PATH: compat };
    await expect(prepareSteamOverlay(command, await runtime('x86_64-windows', 'winhttp.dll'), env, () => {})).rejects.toThrow('winhttp.dll checksum');
    await fs.rm(path.join(root, 'nexus-runtime'), { recursive: true });
    await expect(prepareSteamOverlay(command, await runtime('aarch64-windows'), env, () => {})).rejects.toThrow('x86_64-windows components');
    expect(await fs.readdir(path.join(compat, 'pfx/drive_c/windows/system32'))).toEqual([]);
  });

  async function pe(file: string, machine: number) {
    const image = Buffer.alloc(0x100);
    image.write('MZ', 0, 'latin1');
    image.writeUInt32LE(0x80, 0x3c);
    image.write('PE\0\0', 0x80, 'latin1');
    image.writeUInt16LE(machine, 0x84);
    await fs.writeFile(file, image);
  }

  it('follows PROTON_USE_ARM64=0 to the x86_64 loader of an arm64 Proton', async () => {
    const protonRoot = path.join(root, 'cachyos');
    const arm = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, ...Array(10).fill(0), 0xb7, 0]);
    const x86 = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, ...Array(10).fill(0), 0x3e, 0]);
    await fs.mkdir(path.join(protonRoot, 'files/bin-arm64'), { recursive: true });
    await fs.mkdir(path.join(protonRoot, 'files/bin'), { recursive: true });
    await fs.writeFile(path.join(protonRoot, 'files/bin-arm64/wine'), arm);
    await fs.writeFile(path.join(protonRoot, 'files/bin/wine'), x86);
    expect((await steamProtonLayout(protonRoot, { PROTON_USE_ARM64: '0' })).peArch).toBe('x86_64-windows');
    // Without an x86_64 loader the arm64 one runs regardless.
    await fs.rm(path.join(protonRoot, 'files/bin'), { recursive: true });
    if (process.arch === 'arm64') expect((await steamProtonLayout(protonRoot, { PROTON_USE_ARM64: '0' })).peArch).toBe('aarch64-windows');
  });

  it('reads a prefix architecture from its kernel32 and refuses to mix architectures', async () => {
    const compat = await compatData();
    const command = await steamProton(compat);
    const kernel32 = path.join(compat, 'pfx/drive_c/windows/system32/kernel32.dll');
    await pe(kernel32, 0xaa64);
    expect(await prefixArchitecture(path.join(compat, 'pfx'))).toBe('aarch64-windows');
    await expect(prepareSteamOverlay(command, await runtime(), { STEAM_COMPAT_DATA_PATH: compat }, () => {})).rejects.toThrow('set up for aarch64-windows');
    expect((await fs.readdir(path.dirname(kernel32))).sort()).toEqual(['kernel32.dll']);
    await pe(kernel32, 0x8664);
    expect(await prefixArchitecture(path.join(compat, 'pfx'))).toBe('x86_64-windows');
    await prepareSteamOverlay(command, await runtime(), { STEAM_COMPAT_DATA_PATH: compat }, () => {});
  });

  it('takes the components from another installed runtime of the right architecture', async () => {
    const compat = await compatData();
    const command = await steamProton(compat);
    const releases = path.join(root, 'releases');
    await fs.mkdir(releases);
    const x86 = await runtime();
    await fs.rename(x86, path.join(releases, 'runtime-x86_64'));
    await runtime('aarch64-windows');
    await fs.rename(path.join(root, 'nexus-runtime'), path.join(releases, 'runtime-aarch64'));
    expect((await overlayRuntime(path.join(releases, 'runtime-aarch64'), 'x86_64-windows'))?.root).toBe(path.join(releases, 'runtime-x86_64'));
    const lines: string[] = [];
    await prepareSteamOverlay(command, path.join(releases, 'runtime-aarch64'), { STEAM_COMPAT_DATA_PATH: compat }, line => lines.push(line));
    expect(lines.join('\n')).toContain('runtime-x86_64');
    expect(await overlayRuntime(path.join(releases, 'runtime-x86_64'), 'aarch64-windows')).toMatchObject({ root: path.join(releases, 'runtime-aarch64') });
  });

  it('adds d3dcompiler_47 when the runtime carries it', async () => {
    const compat = await compatData();
    const command = await steamProton(compat);
    const nexus = await runtime();
    const bytes = Buffer.from('arm64x d3dcompiler');
    await fs.writeFile(path.join(nexus, 'files/lib/wine/x86_64-windows/d3dcompiler_47.dll'), bytes);
    const metadata = JSON.parse(await fs.readFile(path.join(nexus, 'XODUS_NEXUS_PATCH.json'), 'utf8'));
    metadata.componentsByArch['x86_64-windows']['d3dcompiler_47.dll'] = createHash('sha256').update(bytes).digest('hex');
    await fs.writeFile(path.join(nexus, 'XODUS_NEXUS_PATCH.json'), JSON.stringify(metadata));
    const overlay = await prepareSteamOverlay(command, nexus, { STEAM_COMPAT_DATA_PATH: compat }, () => {});
    expect(await fs.readFile(path.join(compat, 'pfx/drive_c/windows/system32/d3dcompiler_47.dll'), 'utf8')).toBe('arm64x d3dcompiler');
    expect(overlay.environment.WINEDLLOVERRIDES).toContain(',d3dcompiler_47=n,b');
  });

  it('refuses a symlinked system32 in the Steam prefix', async () => {
    const compat = await compatData();
    const command = await steamProton(compat);
    const elsewhere = path.join(root, 'elsewhere');
    await fs.mkdir(elsewhere);
    await fs.rm(path.join(compat, 'pfx/drive_c/windows/system32'), { recursive: true });
    await fs.symlink(elsewhere, path.join(compat, 'pfx/drive_c/windows/system32'));
    await expect(prepareSteamOverlay(command, await runtime(), { STEAM_COMPAT_DATA_PATH: compat }, () => {})).rejects.toThrow();
    expect(await fs.readdir(elsewhere)).toEqual([]);
  });

  it('creates an owner-only launch view directory under the runtime directory', async () => {
    const runtimeDir = path.join(root, 'run');
    await fs.mkdir(runtimeDir, { mode: 0o700 });
    const directory = await launchViewDirectory({ XDG_RUNTIME_DIR: runtimeDir }, 'abc123def456');
    expect(directory).toBe(path.join(runtimeDir, 'xodus-nexus/views/abc123def456'));
    expect((await fs.stat(directory)).mode & 0o777).toBe(0o700);
    await expect(launchViewDirectory({}, 'abc123def456')).rejects.toThrow('XDG_RUNTIME_DIR');
  });

  it('writes a launcher that runs Steam\'s command with the view entry appended', async () => {
    const file = await writeSteamLauncher(path.join(root, 'wrappers'), { prefix: ['/steam/proton', 'waitforexitandrun', "it's"], protonRoot: '/steam' });
    expect(await fs.readFile(file, 'utf8')).toBe(`#!/bin/sh\nexec '/steam/proton' 'waitforexitandrun' 'it'"'"'s' "$@"\n`);
    expect((await fs.stat(file)).mode & 0o777).toBe(0o700);
  });
});
