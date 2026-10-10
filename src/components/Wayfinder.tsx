import { HEADING, HEADING_ROTATION, landmarkBearing, type NavigationData } from "@/game/navigation";
import SpriteIcon from "./SpriteIcon";
import "./navigation.css";

export default function Wayfinder({ data, pinnedId }: { data: NavigationData; pinnedId?: string | null }) {
  const landmark = data.landmarks.find(item => item.id === pinnedId);
  if (!landmark) return <div className={`hud-wayfinder${data.sanctuary ? " hud-shelter" : ""}`} data-testid="hud-wayfinder">
    {data.sanctuary ? <SpriteIcon id="town" size={24} /> : <span className="wayfinder-needle" aria-hidden="true" style={{ transform: `rotate(${HEADING_ROTATION[data.player.dir]}deg)` }}>↑</span>}
    <span className="wayfinder-name">{data.sanctuary ? `Sheltered · ${data.sanctuary}` : `Facing ${HEADING[data.player.dir]}`}<small>Tile {Math.floor(data.player.x)}, {Math.floor(data.player.y)}{pinnedId ? " · pin in another region" : " · M to chart a course"}</small></span>
  </div>;
  const bearing = landmarkBearing(data.player, landmark);
  return <div className="hud-wayfinder" data-testid="hud-wayfinder">
    <span className="wayfinder-needle" aria-hidden="true" style={{ transform: `rotate(${bearing.angle}deg)` }}>↑</span>
    <span className="wayfinder-name">{landmark.name}<small>{bearing.arrived ? "Within reach · approach to interact" : `${bearing.direction} · ${bearing.tiles} tiles · direct bearing`}{data.sanctuary ? " · sheltered" : ""}</small></span>
  </div>;
}
