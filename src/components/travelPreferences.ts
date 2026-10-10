export interface TravelPreferences {
  autoPause: boolean;
  highContrast: boolean;
  atmosphere: boolean;
  screenShake: boolean;
}
export const DEFAULT_TRAVEL_PREFERENCES: TravelPreferences = { autoPause: true, highContrast: false, atmosphere: true, screenShake: true };
const KEY = "eldrinth.travel.v1";
export function readTravelPreferences(): TravelPreferences {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    const result = { ...DEFAULT_TRAVEL_PREFERENCES };
    if (saved && typeof saved === "object") {
      for (const key of Object.keys(result) as (keyof TravelPreferences)[]) {
        const value = (saved as Record<string, unknown>)[key];
        if (typeof value === "boolean") result[key] = value;
      }
    }
    return result;
  } catch { return { ...DEFAULT_TRAVEL_PREFERENCES }; }
}
export function saveTravelPreferences(value: TravelPreferences): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(value)); return true; }
  catch { return false; }
}
