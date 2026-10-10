import { TILE } from "../constants";
import { EXPEDITION_SITES, type ExpeditionSite } from "../encounters";
import type { MapData } from "../types";

/** Authored site notes identify the prop even when rendering a cached map. */
export function expeditionOnMap(map: MapData): ExpeditionSite | undefined {
  return EXPEDITION_SITES.find((site) => map.signs.some((sign) => sign.title === site.name && sign.x === site.x));
}

/** Small world-space silhouettes use the existing palette and tile materials. */
export function drawExpeditionLandmark(ctx: CanvasRenderingContext2D, site: ExpeditionSite, time: number): void {
  const x = site.x * TILE + TILE / 2, y = site.y * TILE + TILE / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.beginPath(); ctx.ellipse(0, 8, 32, 11, 0, 0, Math.PI * 2); ctx.fill();
  if (site.kind === "refuge") {
    ctx.strokeStyle = "#657852";
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-35, 2); ctx.quadraticCurveTo(-31, -65, 0, -46); ctx.quadraticCurveTo(31, -65, 35, 2); ctx.stroke();
    ctx.fillStyle = "#828878";
    ctx.beginPath(); ctx.ellipse(0, 0, 21, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#90bab0";
    ctx.beginPath(); ctx.ellipse(0, -3, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d6c19a"; ctx.fillRect(18, 3, 6, 5);
  } else if (site.kind === "crossing") {
    ctx.fillStyle = "#53493f"; ctx.fillRect(-21, -19, 42, 27);
    ctx.fillStyle = "#a89979";
    ctx.beginPath(); ctx.ellipse(0, -19, 21, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#7f9e99";
    ctx.beginPath(); ctx.ellipse(0, -20, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#d3bb87"; ctx.lineWidth = 2;
    for (let line = 0; line < 3; line++) { ctx.beginPath(); ctx.moveTo(-12, -9 + line * 5); ctx.lineTo(9 - line * 3, -9 + line * 5); ctx.stroke(); }
  } else if (site.kind === "arena") {
    ctx.fillStyle = "#6e6957"; ctx.fillRect(-24, -6, 48, 16);
    ctx.fillStyle = "#ac9662"; ctx.fillRect(-19, -28, 38, 23);
    ctx.strokeStyle = "#e2c58b"; ctx.lineWidth = 2; ctx.strokeRect(-19, -28, 38, 23);
    ctx.fillStyle = "#5e5948";
    for (let i = 0; i < 4; i++) ctx.fillRect(-13, -22 + i * 4, 25 - i * 3, 1);
    ctx.strokeStyle = "#9e946e"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-39, -2); ctx.lineTo(-39, -56); ctx.lineTo(39, -56); ctx.lineTo(39, -2); ctx.stroke();
    ctx.fillStyle = "#849999"; ctx.fillRect(-12, -53, 24, 8);
  } else {
    const pulse = 0.45 + Math.sin(time * 5.2) * 0.12;
    ctx.strokeStyle = `rgba(197,169,238,${pulse})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, TILE * 3, TILE * 3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#8d819d"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-24, 4); ctx.lineTo(-18, -58); ctx.lineTo(18, -58); ctx.lineTo(24, 4); ctx.stroke();
    ctx.strokeStyle = "#d7c4a0"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -58); ctx.lineTo(0, -40); ctx.stroke();
    ctx.fillStyle = "#bbabd0";
    ctx.beginPath(); ctx.moveTo(-15, -17); ctx.quadraticCurveTo(-11, -41, 0, -41); ctx.quadraticCurveTo(11, -41, 15, -17); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#51465c"; ctx.fillRect(-17, -18, 34, 5);
    ctx.fillStyle = "#edddff"; ctx.fillRect(-2, -15, 4, 7);
  }
  ctx.restore();
}
