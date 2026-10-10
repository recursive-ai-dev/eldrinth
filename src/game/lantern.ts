import { TILE, tileDefinition } from "./constants";
import type { JournalEntry, MapData, SignData, Vec } from "./types";

export const LANTERN_REVEAL_RADIUS = TILE * 4;
export const LANTERN_LIGHT_RADIUS = TILE * 4.5;

export interface LanternRecord extends SignData {
  id: string;
  regionId: string;
  /** Tile coordinates; the plaque never changes terrain or collision. */
  x: number;
  y: number;
  title: string;
  text: string;
  route: string;
}

/** Marginal accounts, deliberately separate from ordinary readable map signs. */
export const LANTERN_RECORDS: readonly LanternRecord[] = [
  {
    id: "arrival-rubbing", regionId: "overworld", x: 22, y: 42,
    title: "The Lamplighter's Margin",
    text: "The printed notice calls this an arrival road. Under the whitewash, another hand has written: RETURN ROAD. We kept the lamps facing west after the last transport left. The office asked who we expected. We gave no names. Names were how they found you.\n\nBelow it, a smaller line: lampblack remembers what lime conceals. Carry a light close to a scraped brass plate. Copy the words before you go.",
    route: "East of this primer, on the arrival road, a scraped brass plate stands before the forest junction. Raise your lantern with R, or the Lantern button, and approach it. Press E to copy the writing into your journal.",
  },
  {
    id: "kiln-margin", regionId: "cinderwild", x: 84, y: 56,
    title: "A Measure Outside the Ledger",
    text: "The ration table has been polished clean. In lamplight, an older tally remains: one cup for each worker; one cup for the person a worker would not name. The extra cups were charged to evaporation.\n\nAn inspector has written ACCEPTABLE LOSS across the sum. Beneath that, in the same lampblack as the tally: They drank. That is the part I am keeping.",
    route: "At the central wayfire, walk east across the pale circle to the scraped brass ration plate. Its writing answers a raised lantern. The road continues east beyond it.",
  },
  {
    id: "tide-margin", regionId: "moonlit-coast", x: 76, y: 56,
    title: "The Boat That Was Not Entered",
    text: "A maintenance plate lists the depth of the western shoal. The lantern finds a second notation between the figures: a flat-bottomed boat can cross here with the lamps covered. Two trips before dawn. Leave the oars under the steps.\n\nThe harbour copy records no departures that night. Someone has scratched a reply below the official seal: good.",
    route: "A brass sounding plate stands west of the central wayfire, still inside the pale circle. Hold lamplight to its salt-scraped face. The covered-boat account was never meant for the harbour ledger.",
  },
  {
    id: "star-margin", regionId: "starfall-moors", x: 80, y: 52,
    title: "An Unauthorised Interval",
    text: "The calibration plate requires continuous attention. Under its enamel, someone marked an interval of eleven minutes and left the instrument running without an observer.\n\nThe attached reprimand calls this a failure of vigilance. The hidden hand calls it supper. She ate outside. She watched the ordinary dark between the stars. For eleven minutes the machine had no account of her.",
    route: "North of the central wayfire, a scraped calibration plate faces the open sky from inside the pale circle. Raise your lantern beside it to read what the enamel covered.",
  },
];

export function lanternRecordForRegion(regionId: string): LanternRecord | undefined {
  return LANTERN_RECORDS.find(record => record.regionId === regionId);
}

export function lanternPosition(record: LanternRecord): Vec {
  return { x: record.x * TILE + TILE / 2, y: record.y * TILE + TILE / 2 };
}

/** Both the inscription drawing and interaction use this exact visibility rule. */
export function lanternReveals(record: LanternRecord, player: Vec, map: MapData, lit: boolean): boolean {
  if (!lit) return false;
  const end = lanternPosition(record);
  const distance = Math.hypot(end.x - player.x, end.y - player.y);
  if (distance >= LANTERN_REVEAL_RADIUS) return false;
  const steps = Math.max(1, Math.ceil(distance / (TILE / 4)));
  for (let i = 0; i <= steps; i++) {
    const x = Math.floor((player.x + (end.x - player.x) * i / steps) / TILE);
    const y = Math.floor((player.y + (end.y - player.y) * i / steps) / TILE);
    if (x < 0 || y < 0 || x >= map.width || y >= map.height || tileDefinition(map.tiles[y * map.width + x]).shape === "solid") return false;
  }
  return true;
}

/** Record once in the existing saveable journal; grants no stats or quest facts. */
export function copyLanternRecord(journal: JournalEntry[], record: LanternRecord, source: string): boolean {
  const id = `lamplight:${record.id}`;
  if (journal.some(entry => entry.id === id)) return false;
  journal.push({ id, title: record.title, text: `${record.text}\n\n${record.route}`, source });
  return true;
}

/** Add directions to an existing notice; preserve its evidence and position. */
export function addLanternDirections(regionId: string, signs: SignData[]): void {
  const record = lanternRecordForRegion(regionId);
  if (!record) return;
  const guide = signs.find(sign => regionId === "overworld" ? sign.title === "A Traveller's Primer" : sign.title?.endsWith(" Survey"));
  if (guide && !guide.text.includes(record.route)) guide.text += `\n\n${record.route}`;
}
