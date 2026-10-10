import { useEffect, useState, type ReactNode } from "react";
import Modal from "./Modal";
import EquipmentPanel from "./EquipmentPanel";
import type { EquipmentData, CombatToolId, RelicId } from "@/game/equipment";
import type { DisplayPreferences } from "./displayPreferences";
import type { HudData } from "@/game/types";
import CarriedNames from "./CarriedNames";
import TravelSettings from "./TravelSettings";
import JourneyPanel from "./JourneyPanel";
import type { TravelPreferences } from "./travelPreferences";

export default function PauseOverlay({ onResume, onRestart, onSaveAndReturn, equipment, onRelic, onTool, preferences, onPreferences, preferencesSaved = true, voices, soundSettings, onSave, lastSavedAt, travelPreferences, onTravelPreferences, travelPreferencesSaved = true, hud }: {
  onResume: () => void;
  onRestart: () => void;
  onSaveAndReturn?: () => Promise<void>;
  onSave?: () => Promise<void>;
  lastSavedAt?: number | null;
  travelPreferences?: TravelPreferences;
  onTravelPreferences?: (value: TravelPreferences) => void;
  travelPreferencesSaved?: boolean;
  equipment?: EquipmentData;
  onRelic?: (id: RelicId) => boolean;
  onTool?: (id: CombatToolId) => boolean;
  preferences?: DisplayPreferences;
  onPreferences?: (value: DisplayPreferences) => void;
  preferencesSaved?: boolean;
  voices?: HudData["voices"];
  hud?: HudData;
  soundSettings?: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState("");
  const [tab, setTab] = useState<"equipment" | "journey" | "names" | "display" | "sound" | "controls">("equipment");

  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 6000);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  useEffect(() => {
    if (!saving) return;
    // Disabling the focused Save button moves focus to <body> in Chromium.
    // Keep resume keys from reaching the engine outside the modal while its
    // captured checkpoint is still waiting for persistence.
    const holdPause = (event: KeyboardEvent) => {
      if (!["escape", "i", "p"].includes(event.key.toLowerCase())) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    document.addEventListener("keydown", holdPause, true);
    return () => document.removeEventListener("keydown", holdPause, true);
  }, [saving]);

  const performSave = async (leave: boolean) => {
    const action = leave ? onSaveAndReturn : onSave;
    if (!action || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaveFeedback("");
    try { await action(); setSaveFeedback("Your pilgrimage is saved."); }
    catch (error) { setSaveError(error instanceof Error ? error.message : "The record could not be saved. Your pilgrimage is still open."); }
    finally { setSaving(false); }
  };

  return (
    <Modal labelledBy="pause-heading" className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6" onKeyDown={event => {
      if (saving) { event.stopPropagation(); if (event.key === "Escape") event.preventDefault(); }
      else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onResume(); }
    }}>
      <div className="pause-panel max-h-[92dvh] w-[min(960px,96vw)] overflow-y-auto rounded-2xl border border-amber-200/20 bg-[#0c0d12]/98 shadow-2xl">
        <div className="grid md:grid-cols-[260px_1fr]">
          <aside className="border-b border-amber-200/15 bg-black/20 p-5 md:border-r md:border-b-0 md:p-7">
            <div aria-hidden="true" className="mb-4 text-3xl text-teal-200/70">⟡</div>
            <h2 id="pause-heading" className="font-title text-2xl tracking-[0.2em] text-amber-100">PAUSED</h2>
            <p className="mt-2 font-serif text-sm italic text-amber-200/75">The world holds its breath.</p>
            <div className="mt-6 space-y-3">
              <button disabled={saving} onClick={onResume} className="w-full rounded-lg border border-teal-300/40 bg-teal-400/10 px-4 py-3 font-title text-xs tracking-widest text-teal-100 transition hover:bg-teal-400/20 disabled:opacity-50">RESUME</button>
              {onSaveAndReturn && <button disabled={saving} onClick={() => void performSave(true)} className="w-full rounded-lg border border-amber-200/25 bg-white/5 px-3 py-3 font-title text-[10px] tracking-wider text-amber-100 transition hover:bg-white/10 disabled:opacity-50">{saving ? "SAVING RECORD…" : "SAVE & RETURN TO TITLE"}</button>}
              {onSave && <button disabled={saving} onClick={() => void performSave(false)} className="w-full rounded-lg border border-teal-200/25 px-3 py-3 font-title text-[10px] tracking-wider text-teal-100 disabled:opacity-50">{saving ? "SAVING…" : "SAVE CHECKPOINT"}</button>}
              <p role="status" className="text-xs text-amber-100/70">{saveFeedback || (lastSavedAt ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No checkpoint written this visit.")}</p>
              {saveError && <p role="alert" className="text-sm leading-relaxed text-rose-200">{saveError}</p>}
              {confirming ? <>
                <p data-testid="abandon-warning" className="rounded-lg border border-rose-400/30 bg-rose-950/25 px-3 py-2 text-xs leading-relaxed text-rose-100/90">This pilgrimage ends here and a new one begins from the arrival road. Your slot keeps whatever was last written to it.</p>
                <button disabled={saving} onClick={() => setConfirming(false)} className="w-full rounded border border-white/20 px-3 py-2 font-title text-xs text-amber-100">KEEP PLAYING</button>
                <button disabled={saving} data-testid="abandon-confirm" onClick={onRestart} className="w-full rounded border border-rose-400/50 bg-rose-500/15 px-3 py-2 font-title text-xs text-rose-100">ABANDON</button>
              </> : <button disabled={saving} onClick={() => setConfirming(true)} className="w-full rounded-lg border border-amber-200/15 px-3 py-3 font-title text-[10px] tracking-wider text-amber-100/70 transition hover:bg-white/5 disabled:opacity-50">ABANDON &amp; RESTART</button>}
            </div>
            <p className="mt-6 text-xs leading-relaxed text-amber-100/60">Esc / I to return to the road.<br />Your record autosaves as you travel.</p>
          </aside>
          <fieldset disabled={saving} aria-label="Equipment and display settings" className="min-w-0 p-5 sm:p-7">
            <nav aria-label="Pause sections" className="mb-6 flex flex-wrap gap-1 border-b border-amber-100/15 pb-3">
              {(["equipment", "journey", "names", "display", "sound", "controls"] as const).map(id => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)} className={`rounded px-3 py-2 font-title text-xs capitalize tracking-wider transition ${tab === id ? "bg-teal-300/10 text-teal-100" : "text-amber-100/65 hover:bg-white/5 hover:text-amber-50"}`}>{id.charAt(0).toUpperCase() + id.slice(1)}</button>)}
            </nav>
            {tab === "equipment" && (equipment && onRelic && onTool ? <EquipmentPanel equipment={equipment} onRelic={onRelic} onTool={onTool} /> : <p className="text-amber-100/75">Your equipment is being read.</p>)}
            {tab === "journey" && hud && <JourneyPanel hud={hud} />}
            {tab === "names" && <CarriedNames voices={voices} />}
            {tab === "sound" && soundSettings}
            {tab === "display" && preferences && onPreferences && <div className="space-y-6">
              <div>
                <h3 className="font-title text-sm tracking-wider text-amber-100">A CLOSER LOOK</h3>
                <div className="mt-4 flex justify-between text-sm text-amber-100"><label htmlFor="camera-zoom">Camera zoom</label><output htmlFor="camera-zoom">{Math.round(preferences.cameraZoom * 100)}%</output></div>
                <input id="camera-zoom" type="range" min="1" max="2" step="0.25" value={preferences.cameraZoom} onChange={event => onPreferences({ ...preferences, cameraZoom: Number(event.target.value) })} className="mt-3 w-full accent-teal-300" />
                <p className="mt-2 text-sm text-amber-100/65">Bring the world closer to your wayfarer. Lower the zoom to see more of the road.</p>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-100/20 p-4">
                <input type="checkbox" checked={preferences.largeText} onChange={event => onPreferences({ ...preferences, largeText: event.target.checked })} className="mt-1 accent-teal-300" />
                <span><span className="block text-amber-100">Larger reading text</span><span className="mt-1 block text-sm text-amber-100/65">Larger dialogue and field journal entries.</span></span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-100/20 p-4">
                <input type="checkbox" checked={preferences.quietInterface} onChange={event => onPreferences({ ...preferences, quietInterface: event.target.checked })} className="mt-1 accent-teal-300" />
                <span><span className="block text-amber-100">Quiet interface</span><span className="mt-1 block text-sm text-amber-100/65">Remove menu pulses, fades, and opening cinematic flashes. Your system's reduced-motion setting is also respected.</span></span>
              </label>
              {travelPreferences && onTravelPreferences && <TravelSettings preferences={travelPreferences} onChange={onTravelPreferences} saved={travelPreferencesSaved} />}
              <p role="status" className="text-xs text-amber-100/65">{preferencesSaved ? "Display preferences are saved on this device." : "Preferences apply now, but this device could not save them for next time."}</p>
            </div>}
            {tab === "controls" && <div>
              <h3 className="mb-4 font-title text-sm tracking-wider text-amber-100">ON THE ROAD</h3>
              <p className="mb-5 rounded-lg border border-amber-200/20 bg-amber-200/5 p-4 text-sm leading-relaxed text-amber-100/80"><strong className="font-title text-xs text-amber-100">LAST BREATH · F</strong><br />Face an incoming blow and tap F just before it lands. The brief guard costs 18 stamina. A parry returns 12 and empowers your next strike by +2 for two seconds. Attacks from behind and ember hazards still hurt.</p>
              <p className="mb-5 rounded-lg border border-amber-200/20 bg-amber-200/5 p-4 text-sm leading-relaxed text-amber-100/80"><strong className="font-title text-xs text-amber-100">THE LAMPLIGHTER’S MARGIN · R</strong><br />Raise your lantern with R or the Lantern button. Bring it close to scraped brass plates to reveal concealed writing, then press E to keep the account in your journal. Road notices give directions. The lamp uses no stamina or fuel; shuttering it leaves your copied records intact.</p>
              <dl className="space-y-3">{[["Move", "WASD / Arrows"], ["Attack", "J / Space"], ["Dash", "Shift"], ["Last Breath / parry", "F"], ["Raise / shutter lantern", "R"], ["Speak / read / enter", "E"], ["Switch weapon", "Q"], ["Equipment / pause", "I / Esc / P"], ["Field journal", "L"], ["Local atlas", "M"], ["Dialogue choices", "1–9 / 0"], ["Desktop fullscreen", "F11"]].map(([action, keys]) => <div key={action} className="flex justify-between gap-4 border-b border-amber-100/10 pb-2 text-sm"><dt className="text-amber-100/75">{action}</dt><dd className="text-right text-teal-100">{keys}</dd></div>)}</dl>
              <p className="mt-5 text-sm leading-relaxed text-amber-100/70">Read road signs for directions, rest at wayfires to gain relics, and keep your own observations in the journal. Some paths reward patience more than a blade.</p>
            </div>}
          </fieldset>
        </div>
      </div>
    </Modal>
  );
}
