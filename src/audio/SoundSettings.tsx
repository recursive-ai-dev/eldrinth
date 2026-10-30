import { useId } from "react";
import type { SoundscapeControls } from "./useSoundscape";

export default function SoundSettings({ preferences, setPreferences, preferencesSaved, supported }: SoundscapeControls) {
  const volumeId = useId();
  return (
    <fieldset className="rounded border border-amber-200/15 bg-black/20 p-3 text-left" disabled={!supported}>
      <legend className="px-2 text-xs uppercase tracking-[0.18em] text-amber-200/70">The world&apos;s lament</legend>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-amber-100/70">Music &amp; sound</p>
        <button
          type="button"
          aria-pressed={preferences.muted}
          aria-label="Mute music and sound"
          onClick={() => setPreferences({ ...preferences, muted: !preferences.muted })}
          className="rounded border border-amber-200/25 px-3 py-1.5 text-xs text-amber-100 transition hover:bg-amber-100/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"
        >
          {preferences.muted ? "Muted" : "Sound on"}
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <label htmlFor={volumeId} className="text-xs text-amber-100/65">Volume</label>
        <input
          id={volumeId}
          type="range"
          min="0"
          max="100"
          step="5"
          value={Math.round(preferences.volume * 100)}
          onChange={(event) => setPreferences({ ...preferences, volume: Number(event.target.value) / 100 })}
          className="min-w-0 flex-1 accent-amber-300"
        />
        <output htmlFor={volumeId} className="w-9 text-right text-xs tabular-nums text-amber-100/65">{Math.round(preferences.volume * 100)}%</output>
      </div>
      {!supported && <p className="mt-2 text-xs text-amber-100/55">Sound is unavailable in this browser.</p>}
      {!preferencesSaved && <p role="status" className="mt-2 text-xs text-amber-200">This sound setting applies for this visit; it could not be saved.</p>}
    </fieldset>
  );
}
