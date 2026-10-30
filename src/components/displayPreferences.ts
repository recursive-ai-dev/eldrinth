export interface DisplayPreferences {
  largeText: boolean;
  quietInterface: boolean;
  cameraZoom: number;
}

const KEY = "eldrinth.display.v1";

export function readDisplayPreferences(): DisplayPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Record<string, unknown> | null;
    const zoom = typeof saved?.cameraZoom === "number" && Number.isFinite(saved.cameraZoom) ? saved.cameraZoom : 1.5;
    return {
      largeText: saved?.largeText === true,
      quietInterface: saved?.quietInterface === true,
      cameraZoom: Math.round(Math.max(1, Math.min(2, zoom)) * 4) / 4,
    };
  } catch {
    return { largeText: false, quietInterface: false, cameraZoom: 1.5 };
  }
}

export function saveDisplayPreferences(preferences: DisplayPreferences): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(preferences)); return true; }
  catch { return false; }
}
