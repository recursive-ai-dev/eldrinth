import { useEffect, useState } from "react";
import { CONTROL_ACTIONS, currentControlBindings, defaultControlBindings, rebindControl, saveControlBindings, controlKeyLabel, type ControlAction } from "@/game/controlBindings";

export default function ControlSettings() {
  const [bindings, setBindings] = useState(currentControlBindings);
  const [listening, setListening] = useState<ControlAction | null>(null);
  const [saved, setSaved] = useState(true);
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    if (!listening) return;
    const capture = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      if (event.key === "Escape") { setListening(null); setFeedback("Rebinding cancelled."); return; }
      if (event.key === "Tab") { setListening(null); setFeedback("Rebinding cancelled. Tab stays available for moving through settings."); return; }
      if (event.ctrlKey || event.metaKey || event.altKey) { setFeedback("Use a single key without Ctrl, Alt, or Meta."); return; }
      try {
        const next = rebindControl(bindings, listening, event.key);
        setBindings(next);
        setSaved(saveControlBindings(next));
        setFeedback(`${CONTROL_ACTIONS.find(action => action.id === listening)?.label}: ${controlKeyLabel(event.key.toLowerCase())}. Conflicting bindings exchange keys.`);
        setListening(null);
      } catch (error) { setFeedback(error instanceof Error ? error.message : "That key is unavailable."); }
    };
    document.addEventListener("keydown", capture, true);
    return () => document.removeEventListener("keydown", capture, true);
  }, [listening, bindings]);
  return <section className="mt-6" aria-label="Keyboard and controller settings">
    <h3 className="font-title text-sm tracking-wider text-amber-100">YOUR CONTROLS</h3>
    <p className="mt-2 text-sm leading-relaxed text-amber-100/70">Choose an action, then press its new key. A key already in use exchanges places with the old binding. Esc cancels. These preferences apply to this device.</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">{CONTROL_ACTIONS.map(({ id, label }) => <button key={id} type="button" aria-pressed={listening === id} aria-label={`Rebind ${label}, currently ${controlKeyLabel(bindings[id])}`} onClick={() => { setListening(id); setFeedback(`Press a new key for ${label}. Esc cancels.`); }} className={`flex items-center justify-between gap-3 rounded border px-3 py-2 text-left text-sm ${listening === id ? "border-teal-200 bg-teal-300/15 text-teal-50" : "border-amber-100/20 text-amber-100 hover:bg-white/5"}`}><span>{label}</span><kbd className="text-teal-100">{listening === id ? "Listening…" : controlKeyLabel(bindings[id])}</kbd></button>)}</div>
    <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-teal-100">{feedback}</p>
    {!saved && <p role="alert" className="mt-2 text-sm text-rose-200">Controls apply now, but could not be saved for next time.</p>}
    <button type="button" onClick={() => { const next = defaultControlBindings(); setBindings(next); setSaved(saveControlBindings(next)); setListening(null); setFeedback("Default controls restored."); }} className="mt-3 rounded border border-amber-100/25 px-3 py-2 text-sm text-amber-100 hover:bg-white/5">Restore default controls</button>
    <p className="mt-4 text-sm leading-relaxed text-amber-100/70">Arrows also move, Space attacks, Enter interacts, and Esc / P pause. Number keys choose dialogue options. These shortcuts stay available; story text uses the default key names.</p>
    <h4 className="mt-6 font-title text-sm text-amber-100">CONTROLLER · EXPLORATION &amp; COMBAT</h4>
    <p className="mt-2 text-sm leading-relaxed text-amber-100/70">Connect a controller with a standard browser mapping and press a button to wake it. Left stick / D-pad moves; bottom face button attacks; right dashes; left interacts; top raises the lantern. Left shoulder parries, right shoulder changes weapons, and Start pauses or resumes. Use keyboard or mouse for menus and dialogue choices. A small stick deadzone prevents drift.</p>
  </section>;
}
