import { useEffect, useState } from "react";
import { CONTROL_ACTIONS, CONTROL_CHANGE_EVENT, CONTROL_STORAGE_KEY, controlKeyLabel, currentControlBindings, reloadControlBindings, type ControlAction } from "@/game/controlBindings";

/** UI hints follow the same live bindings as the engine and global shortcuts. */
export function useControlKeys(): Record<ControlAction, string> {
  const [bindings, setBindings] = useState(currentControlBindings);
  useEffect(() => {
    const change = () => setBindings(currentControlBindings());
    const storage = (event: StorageEvent) => {
      if (event.key !== CONTROL_STORAGE_KEY && event.key !== null) return;
      reloadControlBindings();
      change();
    };
    window.addEventListener(CONTROL_CHANGE_EVENT, change);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(CONTROL_CHANGE_EVENT, change);
      window.removeEventListener("storage", storage);
    };
  }, []);
  return Object.fromEntries(CONTROL_ACTIONS.map(({ id }) => [id, controlKeyLabel(bindings[id])])) as Record<ControlAction, string>;
}
