import { useCallback, useEffect, useRef, useState } from "react";
import { Soundscape, soundSupported, type SoundscapeState } from "./Soundscape";
import { normalizeSoundPreferences, readSoundPreferences, saveSoundPreferences, type SoundPreferences } from "./preferences";

export function useSoundscape(state: Omit<SoundscapeState, "hidden">) {
  const [preferences, updatePreferences] = useState(readSoundPreferences);
  const [preferencesSaved, setPreferencesSaved] = useState(true);
  const [supported, setSupported] = useState(soundSupported);
  const controller = useRef<Soundscape | null>(null);
  const latest = useRef(state);
  latest.current = state;
  const settings = useRef(preferences);
  settings.current = preferences;

  useEffect(() => {
    const sound = new Soundscape(undefined, () => setSupported(false));
    controller.current = sound;
    sound.setPreferences(settings.current);
    const update = () => sound.update({ ...latest.current, hidden: document.hidden });
    const unlock = (event: Event) => { if (event.isTrusted) sound.unlock(); };
    update();
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
      document.removeEventListener("visibilitychange", update);
      controller.current = null;
      sound.dispose();
    };
  }, []);

  useEffect(() => { controller.current?.update({ ...state, hidden: document.hidden }); }, [state.hud, state.active, state.paused, state.dialogue]);
  useEffect(() => { controller.current?.setPreferences(preferences); }, [preferences]);

  const setPreferences = useCallback((next: SoundPreferences) => {
    const clean = normalizeSoundPreferences(next);
    updatePreferences(clean);
    setPreferencesSaved(saveSoundPreferences(clean));
  }, []);

  return { preferences, setPreferences, preferencesSaved, supported };
}

export type SoundscapeControls = ReturnType<typeof useSoundscape>;
