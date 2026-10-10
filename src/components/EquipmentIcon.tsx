import type { CombatToolId, RelicId } from "@/game/equipment";
import wayblade from "@/assets/equipment/wayblade.png";
import gravehammer from "@/assets/equipment/gravehammer.png";
import emberheart from "@/assets/equipment/emberheart.png";
import ashstep from "@/assets/equipment/ashstep.png";
import tidewell from "@/assets/equipment/tidewell.png";
import starblade from "@/assets/equipment/starblade.png";
import lantern from "@/assets/equipment/lantern.png";

export type EquipmentIconId = CombatToolId | RelicId | "lantern";

export const EQUIPMENT_ICON_URLS = {
  wayblade, gravehammer, emberheart, ashstep, tidewell, starblade, lantern,
} satisfies Record<EquipmentIconId, string>;

/** Decorative art; the surrounding control or text supplies the accessible name. */
export default function EquipmentIcon({ id, size = 32, className = "" }: {
  id: EquipmentIconId;
  size?: number;
  className?: string;
}) {
  return <img src={EQUIPMENT_ICON_URLS[id]} alt="" aria-hidden="true" width={size} height={size} draggable={false} className={`shrink-0 ${className}`} style={{ imageRendering: "pixelated" }} />;
}
