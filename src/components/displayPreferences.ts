export interface DisplayPreferences {
  largeText: boolean;
  quietInterface: boolean;
  cameraZoom: number;
}

const KEY = "eldrinth.display.v1";

export function readDisplayPreferences(): DisplayPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return {
      largeText: saved?.largeText === true,
      quietInterface: saved?.quietInterface === true,
      cameraZoom: typeof saved?.cameraZoom === "number" && Number.isFinite(saved.cameraZoom) ? Math.round(Math.max(1, Math.min(2, saved.cameraZoom)) * 4) / 4 : 1.5,
    };
  } catch {
    return { largeText: false, quietInterface: false, cameraZoom: 1.5 };
  }
}

export function saveDisplayPreferences(preferences: DisplayPreferences): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(preferences)); return true; }
  catch { return false; }
}
