import oldLands from "@/assets/scenes/old-lands.png";
import cinderwild from "@/assets/scenes/cinderwild.png";
import moonlitCoast from "@/assets/scenes/moonlit-coast.png";
import starfallMoors from "@/assets/scenes/starfall-moors.png";

export type RegionSceneId = "old-lands" | "cinderwild" | "moonlit-coast" | "starfall-moors";

export const REGION_SCENE_URLS: Record<RegionSceneId, string> = {
  "old-lands": oldLands,
  cinderwild,
  "moonlit-coast": moonlitCoast,
  "starfall-moors": starfallMoors,
};

const REGION_EPITHETS: Record<RegionSceneId, string> = {
  "old-lands": "Mossy ruins, sealed elven vaults, and the road to the Spire",
  cinderwild: "Scorched basalt ravines, living embers, and kiln watchposts",
  "moonlit-coast": "Salt-wind harbours, drowned courts, and the keeper's beacon",
  "starfall-moors": "Impact craters, twilight heather, and the fallen observatory",
};

export interface RegionArrivalState {
  id: number;
  sceneId: RegionSceneId;
  title: string;
}

export function sceneIdForRegionName(regionName: string): RegionSceneId | null {
  const lower = regionName.toLowerCase();
  if (lower === "the old lands") return "old-lands";
  if (lower === "the cinderwild" || lower === "cinderwild") return "cinderwild";
  if (lower === "moonlit coast" || lower === "the moonlit coast") return "moonlit-coast";
  if (lower === "the starfall moors" || lower === "starfall moors") return "starfall-moors";
  return null;
}

export function sceneIdForAnyRegion(regionName: string): RegionSceneId {
  const direct = sceneIdForRegionName(regionName);
  if (direct) return direct;
  const lower = regionName.toLowerCase();
  if (/cinder|kiln|ash|greta|vance|elodie|watchpost/.test(lower)) return "cinderwild";
  if (/moon|coast|salt|beacon|bight|morveth|lyra|kieran|oar/.test(lower)) return "moonlit-coast";
  if (/star|moor|crater|observatory|astronomer|toran|cassian|mina/.test(lower)) return "starfall-moors";
  return "old-lands";
}

export function RegionAtlasThumb({ regionName }: { regionName: string }) {
  const sceneId = sceneIdForAnyRegion(regionName);
  return (
    <div className="atlas-scene-thumb" aria-hidden="true">
      <img
        src={REGION_SCENE_URLS[sceneId]}
        alt=""
        width={192}
        height={108}
        draggable={false}
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}

/** Non-blocking frontier arrival banner shown briefly when crossing into a new region. */
export function RegionTransitionBanner({
  arrival,
  quiet = false,
}: {
  arrival: RegionArrivalState | null;
  quiet?: boolean;
}) {
  if (!arrival || quiet) return null;

  return (
    <div
      key={arrival.id}
      aria-hidden="true"
      className="region-arrival-banner msg-fade pointer-events-none absolute top-24 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-amber-200/25 bg-[#0b0d13]/90 p-2 pr-4 shadow-2xl backdrop-blur-sm"
    >
      <img
        src={REGION_SCENE_URLS[arrival.sceneId]}
        alt=""
        width={96}
        height={54}
        draggable={false}
        className="rounded border border-amber-100/15"
        style={{ imageRendering: "pixelated" }}
      />
      <div className="text-left">
        <div className="font-title text-[9px] uppercase tracking-[0.28em] text-teal-200/75">
          ENTERING FRONTIER
        </div>
        <div className="font-title text-sm tracking-[0.14em] text-amber-50">
          {arrival.title}
        </div>
        <div className="font-serif text-xs italic text-amber-100/70">
          {REGION_EPITHETS[arrival.sceneId]}
        </div>
      </div>
    </div>
  );
}
