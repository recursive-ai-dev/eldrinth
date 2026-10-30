/** The engine keeps canonical commands; only physical keyboard keys are remapped. */
export const CONTROL_ACTIONS = [
  { id: "up", label: "Move up", key: "w" },
  { id: "left", label: "Move left", key: "a" },
  { id: "down", label: "Move down", key: "s" },
  { id: "right", label: "Move right", key: "d" },
  { id: "attack", label: "Attack", key: "j" },
  { id: "dash", label: "Dash", key: "shift" },
  { id: "guard", label: "Last Breath / parry", key: "f" },
  { id: "lantern", label: "Raise / shutter lantern", key: "r" },
  { id: "interact", label: "Speak / read / enter", key: "e" },
  { id: "tool", label: "Switch weapon", key: "q" },
  { id: "pause", label: "Equipment / pause", key: "i" },
  { id: "journal", label: "Field journal", key: "l" },
  { id: "atlas", label: "Local atlas", key: "m" },
] as const;
export type ControlAction = typeof CONTROL_ACTIONS[number]["id"];
export type ControlBindings = Record<ControlAction, string>;
export const CONTROL_STORAGE_KEY = "eldrinth.controls.v1";
export const CONTROL_CHANGE_EVENT = "eldrinth-controls-change";
const FIXED_KEYS = new Set(["escape", "p", "enter", " ", "arrowup", "arrowdown", "arrowleft", "arrowright"]);

export function defaultControlBindings(): ControlBindings {
  return Object.fromEntries(CONTROL_ACTIONS.map(action => [action.id, action.key])) as ControlBindings;
}

export function bindableKey(key: string): boolean {
  return key === "shift" || (key.length === 1 && !/[\s\d]/u.test(key) && !FIXED_KEYS.has(key));
}

export function normalizeControlBindings(value: unknown): ControlBindings {
  const defaults = defaultControlBindings();
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Record<string, unknown>;
  const keys = CONTROL_ACTIONS.map(({ id }) => candidate[id]);
  // Reject the entire malformed set: per-field fallbacks could create collisions.
  if (keys.some(key => typeof key !== "string" || !bindableKey(key) || key !== key.toLowerCase()) || new Set(keys).size !== keys.length) return defaults;
  return Object.fromEntries(CONTROL_ACTIONS.map(({ id }) => [id, candidate[id]])) as ControlBindings;
}

export function readControlBindings(): ControlBindings {
  try { return normalizeControlBindings(JSON.parse(localStorage.getItem(CONTROL_STORAGE_KEY) ?? "null")); }
  catch { return defaultControlBindings(); }
}

let sessionBindings: ControlBindings | null = null;
/** Apply immediately even when persistence is blocked. */
export function currentControlBindings(): ControlBindings {
  return sessionBindings ??= readControlBindings();
}
export function saveControlBindings(bindings: ControlBindings): boolean {
  sessionBindings = normalizeControlBindings(bindings);
  let saved = true;
  try { localStorage.setItem(CONTROL_STORAGE_KEY, JSON.stringify(sessionBindings)); }
  catch { saved = false; }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CONTROL_CHANGE_EVENT));
  return saved;
}
export function reloadControlBindings() { sessionBindings = readControlBindings(); }

/** Preserve fixed UI shortcuts and digits, but retire replaced primary keys. */
export function mapKeyboardKey(key: string, bindings = currentControlBindings()): string | null {
  const lower = key.toLowerCase();
  if (FIXED_KEYS.has(lower) || /^[0-9]$/u.test(lower)) return lower;
  const action = CONTROL_ACTIONS.find(({ id }) => bindings[id] === lower);
  return action?.key ?? null;
}

export function controlKeyLabel(key: string): string {
  return key === " " ? "Space" : key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);
}

/** Swapping a conflict keeps every action reachable and every key unique. */
export function rebindControl(bindings: ControlBindings, action: ControlAction, key: string): ControlBindings {
  const lower = key.toLowerCase();
  if (!bindableKey(lower)) throw new Error("Use a letter, punctuation key, or Shift. Arrows, Space, Enter, Esc, P and number keys stay available as fixed shortcuts.");
  const next = { ...bindings, [action]: lower };
  const conflict = CONTROL_ACTIONS.find(({ id }) => id !== action && bindings[id] === lower);
  if (conflict) next[conflict.id] = bindings[action];
  return next;
}
