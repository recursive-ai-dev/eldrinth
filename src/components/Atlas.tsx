import { useMemo, useState } from "react";
import Modal from "./Modal";
import SpriteIcon, { type SpriteIconId } from "./SpriteIcon";
import { atlasBounds, filterLandmarks, HEADING, HEADING_ROTATION, landmarkBearing, type LandmarkKind, type NavigationData } from "@/game/navigation";
import "./navigation.css";

export const LANDMARK_ICONS: Record<LandmarkKind, SpriteIconId> = { wayfire: "campfire", town: "town", road: "gate", door: "gate", record: "waypoint" };
const KINDS: { id: LandmarkKind | "all"; label: string }[] = [
  { id: "all", label: "All places" }, { id: "wayfire", label: "Wayfires" }, { id: "town", label: "Sanctuaries" },
  { id: "road", label: "Roads" }, { id: "door", label: "Doorways" }, { id: "record", label: "Records" },
];

export default function Atlas({ data, pinnedId, onPin, onClose }: {
  data: NavigationData;
  pinnedId: string | null;
  onPin: (id: string | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<LandmarkKind | "all">("all");
  const [sort, setSort] = useState<"distance" | "name">("distance");
  const [fullRegion, setFullRegion] = useState(false);
  const shown = useMemo(() => filterLandmarks(data, query, kind, sort), [data, query, kind, sort]);
  const bounds = atlasBounds(data, fullRegion);
  const position = (point: { x: number; y: number }) => ({ left: `${(point.x - bounds.x) / bounds.width * 100}%`, top: `${(point.y - bounds.y) / bounds.height * 100}%` });
  const pinned = data.landmarks.find(landmark => landmark.id === pinnedId);
  const pin = (id: string) => onPin(id === pinnedId ? null : id);

  return <Modal labelledBy="atlas-heading" className="atlas-overlay" onKeyDown={event => {
    if (event.key === "Escape") { event.stopPropagation(); onClose(); }
  }}>
    <section className="atlas-panel selectable">
      <header className="atlas-header">
        <SpriteIcon id="chart" size={44} />
        <div><p className="atlas-eyebrow">THE WAYFARER'S ATLAS</p><h2 id="atlas-heading">{data.regionName}</h2></div>
        <button type="button" className="atlas-close" onClick={onClose}>ESC / M / CLOSE</button>
      </header>
      <p className="atlas-intro">A chart of places you have seen and records you have read. Choose a landmark to carry its bearing on the road.</p>
      <div className="atlas-summary">
        <span><b>{data.landmarks.length}</b> known places</span>
        <span>Tile <b>{Math.floor(data.player.x)}, {Math.floor(data.player.y)}</b> · facing {HEADING[data.player.dir]}</span>
        {data.sanctuary && <span className="atlas-safe">Sheltered in {data.sanctuary}</span>}
      </div>
      <div className="atlas-body">
        <div className="atlas-chart-column">
          <div className="atlas-chart-actions"><span className="atlas-eyebrow">NORTH ↑</span><button type="button" aria-pressed={fullRegion} onClick={() => setFullRegion(!fullRegion)}>{fullRegion ? "Focus known places" : "Show region extent"}</button></div>
          <div className="atlas-chart" role="group" aria-label="Chart of known landmarks">
            <div className="atlas-chart-grid" aria-hidden="true" />
            <span className="atlas-chart-label" aria-hidden="true">{fullRegion ? "REGIONAL CHART" : "SURVEYED PLACES"}</span>
            {shown.map(landmark => <button key={landmark.id} type="button" className={`atlas-map-marker atlas-marker-${landmark.kind}${landmark.id === pinnedId ? " is-pinned" : ""}`} style={position(landmark)} aria-label={`${landmark.name}${landmark.id === pinnedId ? ", pinned" : ""}`} aria-pressed={landmark.id === pinnedId} title={`${landmark.name} · ${landmarkBearing(data.player, landmark).tiles} tiles`} onClick={() => pin(landmark.id)}><SpriteIcon id={LANDMARK_ICONS[landmark.kind]} size={27} /></button>)}
            <div className="atlas-player" style={position(data.player)} role="img" aria-label={`Your position, facing ${HEADING[data.player.dir]}`}><span style={{ transform: `rotate(${HEADING_ROTATION[data.player.dir]}deg)` }}>▲</span></div>
          </div>
          <p className="atlas-chart-caption">◇ You are here · Distances are straight-line bearings. Walls and water may require a detour.</p>
          <div className="atlas-refuge"><SpriteIcon id="campfire" size={32} /><div><span className="atlas-eyebrow">RETURN POINT</span><p>{data.checkpoint ? `${data.checkpoint.name}${data.checkpoint.local ? " · this region" : " · another region"}` : "No return point recorded"}</p></div></div>
          {pinned && <div className="atlas-pinned-summary"><span>Pinned: <b>{pinned.name}</b></span><button type="button" onClick={() => onPin(null)}>Clear pin</button></div>}
          {!pinned && pinnedId && <div className="atlas-pinned-summary"><span>Your pin is in another region.</span><button type="button" onClick={() => onPin(null)}>Clear pin</button></div>}
        </div>
        <div className="atlas-index">
          <label className="atlas-search"><span className="atlas-eyebrow">FIND A KNOWN PLACE</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or landmark…" aria-label="Search atlas" /></label>
          <div className="atlas-filter-row"><select aria-label="Landmark type" value={kind} onChange={event => setKind(event.target.value as LandmarkKind | "all")}>{KINDS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><select aria-label="Sort landmarks" value={sort} onChange={event => setSort(event.target.value as "distance" | "name")}><option value="distance">Nearest first</option><option value="name">Name A–Z</option></select></div>
          <div className="atlas-results" role="status">{shown.length} {shown.length === 1 ? "place" : "places"}{query || kind !== "all" ? " match your filters" : " on this chart"}</div>
          <div className="atlas-landmarks">
            {shown.length === 0 && <div className="atlas-empty"><SpriteIcon id="waypoint" size={42} /><p>{data.landmarks.length ? "No known places match. Try a different name or landmark type." : "The road is still uncharted. Approach wayfires, settlements, signs, and gates to mark them here."}</p>{(query || kind !== "all") && <button type="button" onClick={() => { setQuery(""); setKind("all"); }}>Reset filters</button>}</div>}
            {shown.map(landmark => {
              const bearing = landmarkBearing(data.player, landmark);
              return <button key={landmark.id} type="button" className={`atlas-landmark${landmark.id === pinnedId ? " is-pinned" : ""}`} aria-pressed={landmark.id === pinnedId} onClick={() => pin(landmark.id)}>
                <SpriteIcon id={LANDMARK_ICONS[landmark.kind]} size={34} />
                <span className="atlas-landmark-copy"><strong>{landmark.name}</strong><span>{landmark.detail}</span><small>{landmark.checkpoint ? "RETURN POINT" : landmark.recorded ? "RECORDED" : "SIGHTED"}{landmark.id === pinnedId ? " · PINNED" : ""}</small></span>
                <span className="atlas-bearing"><b>{bearing.arrived ? "HERE" : bearing.direction}</b><span>{bearing.arrived ? "within reach" : `${bearing.tiles} tiles`}</span></span>
              </button>;
            })}
          </div>
        </div>
      </div>
      <footer className="atlas-footer">The world rests while you read. Known places are kept with your save; the uncharted roads remain yours to discover.</footer>
    </section>
  </Modal>;
}
