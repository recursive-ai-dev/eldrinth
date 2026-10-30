import { useControlKeys } from "./useControlKeys";
import EquipmentIcon from "./EquipmentIcon";
import SpriteIcon from "./SpriteIcon";
import Wayfinder from "./Wayfinder";
import { resourceMeter } from "./hudMetrics";
import type { HudData } from "@/game/types";

export default function HUD({ hud, onEquipment, onLantern, onAtlas, pinnedId }: { hud: HudData; onEquipment?: () => void; onLantern?: () => void; onAtlas?: () => void; pinnedId?: string | null }) {
  const key = useControlKeys();
  const life = resourceMeter(hud.hp, hud.maxHp);
  const stamina = resourceMeter(hud.stamina, hud.maxStamina);
  const boss = resourceMeter(hud.bossHp * 100, 100);
  const critical = life.value > 0 && life.percent <= 25;
  return (
    <div className="game-hud pointer-events-none absolute inset-0 z-10 select-none">
      {/* Top-left: vitals */}
      <div data-testid="hud-vitals" className="hud-vitals absolute inset-safe-t inset-safe-l flex flex-col gap-2">
        <div className="w-44 rounded-lg border border-rose-300/20 bg-black/45 px-3 py-2 backdrop-blur-sm">
          <div className="mb-1 flex items-center justify-between font-title text-[10px] uppercase tracking-[0.2em] text-rose-100/75">
            <span>Life {critical && <span className="hud-life-warning">· LOW</span>}</span>
            <span>
              {life.display}
              <span className="text-rose-200/80"> / {life.maximum}</span>
            </span>
          </div>
          <div role="progressbar" aria-label="Life" aria-valuenow={life.value} aria-valuemax={life.maximum} aria-valuemin={0} aria-valuetext={`${life.display} of ${life.maximum}${critical ? ", low life" : ""}`} className="h-1.5 overflow-hidden rounded-full bg-rose-950/80">
            <div
              className="h-full bg-[#e24747] transition-[width] duration-100 ease-out"
              style={{ width: `${life.percent}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-teal-300/20 bg-black/45 px-3 py-1.5 backdrop-blur-sm">
          <span className="inline-block h-3 w-3 rotate-45 bg-teal-300 shadow-[0_0_8px_2px_rgba(70,240,216,0.7)]" />
          <span className="font-title text-sm tracking-wider text-teal-100">
            ANIMA {hud.shards}
            <span className="text-teal-300/80"> / {hud.totalShards}</span>
          </span>
        </div>
        <div className="w-44 rounded-lg border border-cyan-300/20 bg-black/45 px-3 py-2 backdrop-blur-sm">
          <div className="mb-1 flex items-center justify-between font-title text-[10px] uppercase tracking-[0.2em] text-cyan-100/75">
            <span>Stamina {stamina.value === 0 && <span className="hud-stamina-empty">· EMPTY</span>}</span>
            <span className="whitespace-nowrap text-[9px]">{stamina.display}<span className="hud-stamina-maximum text-cyan-200/65"> / {stamina.maximum}</span></span>
          </div>
          <div data-testid="hud-stamina" role="progressbar" aria-label="Stamina" aria-valuenow={stamina.value} aria-valuemax={stamina.maximum} aria-valuemin={0} className="h-1.5 overflow-hidden rounded-full bg-cyan-950/80">
            <div
              className="h-full bg-cyan-300 transition-[width] duration-100 ease-out"
              style={{ width: `${stamina.percent}%` }}
            />
          </div>
        </div>
      </div>

      {hud.guard && <div data-testid="hud-guard" data-state={hud.guard.riposte > 0 ? "riposte" : hud.guard.window > 0 ? "guarding" : hud.guard.cooldown > 0 ? "recovering" : "ready"} className={`hud-guard absolute rounded-md border px-3 py-2 font-title text-[9px] tracking-widest ${hud.guard.riposte > 0 ? "border-amber-200/60 bg-amber-950/80 text-amber-100" : "border-amber-100/15 bg-black/45 text-amber-100/65"}`}>
        <span>{hud.guard.riposte > 0 ? "RIPOSTE +2 · STRIKE" : hud.guard.window > 0 ? "LAST BREATH · GUARDING" : hud.guard.cooldown > 0 ? "LAST BREATH · RECOVERING" : `${key.guard} · LAST BREATH`}</span>
        <div className="mt-1.5 h-px w-full bg-white/10"><div className="h-px bg-amber-200/70" style={{ width: `${hud.guard.riposte > 0 ? hud.guard.riposte / 2 * 100 : Math.max(0, 1 - hud.guard.cooldown / .9) * 100}%` }} /></div>
      </div>}

      {hud.lantern && <button type="button" aria-label="Lantern" aria-pressed={hud.lantern.lit} disabled={!onLantern} onClick={onLantern} title={`${key.lantern} · Raise or shutter the lantern. Its light reveals writing on scraped brass.`} className={`hud-lantern pointer-events-auto absolute flex min-h-11 items-center gap-2 rounded-lg border px-2 py-1.5 text-left backdrop-blur-sm disabled:pointer-events-none ${hud.lantern.lit ? "border-amber-200/60 bg-amber-950/80 text-amber-100" : "border-amber-100/20 bg-black/65 text-amber-100/70"}`}>
        <EquipmentIcon id="lantern" />
        <span><span className="block font-title text-[10px] tracking-widest">{key.lantern} · LANTERN</span><span className="block text-xs">{hud.lantern.lit ? "Raised" : "Shuttered"}</span></span>
      </button>}

      {hud.navigation && onAtlas && <button type="button" aria-label="Atlas" onClick={onAtlas} className="hud-atlas" title={`${key.atlas} · Chart known places and pin a destination`}>
        <SpriteIcon id="chart" size={28} /><span>{key.atlas} · ATLAS<small>{hud.navigation.landmarks.length} KNOWN PLACES</small></span>
      </button>}
      {hud.navigation && !hud.bossActive && <Wayfinder data={hud.navigation} pinnedId={pinnedId} />}

      {hud.equipment && onEquipment && <button type="button" aria-label="Equipment" onClick={onEquipment} className="hud-loadout pointer-events-auto absolute bottom-6 left-6 flex items-center gap-3 rounded-lg border border-amber-200/25 bg-black/65 px-3 py-2 text-left backdrop-blur-sm transition hover:border-teal-200/60">
        <EquipmentIcon id={hud.equipment.tool} />
        <span><span className="block font-title text-xs tracking-wider text-amber-100">{hud.equipment.tools.find(tool => tool.id === hud.equipment?.tool)?.name}</span><span className="mt-1 block font-title text-[9px] tracking-wider text-amber-100/65">{key.tool} SWITCH · {key.pause} EQUIPMENT · {hud.equipment.equippedCount}/3 RELICS</span></span>
      </button>}

      {/* Top-center: objective */}
      <div data-testid="hud-objective" className="hud-objective absolute top-4">
        <div className="rounded-lg border border-amber-200/15 bg-black/45 px-4 py-2 text-center backdrop-blur-sm">
          <div className="mb-1 font-title text-[10px] uppercase tracking-[0.3em] text-teal-200/65">
            {hud.regionName}
          </div>
          <div className="font-title text-[10px] uppercase tracking-[0.3em] text-amber-200/60">
            Rumour
          </div>
          <div className="font-title text-sm tracking-wide text-amber-50">{hud.objective}</div>
        </div>
      </div>

      {/* Top-right: foes remaining */}
      <div className="hud-foes absolute inset-safe-t inset-safe-r rounded-lg border border-rose-300/15 bg-black/45 px-3 py-2 text-right backdrop-blur-sm">
        <div className="font-title text-[10px] uppercase tracking-[0.3em] text-rose-200/80">
          The Sundered
        </div>
        <div className="font-title text-lg text-rose-100">{hud.enemies}</div>
      </div>

      {/* Boss bar */}
      {hud.bossActive && (
        <div className="absolute bottom-5 left-1/2 w-[min(560px,82vw)] -translate-x-1/2">
          <div className="mb-1 text-center font-title text-sm tracking-[0.35em] text-rose-300 drop-shadow-[0_0_6px_rgba(255,60,60,0.7)]">
            THE UNBOUND
          </div>
          <div role="progressbar" aria-label="The Unbound life" aria-valuenow={boss.percent} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${boss.percent}% remaining`} className="h-3 overflow-hidden rounded-full border border-rose-400/40 bg-black/60">
            <div
              className="h-full bg-linear-to-r from-rose-700 via-rose-500 to-rose-400 transition-[width] duration-200 ease-out"
              style={{ width: `${boss.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Interact prompt */}
      {hud.prompt && !hud.bossActive && (
        <div className="hud-prompt absolute bottom-7 left-1/2 -translate-x-1/2">
          <div role="status" aria-live="polite" className="rounded-md border border-teal-200/30 bg-black/60 px-4 py-1.5 font-title text-sm tracking-wider text-teal-100 backdrop-blur-sm">
            {hud.prompt.replace(/^Press E\b/u, `Press ${key.interact}`)}
          </div>
        </div>
      )}

      {/* Message log */}
      {hud.message && (
        <div
          key={hud.messageId}
          role="status"
          aria-live="polite"
          className="hud-message msg-fade pointer-events-none absolute bottom-16 left-0 right-0 flex justify-center px-4 text-center"
        >
          <span className="rounded bg-black/55 px-4 py-1 font-serif text-base italic text-amber-50/90 backdrop-blur-sm">
            {hud.message}
          </span>
        </div>
      )}
    </div>
  );
}
