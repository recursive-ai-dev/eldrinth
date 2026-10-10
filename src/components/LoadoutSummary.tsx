import type { LoadoutStats } from "@/game/equipment";

const METRICS: { key: keyof LoadoutStats; title: string; unit: string }[] = [
  { key: "damage", title: "Strike", unit: " damage" },
  { key: "strikeInterval", title: "Strike interval", unit: "s" },
  { key: "dashCost", title: "Dash", unit: " stamina" },
  { key: "staminaRegen", title: "Recovery", unit: "/sec" },
  { key: "movementPercent", title: "Walking speed", unit: "%" },
];

export default function LoadoutSummary({ stats, current }: { stats: LoadoutStats; current?: LoadoutStats }) {
  return <dl className="grid grid-cols-2 gap-2 rounded-lg border border-amber-100/15 bg-black/20 p-3 sm:grid-cols-3">
    {METRICS.map(({ key, title, unit }) => <div key={key}>
      <dt className="text-xs text-amber-100/65">{title}</dt>
      <dd className="mt-1 text-sm tabular-nums text-teal-100">{current && current[key] !== stats[key] && <><span className="text-amber-100/60">{current[key]}{unit}</span><span aria-label=" becomes "> → </span></>}{stats[key]}{unit}</dd>
    </div>)}
  </dl>;
}
