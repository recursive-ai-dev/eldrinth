export interface SoundPreferences {
  muted: boolean;
  volume: number;
}

export const SOUND_PREFERENCES_KEY = "eldrinth.sound.v1";
export const DEFAULT_SOUND_PREFERENCES: SoundPreferences = { muted: false, volume: 0.45 };

export function normalizeSoundPreferences(value: unknown): SoundPreferences {
  const saved = value as Partial<SoundPreferences> | null;
  return {
    muted: saved?.muted === true,
    volume: typeof saved?.volume === "number" && Number.isFinite(saved.volume)
      ? Math.max(0, Math.min(1, saved.volume)) : DEFAULT_SOUND_PREFERENCES.volume,
  };
}

export function readSoundPreferences(): SoundPreferences {
  try { return normalizeSoundPreferences(JSON.parse(localStorage.getItem(SOUND_PREFERENCES_KEY) ?? "null")); }
  catch { return { ...DEFAULT_SOUND_PREFERENCES }; }
}

export function saveSoundPreferences(preferences: SoundPreferences): boolean {
  try { localStorage.setItem(SOUND_PREFERENCES_KEY, JSON.stringify(normalizeSoundPreferences(preferences))); return true; }
  catch { return false; }
}
