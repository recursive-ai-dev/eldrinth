import type { DialogueData } from "@/game/types";

export default function DialogueBox({
  data,
  onAdvance,
}: {
  data: DialogueData;
  onAdvance: () => void;
}) {
  return (
    <div
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-5"
      onClick={onAdvance}
    >
      <div className="w-[min(820px,94vw)] rounded-xl border border-amber-200/20 bg-linear-to-b from-[#15131c]/95 to-[#0a0810]/95 p-5 shadow-2xl backdrop-blur-md">
        <div
          className="font-title mb-2 text-sm uppercase tracking-[0.3em]"
          style={{ color: data.color }}
        >
          {data.speaker}
        </div>
        <p className="min-h-[3.5rem] font-serif text-lg leading-relaxed text-amber-50/90">
          {data.text}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-teal-300/70"
              style={{ width: `${((data.index + 1) / data.total) * 100}%` }}
            />
          </div>
          <span className="font-title flick text-xs tracking-widest text-amber-200/60">
            ▼ E / CLICK
          </span>
        </div>
      </div>
    </div>
  );
}
