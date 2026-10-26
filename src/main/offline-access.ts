import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { OfflinePermissions } from '../shared/types.js';
import { accountCacheKey, removeOfflineIdentityCaches } from './offline-identity.js';

/**
 * Offline play on this device is bounded by what Microsoft last said: the
 * stored licenses (backend `run --license-cache`) and the runtime's offline
 * identities exist only while this device is the account's designated offline
 * PC and only for the account that stored them. Every known change of either
 * removes all of them; Microsoft's own lease restrictions are validated again
 * by the backend each time a stored license is loaded.
 */

/** Where `xodus-cli run --license-cache` keeps device-bound offline licenses. */
export function licenseCacheDirectory(dataRoot: string): string {
  return path.join(dataRoot, 'license-cache');
}

/** The opaque key of the account the stored offline data belongs to. */
function ownerFile(dataRoot: string): string {
  return path.join(dataRoot, 'offline-owner');
}

export type OfflineRevocation = 'sign-out' | 'account-changed' | 'designation-off' | 'designation-changed';

/** Removes every stored offline license and offline identity under `dataRoot`. */
export async function revokeOfflineAccess(dataRoot: string): Promise<void> {
  await fs.rm(licenseCacheDirectory(dataRoot), { recursive: true, force: true }).catch(() => undefined);
  await removeOfflineIdentityCaches(dataRoot).catch(() => 0);
  await fs.rm(ownerFile(dataRoot), { force: true }).catch(() => undefined);
}

/**
 * Binds stored offline data to the signed-in account before a launch. Data
 * another account left behind (a sign-in outside the launcher, or a sign-out
 * whose cleanup failed) is removed first. Returns whether anything was revoked.
 */
export async function bindOfflineAccess(dataRoot: string, username: string): Promise<boolean> {
  const key = accountCacheKey(username);
  let owner: string | undefined;
  try { owner = (await fs.readFile(ownerFile(dataRoot), 'utf8')).trim(); } catch { /* no offline data recorded yet */ }
  const changed = owner !== undefined && owner !== key;
  if (changed) await revokeOfflineAccess(dataRoot);
  if (owner !== key) {
    await fs.mkdir(dataRoot, { recursive: true });
    await fs.writeFile(ownerFile(dataRoot), `${key}\n`, { mode: 0o600 });
  }
  return changed;
}

/** A designation status Microsoft reported: anything but "on" ends offline play here. */
export async function applyOfflinePermissions(dataRoot: string, status: Pick<OfflinePermissions, 'enabled'>): Promise<boolean> {
  if (status.enabled) return false;
  await revokeOfflineAccess(dataRoot);
  return true;
}
