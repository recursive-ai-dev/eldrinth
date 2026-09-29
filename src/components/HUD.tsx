import type { HudData } from "@/game/types";

export default function HUD({ hud }: { hud: HudData }) {
  return (
    <div className="game-hud pointer-events-none absolute inset-0 z-10 select-none">
      {/* Top-left: vitals */}
      <div data-testid="hud-vitals" className="hud-vitals absolute inset-safe-t inset-safe-l flex flex-col gap-2">
        <div className="w-44 rounded-lg border border-rose-300/20 bg-black/45 px-3 py-2 backdrop-blur-sm">
          <div className="mb-1 flex items-center justify-between font-title text-[10px] uppercase tracking-[0.2em] text-rose-100/75">
            <span>Life</span>
            <span>
              {Math.max(0, Math.ceil(hud.hp))}
              <span className="text-rose-200/80"> / {hud.maxHp}</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-rose-950/80">
            <div
              className="h-full bg-[#e24747] transition-[width] duration-100 ease-out"
              style={{ width: `${hud.maxHp > 0 ? Math.round((Math.max(0, hud.hp) / hud.maxHp) * 100) : 0}%` }}
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
            <span>Stamina</span>
            <span>{Math.ceil(hud.stamina)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-cyan-950/80">
            <div
              className="h-full bg-cyan-300 transition-[width] duration-100 ease-out"
              style={{ width: `${Math.round((hud.stamina / hud.maxStamina) * 100)}%` }}
            />
          </div>
        </div>
      </div>

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
          <div className="h-3 overflow-hidden rounded-full border border-rose-400/40 bg-black/60">
            <div
              className="h-full bg-linear-to-r from-rose-700 via-rose-500 to-rose-400 transition-[width] duration-200 ease-out"
              style={{ width: `${Math.round(hud.bossHp * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Interact prompt */}
      {hud.prompt && !hud.bossActive && (
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2">
          <div role="status" aria-live="polite" className="rounded-md border border-teal-200/30 bg-black/60 px-4 py-1.5 font-title text-sm tracking-wider text-teal-100 backdrop-blur-sm">
            {hud.prompt}
          </div>
        </div>
      )}

      {/* Message log */}
      {hud.message && (
        <div
          key={hud.messageId}
          role="status"
          aria-live="polite"
          className="msg-fade pointer-events-none absolute bottom-16 left-0 right-0 flex justify-center px-4 text-center"
        >
          <span className="rounded bg-black/55 px-4 py-1 font-serif text-base italic text-amber-50/90 backdrop-blur-sm">
            {hud.message}
          </span>
        </div>
      )}
    </div>
  );
}
