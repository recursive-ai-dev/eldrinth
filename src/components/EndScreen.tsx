import { useEffect } from "react";
import endingBg from "@/assets/ending.jpg";
import type { EndingId } from "@/game/core/SceneStack";

interface EndingCopy {
  title: string;
  body: string;
  button: string;
  image: string;
  scrim: string;
  heading: string;
  action: string;
}

export const ENDINGS: Record<EndingId, EndingCopy> = {
  silence: {
    title: "THE SPIRE FALLS SILENT",
    body: "Nine hundred years of people stop at once. It is the largest thing you will ever do and it takes less time than a breath. The shards scatter into the dawn like fireflies, exactly the way the old songs promised, and Eldrinth stirs beneath a sun it had forgotten. Behind you, in the quiet, something finishes assembling itself and walks out of the Spire wearing your face. It thanks you. It means that, too.",
    button: "WALK AGAIN",
    image: "opacity-80",
    scrim: "bg-linear-to-b from-amber-950/30 via-black/30 to-black/80",
    heading: "text-amber-50",
    action: "border-amber-300/50 bg-amber-400/10 text-amber-50 hover:bg-amber-400/20",
  },
  refusal: {
    title: "THE SPIRE HEARS YOU",
    body: "You say no. Orithel does not argue — he has no procedure for it, and you watch him reach for one and find the shelf empty. Nine hundred years of screaming stops, all at once, to listen. Something enormous turns its attention on the two of you and begins, very slowly, to work out what it is being offered. Whatever happens next has no word for it yet. It is not rescue. It is not over.",
    button: "STAY",
    image: "opacity-40 contrast-125",
    scrim: "bg-linear-to-b from-slate-950/60 via-slate-900/50 to-black/85",
    heading: "text-teal-100",
    action: "border-teal-200/50 bg-teal-300/10 text-teal-50 hover:bg-teal-300/20",
  },
  spent: {
    title: "YOUR LIGHT FADES",
    body: "You do not die. The Sundered close over you and the old light gutters out, and then there is a long nothing, and then a pattern is drawn again from a courier's recovered shape and stood up on the road east of Ilyarael, knowing nothing, certain it has never come this way before. Count the entries in this slot. That is how many times.",
    button: "RISE AGAIN",
    image: "opacity-25 grayscale",
    scrim: "bg-black/85",
    heading: "text-rose-200",
    action: "border-rose-300/50 bg-rose-400/10 text-rose-50 hover:bg-rose-400/20",
  },
};

export default function EndScreen({
  ending,
  onRestart,
}: {
  ending: EndingId;
  onRestart: () => void;
}) {
  const copy = ENDINGS[ending];
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onRestart();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onRestart]);
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden">
      <img src={endingBg} alt="" className={`absolute inset-0 h-full w-full object-cover ${copy.image}`} />
      <div className={`absolute inset-0 ${copy.scrim}`} />
      <div className="absolute inset-0 vignette" />

      <div className="relative z-10 flex max-w-2xl flex-col items-center px-6 text-center">
        <h1
          className={`font-title text-5xl font-bold tracking-[0.15em] drop-shadow-[0_2px_18px_rgba(0,0,0,0.9)] sm:text-6xl ${copy.heading}`}
        >
          {copy.title}
        </h1>

        <p className="mt-6 max-w-xl font-serif text-base leading-relaxed text-amber-50/75 sm:text-lg">
          {copy.body}
        </p>

        <button
          onClick={onRestart}
          className={`mt-9 rounded-lg border px-10 py-4 font-title text-lg tracking-[0.3em] transition hover:scale-[1.03] ${copy.action}`}
        >
          {copy.button}
        </button>
      </div>
    </div>
  );
}
