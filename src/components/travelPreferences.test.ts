import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_TRAVEL_PREFERENCES, readTravelPreferences, saveTravelPreferences } from "./travelPreferences";
afterEach(() => vi.unstubAllGlobals());
it("defaults safely, rejects non-booleans, and retains each travel preference", () => {
  let record = '{"autoPause":false,"highContrast":"yes","atmosphere":false,"screenShake":0}';
  vi.stubGlobal("localStorage", { getItem: () => record, setItem: (_: string, value: string) => { record = value; } });
  expect(readTravelPreferences()).toEqual({ autoPause: false, highContrast: false, atmosphere: false, screenShake: true });
  const settings = { autoPause: true, highContrast: true, atmosphere: false, screenShake: false };
  expect(saveTravelPreferences(settings)).toBe(true);
  expect(readTravelPreferences()).toEqual(settings);
  record = "null"; expect(readTravelPreferences()).toEqual(DEFAULT_TRAVEL_PREFERENCES);
  record = "broken"; expect(readTravelPreferences()).toEqual(DEFAULT_TRAVEL_PREFERENCES);
});
it("applies defaults and reports storage denial", () => {
  vi.stubGlobal("localStorage", { getItem: () => { throw Error("denied"); }, setItem: () => { throw Error("denied"); } });
  expect(readTravelPreferences()).toEqual(DEFAULT_TRAVEL_PREFERENCES);
  expect(saveTravelPreferences(DEFAULT_TRAVEL_PREFERENCES)).toBe(false);
});
