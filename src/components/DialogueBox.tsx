import type { DialogueData } from "@/game/types";
import NpcPortraitView from "./NpcPortraitView";

export default function DialogueBox({
  data,
  onAdvance,
  onChoice,
}: {
  data: DialogueData;
  onAdvance: () => void;
  onChoice: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-5"
      onClick={data.choices ? undefined : onAdvance}
    >
      <div className="w-[min(820px,94vw)] rounded-xl border border-amber-200/20 bg-linear-to-b from-[#15131c]/95 to-[#0a0810]/95 p-5 shadow-2xl backdrop-blur-md">
        <div className="flex gap-4">
          {data.portrait && (
            <NpcPortraitView
              portrait={data.portrait}
              speaker={data.speaker}
              color={data.color}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div
                className="font-title text-sm uppercase tracking-[0.3em]"
                style={{ color: data.color }}
              >
                {data.speaker}
              </div>
              {data.roleLabel && (
                <span className="font-title text-[9px] tracking-[0.16em] text-amber-100/45">{data.roleLabel}</span>
              )}
            </div>
            <p className="min-h-[3.5rem] font-serif text-lg leading-relaxed text-amber-50/90">
              {data.text}
            </p>
          </div>
        </div>
        {data.choices && (
          <div className="mt-4 grid gap-2">
            {data.choices.map((choice, index) => (
              <button
                key={choice.id}
                onClick={(event) => { event.stopPropagation(); onChoice(choice.id); }}
                className="rounded border border-teal-200/25 bg-teal-300/5 px-3 py-2 text-left font-serif text-sm text-teal-50/90 transition hover:border-teal-200/60 hover:bg-teal-300/15"
              >
                <span className="mr-2 font-title text-xs tracking-wider text-teal-200/65">{index + 1}.</span>
                {choice.label}
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-teal-300/70"
              style={{ width: `${((data.index + 1) / data.total) * 100}%` }}
            />
          </div>
          <span className="font-title flick text-xs tracking-widest text-amber-200/60">
            {data.choices ? "1–9 / CLICK" : "▼ E / CLICK"}
          </span>
        </div>
      </div>
    </div>
  );
}
