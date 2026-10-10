import type { CombatToolId, EquipmentData, RelicId } from "@/game/equipment";
import { useState } from "react";
import EquipmentIcon from "./EquipmentIcon";
import LoadoutSummary from "./LoadoutSummary";

export default function EquipmentPanel({ equipment, onRelic, onTool }: {
  equipment: EquipmentData;
  onRelic: (id: RelicId) => boolean;
  onTool: (id: CombatToolId) => boolean;
}) {
  const equipped = equipment.relics.filter(relic => relic.equipped);
  const [feedback, setFeedback] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(false);
  return (
    <div className="equipment-panel space-y-6 text-left">
      {equipment.stats && <section aria-label="Current loadout statistics"><h3 className="mb-3 font-title text-xs tracking-wider text-amber-100">YOUR CURRENT LOADOUT</h3><LoadoutSummary stats={equipment.stats} /></section>}
      <section aria-labelledby="tool-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 id="tool-heading" className="font-title text-xs tracking-[.2em] text-amber-100">THE HAND THAT STRIKES</h3>
          <span className="text-xs text-amber-100/65">Q to switch in the field</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {equipment.tools.map(tool => (
            <button key={tool.id} type="button" aria-pressed={equipment.tool === tool.id} onClick={() => setFeedback(onTool(tool.id) ? `${tool.name} readied.` : "Resume and finish your current action before changing weapons.")} className={`equipment-tool rounded-lg border p-4 text-left transition ${equipment.tool === tool.id ? "border-teal-300/60 bg-teal-300/10" : "border-amber-100/20 bg-black/20 hover:border-amber-100/50"}`}>
              <span className="flex items-center justify-between gap-2 font-title text-sm text-amber-50">
                <span className="flex items-center gap-3"><EquipmentIcon id={tool.id} />{tool.name}</span>
                <span aria-hidden="true" className="text-teal-200">{equipment.tool === tool.id ? "◆" : "◇"}</span>
              </span>
              <span className="mt-2 block text-sm leading-relaxed text-amber-100/75">{tool.description}</span>
              <span className="mt-3 block font-title text-[10px] tracking-wider text-teal-100">{tool.damage} DAMAGE · {tool.staminaCost} STAMINA</span>
            </button>
          ))}
        </div>
        <p role="status" className="mt-3 min-h-5 text-sm text-teal-100">{feedback}</p>
      </section>
      <section aria-labelledby="relic-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 id="relic-heading" className="font-title text-xs tracking-[.2em] text-amber-100">WHAT YOU CARRY</h3>
          <span className="font-title text-[10px] tracking-widest text-teal-200">{equipment.equippedCount} / {equipment.slotCount} ATTUNED</span>
        </div>
        <div aria-label="Attuned relic slots" className="mb-4 grid grid-cols-3 gap-2">
          {Array.from({ length: equipment.slotCount }, (_, index) => (
            <div key={index} className={`relic-slot rounded border px-2 py-3 text-center ${equipped[index] ? "border-teal-200/35 bg-teal-300/5" : "border-dashed border-amber-100/20"}`}>
              <span aria-hidden="true" className="flex h-8 items-center justify-center text-xl text-amber-100/30">{equipped[index] ? <EquipmentIcon id={equipped[index].id} /> : "◇"}</span>
              <span className="mt-1 block font-title text-[10px] tracking-wide text-amber-100/80">{equipped[index]?.name ?? "Empty"}</span>
            </div>
          ))}
        </div>
        <p className="mb-3 text-sm leading-relaxed text-amber-100/65">Wayfires grant permanent blessings. Attune up to three relics for additional powers, each with a cost. Your blessings remain when you remove a relic.</p>
        <label className="mb-3 flex items-center gap-2 text-sm text-amber-100"><input type="checkbox" checked={ownedOnly} onChange={event => setOwnedOnly(event.target.checked)} className="accent-teal-300" />Show acquired relics only</label>
        {ownedOnly && !equipment.relics.some(relic => relic.owned) && <p className="text-sm text-amber-100/65">Rest at a wayfire to receive your first relic.</p>}
        <div className="grid gap-2">
          {equipment.relics.filter(relic => !ownedOnly || relic.owned).map(relic => (
            <div key={relic.id} className={`relic-card rounded-lg border p-3 ${relic.equipped ? "border-teal-200/30 bg-teal-300/5" : "border-amber-100/15 bg-black/15"}`}>
              <div className="flex items-center justify-between gap-3">
                <h4 className="flex items-center gap-2 font-title text-xs tracking-wider text-amber-50"><EquipmentIcon id={relic.id} className={relic.owned ? "" : "opacity-45"} />{relic.name}</h4>
                <button type="button" aria-label={`${relic.equipped ? "Remove" : "Attune"} ${relic.name}`} aria-pressed={relic.equipped} disabled={!relic.owned || (!relic.equipped && equipment.equippedCount >= equipment.slotCount)} onClick={() => setFeedback(onRelic(relic.id) ? `${relic.name} ${relic.equipped ? "removed" : "attuned"}.` : "Your equipment cannot be changed yet. Resume and try again when the way is clear.")} className="shrink-0 rounded border border-teal-200/30 px-3 py-1.5 font-title text-[10px] tracking-wider text-teal-100 transition hover:bg-teal-300/10 disabled:cursor-default disabled:border-amber-100/15 disabled:text-amber-100/45">
                  {!relic.owned ? "UNDISCOVERED" : relic.equipped ? "REMOVE" : equipment.equippedCount >= equipment.slotCount ? "SLOTS FULL" : "ATTUNE"}
                </button>
              </div>
              <p className="mt-2 text-sm text-amber-100/85">{relic.description}</p>
              <p className="mt-1 text-xs text-rose-200/85">{relic.tradeoff}</p>
              {relic.preview && equipment.stats && <details className="mt-3 text-sm text-amber-100/80"><summary className="cursor-pointer py-1">Compare {relic.equipped ? "removal" : "attunement"}</summary><div className="mt-2"><LoadoutSummary stats={relic.preview} current={equipment.stats} /></div></details>}
              {!relic.owned && <p className="mt-2 text-xs italic text-amber-100/60">{relic.source}</p>}
            </div>
          ))}
        </div>
        <p className="mt-3 font-title text-[10px] tracking-wider text-teal-100/80">DASH {equipment.dashCost} STAMINA · RECOVERY {equipment.staminaRegen}/SEC</p>
      </section>
    </div>
  );
}
