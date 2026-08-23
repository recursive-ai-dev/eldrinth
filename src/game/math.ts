import type { Dir } from "./types";

export function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}

export function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x + w, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

export function hash2(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (Math.imul(h ^ (h >>> 13), 1274126177)) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const DIRV: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export const DIRA: Record<Dir, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};
