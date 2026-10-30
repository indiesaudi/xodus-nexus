import { spawn, execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { profileIdOf } from '../shared/profile-id.js';
import { filterClientEnvironment, type DaemonFrame } from '../shared/daemon-protocol.js';
import { launchErrorArgument, shortcutArguments } from '../main/game-shortcuts.js';
import { DaemonConnection, daemonSocketPath } from '../main/daemon-client.js';
import { unitNames } from '../main/daemon-units.js';
import { bundledCloseHelper, keepSteamFocus } from '../main/graceful-close.js';
import { parseSteamCommand, wrapperPrefix } from '../main/steam-compat.js';

const CONNECT_WINDOW_MS = 10_000;
const REATTACH_WINDOW_MS = 60_000;
/** A launch that fails this soon after it was accepted never reached play: the player sees why. */
const STARTUP_FAILURE_MS = 60_000;
const say = (line: string) => process.stdout.write(`[nexus] ${line}\n`);
const warn = (line: string) => process.stderr.write(`[nexus] ${line}\n`);

/** The installed launcher wrapper beside this binary, or the binary itself. */
export function legacyLauncher(execPath: string): string {
  const wrapper = path.join(path.dirname(execPath), 'xodus-nexus');
  return path.basename(execPath) === 'xodus-nexus.bin' ? wrapper : execPath;
}

/** Today's in-process launch: Electron starts, prepares and runs the game itself. */
export function legacyFallback(profile: string | undefined, gameId: string, env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const launcher = legacyLauncher(process.execPath);
  const args = [...(profile ? ['--nexus-profile', profile] : []), '--launch-game', gameId];
  const { ELECTRON_RUN_AS_NODE: _node, ...rest } = env;
  return new Promise((resolve, reject) => {
    const child = spawn(launcher, args, { stdio: 'inherit', env: rest });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

/**
 * Shows why a launch was refused. Game Mode has no terminal for this client's
 * output, so the launcher opens a dialog. The launcher drops Steam's overlay,
 * which is what tells gamescope a window's app, so the dialog's window is
 * stamped like a daemon-run game's. The helper finds it by the launch id in an
 * owner's environment, which Chromium's process title rewrite hides, so a
 * plain shell stays in between as the parent that carries it. Steam keeps the
 * game "running" until the dialog closes.
 */
export async function showLaunchError(profile: string | undefined, message: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (!env.DISPLAY && !env.WAYLAND_DISPLAY) return;
  const args = [...(profile ? ['--nexus-profile', profile] : []), launchErrorArgument(message)];
  const launchId = `launch-error-${randomUUID()}`;
  const { ELECTRON_RUN_AS_NODE: _node, ...rest } = env;
  const helper = await bundledCloseHelper();
  await new Promise<void>(resolve => {
    const child = spawn('/bin/sh', ['-c', '"$@"; status=$?; exit $status', 'sh', legacyLauncher(process.execPath), ...args],
      { stdio: 'inherit', env: { ...rest, XODUS_NEXUS_LAUNCH_ID: launchId } });
    const stopFocus = keepSteamFocus(helper, launchId, env, say);
    const done = () => { stopFocus(); resolve(); };
    child.once('error', done);
    child.once('exit', done);
  });
}

async function startUnit(profileId: string, runtimeDir: string): Promise<boolean> {
  const configHome = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
  const unit = unitNames(profileId).socket;
  try { await fs.access(path.join(configHome, 'systemd', 'user', unit)); }
  catch { return false; }
  return new Promise(resolve => {
    execFile('/usr/bin/systemctl', ['--user', 'start', unit], {
      env: { PATH: '/usr/bin:/bin', XDG_RUNTIME_DIR: runtimeDir, DBUS_SESSION_BUS_ADDRESS: `unix:path=${path.join(runtimeDir, 'bus')}` }, timeout: 15_000,
    }, error => resolve(!error));
  });
}

async function connect(socketPath: string, profileId: string, runtimeDir: string): Promise<DaemonConnection | undefined> {
  const deadline = Date.now() + CONNECT_WINDOW_MS;
  let started = false;
  while (Date.now() < deadline) {
    try { return await DaemonConnection.connect(socketPath, 3_000); }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ECONNREFUSED') { warn(`Background service unavailable: ${(error as Error).message}`); return undefined; }
      if (!started) { started = true; if (!await startUnit(profileId, runtimeDir)) return undefined; }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  return undefined;
}

const TRACKED = 'XODUS_NEXUS_STEAM_TRACKED';

/** Every live descendant of `root`, deepest first, from /proc. */
export async function descendants(root: number, proc = '/proc'): Promise<number[]> {
  const parents = new Map<number, number[]>();
  for (const name of await fs.readdir(proc).catch(() => [] as string[])) {
    if (!/^\d+$/.test(name)) continue;
    const stat = await fs.readFile(path.join(proc, name, 'stat'), 'utf8').catch(() => '');
    // The parent pid is the second field after the parenthesized command name.
    const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
    if (Number.isInteger(ppid)) parents.set(ppid, [...(parents.get(ppid) ?? []), Number(name)]);
  }
  const found: number[] = [];
  const visit = (pid: number) => { for (const child of parents.get(pid) ?? []) { visit(child); found.push(child); } };
  visit(root);
  return found;
}

/**
 * Runs `words` with this process's stdio and returns its exit code. Steam may
 * stop only this process (its direct child); the signal goes to the whole
 * subtree, because wrappers such as pw-audio-namespace do not pass it on.
 */
function runUnder(words: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(words[0], words.slice(1), { stdio: 'inherit', env });
    const forward = (signal: NodeJS.Signals) => () => {
      void descendants(child.pid ?? -1).then(pids => {
        for (const pid of [...pids, child.pid ?? -1]) { try { process.kill(pid, signal); } catch { /* Already gone. */ } }
      });
    };
    const handlers = (['SIGINT', 'SIGTERM', 'SIGHUP'] as const).map(signal => [signal, forward(signal)] as const);
    for (const [signal, handler] of handlers) process.on(signal, handler);
    const done = () => { for (const [signal, handler] of handlers) process.off(signal, handler); };
    child.once('error', error => { done(); reject(error); });
    child.once('exit', (code, signal) => { done(); resolve(code ?? (signal ? 1 : 0)); });
  });
}

/**
 * Steam starts the shortcut script with `%command%` after the game id, but
 * runs only the script: its tracking (`reaper SteamLaunch AppId=…`) is in that
 * command, and Steam's Exit signals the reaper. So the first run starts this
 * client again inside the wrappers and the tracking, with Steam's original
 * LD_PRELOAD, and the second run talks to the daemon. Undefined: no re-run.
 */
export function steamLaunchPlan(steamCommand: string[] | undefined, env: NodeJS.ProcessEnv, entry: string, gameId: string):
  { words: string[]; env: NodeJS.ProcessEnv } | undefined {
  if (env[TRACKED] === '1' || !steamCommand?.length) return undefined;
  const parts = parseSteamCommand(steamCommand);
  if (!parts.tracking.length) return undefined;
  const next: NodeJS.ProcessEnv = { ...env, [TRACKED]: '1' };
  const preload = env.XODUS_NEXUS_STEAM_LD_PRELOAD ?? env.LD_PRELOAD;
  if (preload) next.LD_PRELOAD = preload; else delete next.LD_PRELOAD;
  return { words: [...wrapperPrefix(parts.wrappers), ...parts.tracking, '/bin/sh', entry, gameId, ...parts.tool], env: next };
}

export async function main(argv = process.argv.slice(2), env = process.env): Promise<number> {
  const request = shortcutArguments(argv);
  if (!request.gameId) throw new Error('A game shortcut ID is required.');
  const gameId = request.gameId;
  const userData = request.profile ?? path.join(env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'xodus-nexus');
  const plan = steamLaunchPlan(request.steamCommand, env, path.join(userData, 'shortcuts', 'launch-game'), gameId);
  if (plan) return runUnder(plan.words, plan.env);
  const profileId = profileIdOf(userData);
  const runtimeDir = env.XDG_RUNTIME_DIR;
  const connection = runtimeDir && path.isAbsolute(runtimeDir) ? await connect(daemonSocketPath(runtimeDir, profileId), profileId, runtimeDir) : undefined;
  if (!connection) {
    say('Background service not running; starting Nexus directly.');
    return legacyFallback(request.profile, gameId, env);
  }
  connection.send({ schema: 1, type: 'hello', client: 'steam', version: '1' });
  const hello = await connection.next((frame): frame is DaemonFrame & { type: 'hello' } => frame.type === 'hello', 5_000);
  say(`Connected to Nexus background service ${hello.daemonVersion}.`);
  const requestId = randomUUID();
  connection.send({ schema: 1, type: 'launch', requestId, gameId, env: filterClientEnvironment(env), cwd: process.cwd(), attach: true });
  return new Promise<number>((resolve, reject) => {
    let operationId: string | undefined;
    let acceptedAt = 0;
    let exited = false;
    let link = connection;
    const listen = (active: DaemonConnection) => { active.on('frame', onFrame); active.on('close', onClose); };
    const onFrame = (frame: DaemonFrame) => {
      switch (frame.type) {
        case 'accepted': if (frame.requestId === requestId) { operationId = frame.operationId; acceptedAt = Date.now(); say('Launch accepted.'); } break;
        case 'log': if (!operationId || frame.operationId === operationId) say(frame.line); break;
        case 'error':
          if (frame.requestId !== requestId) break;
          if (frame.code === 'wallet-locked' || frame.code === 'backend-unavailable') {
            say(`${frame.message} Starting Nexus directly.`);
            connection.close();
            legacyFallback(request.profile, gameId, env).then(resolve, reject);
          } else { warn(frame.message); exited = true; connection.close(); void showLaunchError(request.profile, frame.message, env).then(() => resolve(1)); }
          break;
        case 'exit':
          if (operationId && frame.operationId !== operationId) break;
          exited = true;
          say(frame.status === 'complete' ? 'The game has exited.' : `The game exited with an error.${frame.message ? ` ${frame.message}` : ''}`);
          link.close();
          {
            const code = frame.code ?? (frame.status === 'complete' ? 0 : 1);
            if (frame.status === 'failed' && Date.now() - acceptedAt < STARTUP_FAILURE_MS) void showLaunchError(request.profile, frame.message ?? 'The game could not be started.', env).then(() => resolve(code));
            else resolve(code);
          }
          break;
      }
    };
    const onClose = async (error: Error | undefined) => {
      if (exited) return;
      if (!operationId) {
        const message = error ? `Lost the background service: ${error.message}` : 'The background service closed the connection.';
        warn(message); void showLaunchError(request.profile, message, env).then(() => resolve(1)); return;
      }
      // The daemon went away under a running game: it restarts and re-adopts the
      // game, so keep Steam's "running" state and take the game back by its id.
      warn('Lost the background service; reconnecting to the running game.');
      const reattached = await reattach(operationId);
      if (!reattached) { warn('Could not reach the background service again; the game keeps running on its own.'); resolve(1); return; }
      link = reattached;
      listen(link);
      say('Reconnected to the background service.');
    };
    const reattach = async (id: string): Promise<DaemonConnection | undefined> => {
      const deadline = Date.now() + REATTACH_WINDOW_MS;
      while (Date.now() < deadline) {
        try {
          const next = await DaemonConnection.connect(daemonSocketPath(runtimeDir!, profileId), 3_000);
          next.send({ schema: 1, type: 'hello', client: 'steam', version: '1' });
          await next.next((frame): frame is DaemonFrame & { type: 'hello' } => frame.type === 'hello', 5_000);
          next.send({ schema: 1, type: 'attach', operationId: id });
          const answer = await next.next((frame): frame is DaemonFrame & { type: 'state' | 'error' } => frame.type === 'state' || frame.type === 'error', 5_000);
          if (answer.type === 'error') { next.close(); return undefined; }
          return next;
        } catch { await new Promise(resolve => setTimeout(resolve, 1_000)); }
      }
      return undefined;
    };
    listen(connection);
  });
}

const entry = Boolean(process.argv[1]) && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (entry) {
  main().then(code => { process.exitCode = code; }, error => { warn((error as Error).message); process.exitCode = 1; });
}
