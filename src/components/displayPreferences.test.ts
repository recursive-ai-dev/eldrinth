import { afterEach, describe, expect, it, vi } from "vitest";
import { readDisplayPreferences, saveDisplayPreferences } from "./displayPreferences";

afterEach(() => vi.unstubAllGlobals());

function storage(initial: string | null = null) {
  let saved = initial;
  vi.stubGlobal("localStorage", {
    getItem: () => saved,
    setItem: (_key: string, value: string) => { saved = value; },
  });
}

describe("saved display preferences", () => {
  it("restores a player's camera and reading choices on the next read", () => {
    storage();
    const preference = { cameraZoom: 1.75, largeText: true, quietInterface: true };
    expect(saveDisplayPreferences(preference)).toBe(true);
    expect(readDisplayPreferences()).toEqual(preference);
  });

  it("keeps older reading preferences while adopting the closer camera default", () => {
    storage(JSON.stringify({ largeText: true, quietInterface: false }));
    expect(readDisplayPreferences()).toEqual({ cameraZoom: 1.5, largeText: true, quietInterface: false });
  });

  it("recovers malformed records and constrains an out-of-range camera before the slider reads it", () => {
    storage("broken record");
    expect(readDisplayPreferences().cameraZoom).toBe(1.5);
    storage(JSON.stringify({ cameraZoom: 20, largeText: "false", quietInterface: 1 }));
    expect(readDisplayPreferences()).toEqual({ cameraZoom: 2, largeText: false, quietInterface: false });
    storage(JSON.stringify({ cameraZoom: -100 }));
    expect(readDisplayPreferences().cameraZoom).toBe(1);
    storage(JSON.stringify({ cameraZoom: 1.62 }));
    expect(readDisplayPreferences().cameraZoom).toBe(1.5);
  });

  it("falls back safely and reports that preferences were not saved when storage is denied", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("Storage access denied"); },
      setItem: () => { throw new Error("Storage access denied"); },
    });
    const preference = { cameraZoom: 2, largeText: true, quietInterface: true };
    expect(readDisplayPreferences()).toEqual({ cameraZoom: 1.5, largeText: false, quietInterface: false });
    expect(saveDisplayPreferences(preference)).toBe(false);
  });
});
