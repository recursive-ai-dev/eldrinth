import type { HudData } from "@/game/types";
import AnimaSigil from "./AnimaSigil";

export default function CarriedNames({ voices = [] }: { voices?: HudData["voices"] }) {
  const heard = voices.filter(voice => voice.heard).length;
  return <section aria-labelledby="names-heading">
    <div className="flex items-center gap-5 border-b border-amber-100/15 pb-5">
      <AnimaSigil lit={voices.length} className="h-24 w-24 shrink-0 text-amber-200/80" />
      <div><p className="font-title text-[9px] tracking-[.3em] text-amber-200/60">THE MNEMONIC CALLED THEM YIELD</p>
        <h3 id="names-heading" className="mt-2 font-title text-xl tracking-wider text-amber-50">The names you carry</h3>
        <p className="mt-2 font-serif text-sm text-amber-100/70">{voices.length} carried · {heard} heard at the fire</p>
      </div>
    </div>
    {voices.length === 0 ? <div className="py-8">
      <p className="font-serif text-lg italic text-amber-50/85">There is nobody else in your breathing. Yet.</p>
      <p className="mt-3 text-sm leading-relaxed text-amber-100/65">Nine people remain inside the fortress vessels. Approach a shard and press E to hear who is there. Taking them is your decision; the cost is stated before you choose.</p>
    </div> : <>
      <p className="my-5 text-sm leading-relaxed text-amber-100/70">Rest at any wayfire with E, then choose a name. Their memories remain in the Voices pages of your field journal.</p>
      <ol className="grid gap-2 sm:grid-cols-2">{voices.map((voice, index) => <li key={voice.id} className="flex items-center gap-3 rounded-lg border border-amber-100/15 bg-amber-100/[.025] px-3 py-3">
        <span className="font-title text-[10px] text-amber-200/40">{String(index + 1).padStart(2, "0")}</span>
        <div><p className="font-title text-xs text-amber-50">{voice.name}</p><p className={`mt-1 text-xs ${voice.heard ? "text-teal-200/75" : "text-amber-100/55"}`}>{voice.heard ? "Memory recorded" : "Waiting for a quiet fire"}</p></div>
      </li>)}</ol>
    </>}
    <p className="mt-6 border-t border-amber-100/10 pt-4 font-serif text-sm italic text-amber-200/55">A name is the part of a person a ledger cannot use.</p>
  </section>;
}
