// Account-scoped localStorage helpers to isolate folders, backup logs, phase patterns,
// and UI workspace state between different Google accounts on the same browser.

let currentStorageUid: string | null = (() => {
  try {
    return localStorage.getItem('navfor_last_uid') || null;
  } catch {
    return null;
  }
})();

export function getActiveStorageUid(): string | null {
  return currentStorageUid;
}

export function setActiveStorageUid(uid: string | null): void {
  currentStorageUid = uid;
}

export function userScopedKey(baseKey: string, uid: string | null = currentStorageUid): string {
  const scope = uid || '__anon__';
  return `navfor_u:${scope}:${baseKey}`;
}

export function getUserStorageItem(baseKey: string, uid?: string | null): string | null {
  try {
    return localStorage.getItem(userScopedKey(baseKey, uid));
  } catch {
    return null;
  }
}

export function setUserStorageItem(baseKey: string, value: string, uid?: string | null): void {
  try {
    localStorage.setItem(userScopedKey(baseKey, uid), value);
  } catch {}
}

export function removeUserStorageItem(baseKey: string, uid?: string | null): void {
  try {
    localStorage.removeItem(userScopedKey(baseKey, uid));
  } catch {}
}

export function getUserStorageBaseKeysWithPrefix(prefix: string, uid?: string | null): string[] {
  const scopePrefix = userScopedKey('', uid);
  const fullPrefix = `${scopePrefix}${prefix}`;
  const matched: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(fullPrefix)) {
        matched.push(k.slice(scopePrefix.length));
      }
    }
  } catch {}
  return matched;
}

const LEGACY_EXACT_KEYS = [
  'navfor_local_backup_slots',
  'navfor_local_backup_active_date',
  'navfor_local_backup_active_slot',
  'navfor_local_backup_next_slot',
  'trifocus_last_backup',
  'navfor_local_backup_csv_1',
  'navfor_local_backup_csv_2',
  'navfor_local_backup_csv_3',
  'navfor_pc_local_path',
  'navfor_folder_metas_by_section',
  'navfor_folder_metas',
];

const LEGACY_PREFIXES = [
  'navfor_folders_',
  'navfor_collapsed_',
  'navfor_open_tabs_',
  'navfor_active_tab_',
  'navfor_editor_panes_',
  'navfor_phase_patterns_',
  'navfor_active_phase_pattern_',
  'navfor_custom_timeline_cols_',
  'navfor_timeline_time_filter_',
];

/**
 * Removes legacy unscoped account-specific keys from localStorage so switching accounts
 * or reloading after an account switch never leaks another user's folders or backup logs.
 */
export function purgeUnscopedLegacyAccountData(): void {
  try {
    LEGACY_EXACT_KEYS.forEach((k) => localStorage.removeItem(k));
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k.startsWith('navfor_u:')) continue;
      if (LEGACY_PREFIXES.some((p) => k.startsWith(p))) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}
