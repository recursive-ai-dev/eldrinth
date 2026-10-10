import journal from "@/assets/field-kit/journal.png";
import quest from "@/assets/field-kit/quest.png";
import shard from "@/assets/field-kit/shard.png";
import potion from "@/assets/field-kit/potion.png";
import guard from "@/assets/field-kit/guard.png";
import blade from "@/assets/field-kit/blade.png";
import waypoint from "@/assets/field-kit/waypoint.png";
import campfire from "@/assets/field-kit/campfire.png";
import town from "@/assets/field-kit/town.png";
import fortress from "@/assets/field-kit/fortress.png";
import shrine from "@/assets/field-kit/shrine.png";
import boss from "@/assets/field-kit/boss.png";
import wraith from "@/assets/field-kit/wraith.png";
import sentinel from "@/assets/field-kit/sentinel.png";
import adept from "@/assets/field-kit/adept.png";
import grassland from "@/assets/field-kit/grassland.png";
import marsh from "@/assets/field-kit/marsh.png";
import mountain from "@/assets/field-kit/mountain.png";
import coast from "@/assets/field-kit/coast.png";
import spire from "@/assets/field-kit/spire.png";
import lantern from "@/assets/field-kit/lantern.png";
import gate from "@/assets/field-kit/gate.png";
import treasure from "@/assets/field-kit/treasure.png";
import chart from "@/assets/field-kit/chart.png";
import "./SpriteIcon.css";

export const SPRITE_ICON_URLS = {
  journal, quest, shard, potion, guard, blade, waypoint, campfire, town,
  fortress, shrine, boss, wraith, sentinel, adept, grassland, marsh, mountain,
  coast, spire, lantern, gate, treasure, chart,
} as const;

export type SpriteIconId = keyof typeof SPRITE_ICON_URLS;

/** Decorative beside text; supply a label only when the image needs its own name. */
export default function SpriteIcon({ id, size = 32, className = "", label }: {
  id: SpriteIconId;
  size?: number;
  className?: string;
  label?: string;
}) {
  return <img
    src={SPRITE_ICON_URLS[id]}
    alt={label ?? ""}
    aria-hidden={label ? undefined : true}
    width={size}
    height={size}
    draggable={false}
    className={`field-sprite ${className}`.trim()}
  />;
}
