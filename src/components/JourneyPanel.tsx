import type { HudData } from "@/game/types";
import { applyHarvestCost, shardHarvestCost } from "@/game/escalation";
import SpriteIcon from "./SpriteIcon";

export default function JourneyPanel({ hud }: { hud: HudData }) {
  const minutes = Math.floor((hud.journey?.seconds ?? 0) / 60);
  const next = hud.shards + 1;
  const after = applyHarvestCost(hud.maxHp, hud.hp, next);
  const voices = hud.voices ?? [];
  const unheard = voices.filter(voice => !voice.heard);
  return <section className="space-y-5" aria-labelledby="journey-heading">
    <div className="flex items-center gap-3"><SpriteIcon id="chart" size={48} /><div><h3 id="journey-heading" className="font-title text-lg text-amber-100">Your pilgrimage</h3><p className="text-sm text-amber-100/65">{hud.regionName} · {hud.journey?.difficulty ?? "standard"}</p></div></div>
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[["Time on the road", `${Math.floor(minutes / 60)}h ${minutes % 60}m`], ["Returns after falling", hud.journey?.deaths ?? 0], ["Successful parries", hud.guard?.parries ?? 0], ["Names carried", `${hud.shards} / ${hud.totalShards}`], ["Memories heard", `${voices.length - unheard.length} / ${voices.length}`], ["Return point", hud.navigation?.checkpoint?.name ?? "Arrival road"]].map(([label, value]) => <div key={label} className="rounded-lg border border-amber-100/15 bg-black/20 p-3"><dt className="text-xs text-amber-100/65">{label}</dt><dd className="mt-1 text-sm text-teal-100">{value}</dd></div>)}
    </dl>
    <div className="rounded-lg border border-amber-100/20 p-4">
      <h4 className="flex items-center gap-2 font-title text-xs tracking-wider text-amber-100"><SpriteIcon id="shard" />THE NEXT TAKING</h4>
      {hud.shards < hud.totalShards ? <><p className="mt-3 text-sm text-amber-100/85">Taking vessel {next} costs {shardHarvestCost(next)} permanent maximum health. With your current blessings, maximum health would change from {hud.maxHp} to {after.maxHp}.</p><p className="mt-2 text-xs text-amber-100/65">The vessel states the cost again before you choose. You can leave and return. Maximum health never falls below 1.</p></> : <p className="mt-3 text-sm text-teal-100">All nine are carried. There are no further vessels to take.</p>}
    </div>
    {unheard.length > 0 && <p className="flex items-start gap-3 rounded-lg border border-teal-100/20 p-4 text-sm text-teal-100"><SpriteIcon id="campfire" />{unheard.length} {unheard.length === 1 ? "person is" : "people are"} waiting to share a memory. Rest at a wayfire and choose a name.</p>}
    <p className="text-xs text-amber-100/65">Time records active travel; reading, conversations, and pauses do not add to it.</p>
  </section>;
}
