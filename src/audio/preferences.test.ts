import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SOUND_PREFERENCES, normalizeSoundPreferences, readSoundPreferences, saveSoundPreferences, SOUND_PREFERENCES_KEY } from "./preferences";

afterEach(() => vi.unstubAllGlobals());

describe("sound preferences", () => {
  it("saves mute and volume in a separate record without touching game saves", () => {
    const records = new Map([["eldrinth.save", "precious progress"]]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => records.set(key, value),
    });
    expect(readSoundPreferences()).toEqual(DEFAULT_SOUND_PREFERENCES);
    expect(saveSoundPreferences({ muted: true, volume: 0.7 })).toBe(true);
    expect(readSoundPreferences()).toEqual({ muted: true, volume: 0.7 });
    expect(records.get(SOUND_PREFERENCES_KEY)).toBe('{"muted":true,"volume":0.7}');
    expect(records.get("eldrinth.save")).toBe("precious progress");
  });

  it("constrains malformed settings to finite, quiet defaults", () => {
    expect(normalizeSoundPreferences(null)).toEqual(DEFAULT_SOUND_PREFERENCES);
    expect(normalizeSoundPreferences({ muted: "true", volume: Infinity })).toEqual(DEFAULT_SOUND_PREFERENCES);
    expect(normalizeSoundPreferences({ volume: -10 })).toEqual({ muted: false, volume: 0 });
    expect(normalizeSoundPreferences({ volume: 20 })).toEqual({ muted: false, volume: 1 });
    vi.stubGlobal("localStorage", { getItem: () => "broken" });
    expect(readSoundPreferences()).toEqual(DEFAULT_SOUND_PREFERENCES);
  });

  it("remains usable when storage is absent or denied", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("Denied"); },
      setItem: () => { throw new Error("Denied"); },
    });
    expect(readSoundPreferences()).toEqual(DEFAULT_SOUND_PREFERENCES);
    expect(saveSoundPreferences({ muted: true, volume: 0.2 })).toBe(false);
  });
});
