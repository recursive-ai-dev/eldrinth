import { useEffect, useState } from "react";
import { DEFAULT_TRAVEL_PREFERENCES, type TravelPreferences } from "./travelPreferences";

const OPTIONS: { key: keyof TravelPreferences; title: string; text: string }[] = [
  { key: "autoPause", title: "Pause when focus leaves the game", text: "Hold the world still when switching tabs or windows. Resume when you return." },
  { key: "highContrast", title: "High contrast interface", text: "Brighter text, stronger outlines, and solid reading panels." },
  { key: "atmosphere", title: "Ambient weather overlay", text: "Show drifting ash, sea haze, and stars over the world." },
  { key: "screenShake", title: "Camera shake", text: "Allow camera movement on hits and dramatic moments." },
];

export default function TravelSettings({ preferences, onChange, saved }: { preferences: TravelPreferences; onChange: (value: TravelPreferences) => void; saved: boolean }) {
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement);
  const [error, setError] = useState("");
  useEffect(() => {
    const update = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const toggleFullscreen = async () => {
    setError("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { setError("Fullscreen could not be opened. The desktop version also supports F11."); }
  };
  return <section aria-label="Travel and comfort settings" className="space-y-3">
    <h3 className="font-title text-sm tracking-wider text-amber-100">TRAVEL &amp; COMFORT</h3>
    {OPTIONS.map(option => <label key={option.key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-100/20 p-3">
      <input type="checkbox" className="mt-1 accent-teal-300" checked={preferences[option.key]} onChange={event => onChange({ ...preferences, [option.key]: event.target.checked })} />
      <span><span className="block text-amber-100">{option.title}</span><span className="mt-1 block text-sm text-amber-100/65">{option.text}</span></span>
    </label>)}
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => onChange({ ...DEFAULT_TRAVEL_PREFERENCES })} className="rounded border border-amber-100/30 px-3 py-2 text-sm text-amber-100">Reset travel settings</button>
      {document.fullscreenEnabled && <button type="button" aria-pressed={fullscreen} onClick={() => void toggleFullscreen()} className="rounded border border-teal-100/30 px-3 py-2 text-sm text-teal-100">{fullscreen ? "Exit fullscreen" : "Enter fullscreen"}</button>}
    </div>
    <p role="status" className="text-xs text-amber-100/65">{saved ? "Travel settings are saved on this device." : "These settings apply now but could not be saved on this device."}</p>
    {error && <p role="alert" className="text-sm text-amber-100">{error}</p>}
  </section>;
}
