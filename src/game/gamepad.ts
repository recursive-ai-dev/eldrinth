/** Standard Gamepad layout: https://www.w3.org/TR/gamepad/#remapping */
export function gamepadKeys(pad: Pick<Gamepad, "mapping" | "connected" | "buttons" | "axes"> | null | undefined): Set<string> {
  const keys = new Set<string>();
  if (!pad?.connected || pad.mapping !== "standard") return keys;
  const pressed = (index: number) => pad.buttons[index]?.pressed === true;
  const x = pad.axes[0] ?? 0;
  const y = pad.axes[1] ?? 0;
  if (pressed(12) || y < -0.3) keys.add("w");
  if (pressed(13) || y > 0.3) keys.add("s");
  if (pressed(14) || x < -0.3) keys.add("a");
  if (pressed(15) || x > 0.3) keys.add("d");
  for (const [button, key] of [[0, "j"], [1, "shift"], [2, "e"], [3, "r"], [4, "f"], [5, "q"], [9, "escape"]] as const) {
    if (pressed(button)) keys.add(key);
  }
  return keys;
}
