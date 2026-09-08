import type { HudData } from "@/game/types";

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 drop-shadow">
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={filled ? "#e24747" : "transparent"}
        stroke={filled ? "#ff7a7a" : "#5a3340"}
        strokeWidth="1.5"
      />
      {filled && (
        <path
          d="M8 7.5c0-1 .8-1.8 1.8-1.8"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  );
}

export default function HUD({ hud }: { hud: HudData }) {
  const hearts = Array.from({ length: hud.maxHp });
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      {/* Top-left: vitals */}
      <div className="absolute left-4 top-4 flex flex-col gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-amber-200/15 bg-black/45 px-3 py-2 backdrop-blur-sm">
          {hearts.map((_, i) => (
            <Heart key={i} filled={i < hud.hp} />
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-teal-300/20 bg-black/45 px-3 py-1.5 backdrop-blur-sm">
          <span className="inline-block h-3 w-3 rotate-45 bg-teal-300 shadow-[0_0_8px_2px_rgba(70,240,216,0.7)]" />
          <span className="font-title text-sm tracking-wider text-teal-100">
            ANIMA {hud.shards}
            <span className="text-teal-300/50"> / {hud.totalShards}</span>
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
      <div className="absolute left-1/2 top-4 w-[min(560px,80vw)] -translate-x-1/2">
        <div className="rounded-lg border border-amber-200/15 bg-black/45 px-4 py-2 text-center backdrop-blur-sm">
          <div className="font-title text-[10px] uppercase tracking-[0.3em] text-amber-200/60">
            Quest
          </div>
          <div className="font-title text-sm tracking-wide text-amber-50">{hud.objective}</div>
        </div>
      </div>

      {/* Top-right: foes remaining */}
      <div className="absolute right-4 top-4 rounded-lg border border-rose-300/15 bg-black/45 px-3 py-2 text-right backdrop-blur-sm">
        <div className="font-title text-[10px] uppercase tracking-[0.3em] text-rose-200/60">
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
          <div className="rounded-md border border-teal-200/30 bg-black/60 px-4 py-1.5 font-title text-sm tracking-wider text-teal-100 backdrop-blur-sm">
            {hud.prompt}
          </div>
        </div>
      )}

      {/* Message log */}
      {hud.message && (
        <div
          key={hud.messageId}
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
