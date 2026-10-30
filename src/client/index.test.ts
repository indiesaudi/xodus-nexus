import { describe, expect, it } from 'vitest';
import { showLaunchError, steamLaunchPlan } from './index.js';

describe('thin client launch errors', () => {
  it('opens no dialog without a display, so headless runs only print the error', async () => {
    const started = Date.now();
    await showLaunchError(undefined, 'refused', { PATH: process.env.PATH });
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});

describe('thin client Steam tracking', () => {
  const steam = ['/usr/libexec/armada/armada-game-launch', '/s/steam-launch-wrapper', '--oom-score-adjust', '900', '--',
    '/s/reaper', 'SteamLaunch', 'AppId=1', '--', '/s/_v2-entry-point', '--verb=waitforexitandrun', '--', '/c/xodus-nexus/proton', 'waitforexitandrun', '/bin/sh'];

  it('runs the client again inside the wrappers and the reaper, with the original LD_PRELOAD', () => {
    const plan = steamLaunchPlan(steam, { LD_PRELOAD: '', XODUS_NEXUS_STEAM_LD_PRELOAD: '/o.so' }, '/p/launch-game', 'abc');
    expect(plan?.words).toEqual(['/usr/libexec/armada/armada-game-launch', '/s/steam-launch-wrapper', '--oom-score-adjust', '900', '--',
      '/s/reaper', 'SteamLaunch', 'AppId=1', '--', '/bin/sh', '/p/launch-game', 'abc', '/s/_v2-entry-point', '--verb=waitforexitandrun', '--', '/c/xodus-nexus/proton', 'waitforexitandrun']);
    expect(plan?.env).toMatchObject({ XODUS_NEXUS_STEAM_TRACKED: '1', LD_PRELOAD: '/o.so' });
  });

  it('does not run again inside the tracking, or without it', () => {
    expect(steamLaunchPlan(steam, { XODUS_NEXUS_STEAM_TRACKED: '1' }, '/p/launch-game', 'abc')).toBeUndefined();
    expect(steamLaunchPlan(['/usr/libexec/armada/armada-game-launch', '/bin/sh'], {}, '/p/launch-game', 'abc')).toBeUndefined();
    expect(steamLaunchPlan(undefined, {}, '/p/launch-game', 'abc')).toBeUndefined();
  });
});
