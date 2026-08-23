import { DEFAULT_SETTINGS } from '../constants';
import type { UserSettings } from '../types/bookmark';

const SETTINGS_KEY = 'userSettings';

export async function loadSettings(): Promise<UserSettings> {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...(stored[SETTINGS_KEY] as Partial<UserSettings> | undefined),
  };
}

export async function saveSettings(
  changes: Partial<UserSettings>,
): Promise<UserSettings> {
  const next = { ...(await loadSettings()), ...changes };
  await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
  return next;
}

