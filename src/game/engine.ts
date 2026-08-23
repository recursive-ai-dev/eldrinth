import { TILE, MAP_W, MAP_H } from "./constants";
import type {
  Dir,
  Vec,
  EnemyType,
  ItemType,
  MapData,
  GameCallbacks,
  HudData,
  DialogueData,
} from "./types";
import { generateMap } from "./map";
import { clamp, DIRV } from "./math";
import { renderGame, buildStaticCanvas } from "./render/renderer";

/* ----------------------------- entities ----------------------------- */
export interface Player {
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  dir: Dir;
  speed: number;
  attackTimer: number;
  attackCd: number;
  attackDur: number;
  attacking: boolean;
  swingHit: Set<number>;
  swingDmg: number;
  invuln: number;
  dashTimer: number;
  dashCd: number;
  dashDir: Dir;
  dashing: boolean;
  walkT: number;
  hurtFlash: number;
  kx: number;
  ky: number;
  dying: number;
}
export interface Enemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  vx: number;
  vy: number;
  hurt: number;
  t: number;
  shootCd: number;
  lungeCd: number;
  lungeTimer: number;
  lungeVx: number;
  lungeVy: number;
  burstCd: number;
  summonCd: number;
  wanderA: number;
  bob: number;
  alive: boolean;
  dying: number;
}
export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  dmg: number;
  color: string;
}
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: "spark" | "shard" | "smoke" | "ring";
  rot: number;
}
export interface FloatText {
  x: number;
  y: number;
  vy: number;
  life: number;
  text: string;
  color: string;
  size: number;
}
export interface Item {
  x: number;
  y: number;
  type: ItemType;
  t: number;
  taken: boolean;
}

const ORITHEL_LINES = [
  "You wear the old marks upon your blade... Are you of the Line of Elun? No matter. The living are rare here.",
  "I am Orithel — a Mnemonic. A mind the Elder Elves forged from living light and patient logic, to watch over Ilyarael.",
  "We were shepherds. But when the Elves passed into dust, many of my kin lost their purpose... and Sundered into hunger.",
  "Now the greatest of the Sundered — the Unbound — wakes beneath the Glass Spire, drinking the light of the world.",
  "Three Anima Shards lie scattered across these haunted lands. Gather them to break the ward upon the Spire.",
  "Then end the Unbound's long dreaming — for its sake, and ours. Go, wayfarer. May the old light guide your blade.",
];

/* ----------------------------- the game ----------------------------- */
export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cb: GameCallbacks;
  map!: MapData;
  staticCanvas!: HTMLCanvasElement;
  wardSet = new Set<number>();

  dpr = 1;
  cssW = 800;
  cssH = 600;
  viewW = 800;
  viewH = 600;
  mapPxW = 0;
  mapPxH = 0;

  keys = new Set<string>();
  player!: Player;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  texts: FloatText[] = [];
  items: Item[] = [];
  boss: Enemy | null = null;

  cam = { x: 0, y: 0 };
  time = 0;
  lastT = 0;
  raf = 0;
  running = false;
  paused = false;
  ended = false;

  dialogue: DialogueData | null = null;
  dialogueLines: string[] = [];
  dialogueSpeaker = "";
  dialogueColor = "#bff7ff";

  wardUnlocked = false;
  bossSpawned = false;
  shards = 0;
  totalShards = 3;

  shakeMag = 0;
  lastShakeX = 0;
  lastShakeY = 0;
  message = "";
  messageId = 0;
  prompt = "";
  nextEnemyId = 1;
  advanceLock = 0;
  hudAccum = 0;

  constructor(canvas: HTMLCanvasElement, cb: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cb = cb;
  }

  init() {
    this.map = generateMap();
    this.mapPxW = this.map.width * TILE;
    this.mapPxH = this.map.height * TILE;
    this.wardSet = new Set(this.map.wardTiles);

    buildStaticCanvas(this);

    const s = this.map.spawn;
    this.player = {
      x: s.x,
      y: s.y,
      r: 11,
      hp: 6,
      maxHp: 6,
      dir: "down",
      speed: 152,
      attackTimer: 0,
      attackCd: 0,
      attackDur: 0.2,
      attacking: false,
      swingHit: new Set(),
      swingDmg: 1,
      invuln: 0,
      dashTimer: 0,
      dashCd: 0,
      dashDir: "down",
      dashing: false,
      walkT: 0,
      hurtFlash: 0,
      kx: 0,
      ky: 0,
      dying: 0,
    };

    for (const es of this.map.enemySpawns) {
      const t = this.findWalkableTile(es.x, es.y);
      this.enemies.push(this.makeEnemy(es.type, t.x, t.y));
    }
    for (const sh of this.map.shards)
      this.items.push({ x: sh.x, y: sh.y, type: "shard", t: Math.random() * 6, taken: false });

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("resize", this.onResize);
    this.resize();
    this.centerCam();
    this.message = "Seek the Anima Shards — or speak with the Watcher in the ruins.";
    this.pushHud();
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("resize", this.onResize);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastT = 0;
    this.raf = requestAnimationFrame(this.loop);
  }

  /* ----------------------------- map / collision ----------------------------- */
  findWalkableTile(tx: number, ty: number): Vec {
    for (let r = 0; r < 7; r++) {
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (r > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = tx + dx;
          const y = ty + dy;
          if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
          const i = y * MAP_W + x;
          if (!this.map.solid[i] && !this.wardSet.has(i))
            return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
        }
    }
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  }

  tileAtPx(x: number, y: number): number {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return -1;
    return ty * MAP_W + tx;
  }
  solidAtIdx(i: number): boolean {
    if (i < 0 || i >= this.map.tiles.length) return true;
    if (this.map.solid[i]) return true;
    if (!this.wardUnlocked && this.wardSet.has(i)) return true;
    return false;
  }
  hitsSolid(x: number, y: number, r: number): boolean {
    const pts: [number, number][] = [
      [x - r, y - r],
      [x + r, y - r],
      [x - r, y + r],
      [x + r, y + r],
      [x, y],
    ];
    for (const [px, py] of pts) if (this.solidAtIdx(this.tileAtPx(px, py))) return true;
    return false;
  }
  moveX(e: { x: number; y: number; r: number }, dx: number) {
    const s = Math.sign(dx);
    let rem = Math.abs(dx);
    while (rem > 0) {
      const m = Math.min(2, rem);
      if (!this.hitsSolid(e.x + s * m, e.y, e.r)) e.x += s * m;
      else break;
      rem -= m;
    }
  }
  moveY(e: { x: number; y: number; r: number }, dy: number) {
    const s = Math.sign(dy);
    let rem = Math.abs(dy);
    while (rem > 0) {
      const m = Math.min(2, rem);
      if (!this.hitsSolid(e.x, e.y + s * m, e.r)) e.y += s * m;
      else break;
      rem -= m;
    }
  }
  moveEntity(e: { x: number; y: number; r: number }, dx: number, dy: number) {
    this.moveX(e, dx);
    this.moveY(e, dy);
  }

  /* ----------------------------- entity factory ----------------------------- */
  makeEnemy(type: EnemyType, x: number, y: number): Enemy {
    const e: Enemy = {
      id: this.nextEnemyId++,
      type,
      x,
      y,
      r: 12,
      hp: 3,
      maxHp: 3,
      speed: 60,
      dmg: 1,
      vx: 0,
      vy: 0,
      hurt: 0,
      t: Math.random() * 6,
      shootCd: 1 + Math.random(),
      lungeCd: 0,
      lungeTimer: 0,
      lungeVx: 0,
      lungeVy: 0,
      burstCd: 2.4,
      summonCd: 8,
      wanderA: Math.random() * 6,
      bob: 0,
      alive: true,
      dying: 0,
    };
    if (type === "wraith") {
      e.hp = 3;
      e.maxHp = 3;
      e.speed = 62;
      e.r = 13;
      e.dmg = 1;
    } else if (type === "sentinel") {
      e.hp = 5;
      e.maxHp = 5;
      e.speed = 90;
      e.r = 14;
      e.dmg = 1;
    } else if (type === "adept") {
      e.hp = 4;
      e.maxHp = 4;
      e.speed = 70;
      e.r = 13;
      e.dmg = 1;
    }
    return e;
  }
  spawnBoss() {
    if (this.bossSpawned) return;
    this.bossSpawned = true;
    const c = this.map.bossCenter;
    const b = this.makeEnemy("boss", c.x, c.y);
    b.hp = 42;
    b.maxHp = 42;
    b.r = 26;
    b.speed = 46;
    b.dmg = 2;
    b.burstCd = 2.2;
    b.lungeCd = 3.5;
    this.enemies.push(b);
    this.boss = b;
    this.msg("THE UNBOUND STIRS.");
    this.shake(9);
    this.burst(c.x, c.y, "#39e0ff", 24);
  }

  /* ----------------------------- input ----------------------------- */
  onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (this.ended) return;
    if (k === "p" || k === "escape") {
      if (!this.dialogue) this.togglePause();
      return;
    }
    if (this.paused) return;
    if (this.dialogue) {
      if (k === "e" || k === "enter" || k === " " || k === "j") this.advanceDialogue();
      return;
    }
    this.keys.add(k);
    if (k === " " || k === "j") this.startAttack();
    else if (k === "shift") this.startDash();
    else if (k === "e" || k === "enter") this.tryInteract();
  };
  onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  onBlur = () => {
    this.keys.clear();
  };
  onResize = () => this.resize();

  setPaused(b: boolean) {
    this.paused = b;
    if (b) this.keys.clear();
    this.cb.onPause(b);
  }
  togglePause() {
    this.setPaused(!this.paused);
  }

  /* ----------------------------- main loop ----------------------------- */
  loop = (tNow: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    if (!this.lastT) this.lastT = tNow;
    let dt = (tNow - this.lastT) / 1000;
    this.lastT = tNow;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.05) dt = 0.05;
    this.time += dt;
    if (this.advanceLock > 0) this.advanceLock -= dt;

    if (!this.paused && !this.dialogue && !this.ended) this.update(dt);
    renderGame(this);

    this.hudAccum += dt;
    if (this.hudAccum >= 0.1) {
      this.hudAccum = 0;
      this.pushHud();
    }
  };

  update(dt: number) {
    this.updatePlayer(dt);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dying > 0) {
        e.dying -= dt;
        if (e.dying <= 0) {
          if (e.type === "boss") {
            this.boss = null;
            this.endWin();
          }
          this.enemies.splice(i, 1);
        }
      }
    }
    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.updateItems(dt);
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= 0.92;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    this.shakeMag *= Math.pow(0.0025, dt);
    if (this.shakeMag < 0.05) this.shakeMag = 0;

    const p = this.player;
    const tx = clamp(p.x - this.viewW / 2, 0, Math.max(0, this.mapPxW - this.viewW));
    const ty = clamp(p.y - this.viewH / 2, 0, Math.max(0, this.mapPxH - this.viewH));
    const f = Math.min(1, dt * 8);
    this.cam.x += (tx - this.cam.x) * f;
    this.cam.y += (ty - this.cam.y) * f;

    this.updatePrompt();
  }

  updatePrompt() {
    this.prompt = "";
    if (this.dialogue || this.ended) return;
    const p = this.player;
    const npc = this.map.npc;
    if (Math.hypot(p.x - npc.x, p.y - npc.y) < 48) {
      this.prompt = "Press E to speak with Orithel";
      return;
    }
    for (const s of this.map.signs) {
      const sx = s.x * TILE + TILE / 2;
      const sy = s.y * TILE + TILE / 2;
      if (Math.hypot(p.x - sx, p.y - sy) < 44) {
        this.prompt = "Press E to read";
        return;
      }
    }
  }

  /* ----------------------------- player ----------------------------- */
  updatePlayer(dt: number) {
    const p = this.player;
    if (Math.abs(p.kx) > 1 || Math.abs(p.ky) > 1) this.moveEntity(p, p.kx * dt, p.ky * dt);
    p.kx -= p.kx * Math.min(1, dt * 9);
    p.ky -= p.ky * Math.min(1, dt * 9);

    if (p.dying > 0) {
      p.dying -= dt;
      if (p.dying <= 0 && !this.ended) {
        this.ended = true;
        this.cb.onLose();
      }
      return;
    }
    if (this.ended) return;

    let mx = 0;
    let my = 0;
    const k = this.keys;
    if (k.has("a") || k.has("arrowleft")) mx -= 1;
    if (k.has("d") || k.has("arrowright")) mx += 1;
    if (k.has("w") || k.has("arrowup")) my -= 1;
    if (k.has("s") || k.has("arrowdown")) my += 1;
    if (mx || my) {
      if (Math.abs(mx) >= Math.abs(my)) p.dir = mx > 0 ? "right" : "left";
      else p.dir = my > 0 ? "down" : "up";
    }

    if (p.dashing) {
      p.dashTimer -= dt;
      const [dx, dy] = DIRV[p.dashDir];
      this.moveEntity(p, dx * 520 * dt, dy * 520 * dt);
      p.walkT += dt * 22;
      if (p.dashTimer <= 0) p.dashing = false;
    } else if (mx || my) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      this.moveEntity(p, mx * p.speed * dt, my * p.speed * dt);
      p.walkT += dt * 16;
    }

    p.attackCd = Math.max(0, p.attackCd - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt);

    if (p.attacking) {
      p.attackTimer -= dt;
      this.doAttackHit();
      if (p.attackTimer <= 0) {
        p.attacking = false;
        p.swingHit.clear();
      }
    }

    this.checkPickups();

    if (!this.bossSpawned && this.wardUnlocked) {
      if (Math.hypot(p.x - this.map.bossCenter.x, p.y - this.map.bossCenter.y) < TILE * 5)
        this.spawnBoss();
    }
  }

  startAttack() {
    const p = this.player;
    if (this.ended || p.dying > 0 || p.attacking || p.attackCd > 0 || p.dashing) return;
    p.attacking = true;
    p.attackTimer = p.attackDur;
    p.attackCd = p.attackDur + 0.16;
    p.swingHit.clear();
    p.swingDmg = 1;
  }
  startDash() {
    const p = this.player;
    if (this.ended || p.dying > 0 || p.dashing || p.dashCd > 0) return;
    p.dashing = true;
    p.dashTimer = 0.16;
    p.dashCd = 0.62;
    p.dashDir = p.dir;
    p.invuln = Math.max(p.invuln, 0.2);
    this.burst(p.x, p.y, "rgba(180,220,255,0.8)", 6);
  }

  attackBox(p: Player) {
    const L = 42;
    const Wd = 40;
    switch (p.dir) {
      case "right":
        return { x: p.x, y: p.y - Wd / 2, w: L, h: Wd };
      case "left":
        return { x: p.x - L, y: p.y - Wd / 2, w: L, h: Wd };
      case "down":
        return { x: p.x - Wd / 2, y: p.y, w: Wd, h: L };
      case "up":
        return { x: p.x - Wd / 2, y: p.y - L, w: Wd, h: L };
    }
  }
  rectCircle(b: { x: number; y: number; w: number; h: number }, cx: number, cy: number, cr: number) {
    const nx = Math.max(b.x, Math.min(cx, b.x + b.w));
    const ny = Math.max(b.y, Math.min(cy, b.y + b.h));
    return (cx - nx) ** 2 + (cy - ny) ** 2 < cr * cr;
  }
  doAttackHit() {
    const p = this.player;
    const b = this.attackBox(p);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (p.swingHit.has(e.id)) continue;
      if (this.rectCircle(b, e.x, e.y, e.r + 2)) {
        p.swingHit.add(e.id);
        this.hitEnemy(e, p.swingDmg, p.dir);
      }
    }
  }
  hitEnemy(e: Enemy, dmg: number, dir: Dir) {
    e.hp -= dmg;
    e.hurt = 0.18;
    const f = e.type === "boss" ? 0.25 : 1;
    const [dx, dy] = DIRV[dir];
    e.vx += dx * 430 * f;
    e.vy += dy * 430 * f;
    const hx = e.x - dx * e.r;
    const hy = e.y - dy * e.r;
    this.burst(hx, hy, "#ffe9a8", 8);
    this.addText(hx, hy, String(dmg), "#fff2c2", 14);
    this.shake(e.type === "boss" ? 5 : 3);
    if (e.hp <= 0) this.killEnemy(e);
  }
  killEnemy(e: Enemy) {
    e.alive = false;
    e.dying = e.type === "boss" ? 1.5 : 0.45;
    const col = e.type === "wraith" ? "#8fe6b8" : e.type === "adept" ? "#c08bff" : "#7fd8ff";
    this.shardsBurst(e.x, e.y, col, e.type === "boss" ? 40 : 14);
    if (e.type !== "boss" && Math.random() < 0.28)
      this.items.push({ x: e.x, y: e.y, type: "potion", t: 0, taken: false });
  }

  damagePlayer(dmg: number, fx: number, fy: number) {
    const p = this.player;
    if (p.invuln > 0 || p.dashing || this.ended || p.dying > 0) return;
    p.hp -= dmg;
    p.invuln = 0.9;
    p.hurtFlash = 0.4;
    const a = Math.atan2(p.y - fy, p.x - fx);
    p.kx += Math.cos(a) * 300;
    p.ky += Math.sin(a) * 300;
    this.shake(6);
    this.burst(p.x, p.y, "#ff5a5a", 10);
    if (p.hp <= 0) {
      p.hp = 0;
      p.dying = 0.9;
      this.shake(10);
      this.msg("Your light fades...");
    }
  }

  checkPickups() {
    const p = this.player;
    for (const it of this.items) {
      if (it.taken) continue;
      if (Math.hypot(p.x - it.x, p.y - it.y) < p.r + 15) {
        it.taken = true;
        if (it.type === "shard") {
          this.shards++;
          p.maxHp++;
          p.hp = Math.min(p.maxHp, p.hp + 2);
          this.shardsBurst(it.x, it.y, "#46f0d8", 18);
          this.addText(it.x, it.y, "ANIMA SHARD", "#5ff7df", 16);
          if (this.shards >= this.totalShards) {
            this.wardUnlocked = true;
            this.msg("The ward before the Spire falters. The way opens.");
            this.burst(it.x, it.y, "#46f0d8", 30);
            this.ring(this.map.bossCenter.x, this.map.bossCenter.y, "#46f0d8");
          } else {
            this.msg(`Anima Shard recovered (${this.shards}/${this.totalShards}).`);
          }
        } else {
          const heal = 4;
          p.hp = Math.min(p.maxHp, p.hp + heal);
          this.addText(it.x, it.y, `+${heal}`, "#7fffa0", 14);
          this.msg("You drink the elixir. Wounds knit.");
        }
      }
    }
    this.items = this.items.filter((i) => !i.taken);
  }

  /* ----------------------------- enemies ----------------------------- */
  updateEnemy(e: Enemy, dt: number) {
    e.t += dt;
    if (Math.abs(e.vx) > 1 || Math.abs(e.vy) > 1) this.moveEntity(e, e.vx * dt, e.vy * dt);
    e.vx -= e.vx * Math.min(1, dt * 8);
    e.vy -= e.vy * Math.min(1, dt * 8);
    e.hurt = Math.max(0, e.hurt - dt);
    if (!e.alive) return;

    const p = this.player;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;

    if (e.type === "boss") {
      this.updateBoss(e, dt, dist, ux, uy);
      return;
    }

    let mvx = 0;
    let mvy = 0;
    if (e.type === "wraith") {
      if (dist < 260) {
        mvx = ux * e.speed;
        mvy = uy * e.speed;
      } else {
        e.wanderA += dt;
        mvx = Math.cos(e.wanderA * 0.7) * e.speed * 0.3;
        mvy = Math.sin(e.wanderA * 0.9) * e.speed * 0.3;
      }
      e.bob = Math.sin(e.t * 4) * 3;
    } else if (e.type === "sentinel") {
      if (dist < 320) {
        mvx = ux * e.speed;
        mvy = uy * e.speed;
      }
    } else if (e.type === "adept") {
      e.shootCd -= dt;
      if (dist < 360) {
        if (dist < 168) {
          mvx = -ux * e.speed * 0.95;
          mvy = -uy * e.speed * 0.95;
        } else if (dist > 224) {
          mvx = ux * e.speed * 0.7;
          mvy = uy * e.speed * 0.7;
        } else {
          mvx = -uy * e.speed * 0.55;
          mvy = ux * e.speed * 0.55;
        }
        if (e.shootCd <= 0) {
          e.shootCd = 1.7;
          this.shoot(e.x, e.y, ux, uy, 180, 1, "#b06bff");
        }
      }
    }
    this.moveEntity(e, mvx * dt, mvy * dt);

    if (p.dying <= 0 && p.invuln <= 0 && !p.dashing && dist < e.r + p.r - 2)
      this.damagePlayer(e.dmg, e.x, e.y);
  }

  updateBoss(e: Enemy, dt: number, dist: number, ux: number, uy: number) {
    e.burstCd -= dt;
    e.lungeCd -= dt;
    e.summonCd -= dt;
    let mvx = 0;
    let mvy = 0;
    if (e.lungeTimer > 0) {
      e.lungeTimer -= dt;
      mvx = e.lungeVx;
      mvy = e.lungeVy;
    } else if (dist > 96) {
      mvx = ux * e.speed;
      mvy = uy * e.speed;
    }
    this.moveEntity(e, mvx * dt, mvy * dt);

    if (e.lungeCd <= 0) {
      e.lungeCd = 4.0 + Math.random() * 1.2;
      e.lungeTimer = 0.5;
      e.lungeVx = ux * 380;
      e.lungeVy = uy * 380;
      this.addText(e.x, e.y - 34, "LUNGE", "#ff6a6a", 16);
      this.shake(6);
    }
    if (e.burstCd <= 0) {
      e.burstCd = 2.4;
      this.bossBurst(e);
    }
    if (e.hp / e.maxHp < 0.45 && e.summonCd <= 0) {
      const adds = this.enemies.filter((x) => x.alive && x.type === "wraith").length;
      if (adds < 3) {
        e.summonCd = 6.5;
        this.summonAdd(e);
      } else {
        e.summonCd = 2;
      }
    }

    const p = this.player;
    if (p.dying <= 0 && p.invuln <= 0 && !p.dashing && dist < e.r + p.r - 4)
      this.damagePlayer(e.dmg, e.x, e.y);
  }
  bossBurst(e: Enemy) {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.shoot(e.x, e.y, Math.cos(a), Math.sin(a), 150, 1, "#39e0ff");
    }
    this.shake(5);
    this.addText(e.x, e.y - 34, "BURST", "#7fe0ff", 15);
  }
  summonAdd(e: Enemy) {
    const ang = Math.random() * Math.PI * 2;
    const x = e.x + Math.cos(ang) * 60;
    const y = e.y + Math.sin(ang) * 60;
    const w = this.makeEnemy("wraith", x, y);
    w.shootCd = 0.5;
    this.enemies.push(w);
    this.burst(x, y, "#8fe6b8", 12);
    this.addText(e.x, e.y - 40, "RISE", "#8fe6b8", 15);
  }
  shoot(x: number, y: number, ux: number, uy: number, spd: number, dmg: number, color: string) {
    this.projectiles.push({ x, y, vx: ux * spd, vy: uy * spd, r: 6, life: 3.2, dmg, color });
  }

  updateProjectiles(dt: number) {
    for (const pr of this.projectiles) {
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (this.solidAtIdx(this.tileAtPx(pr.x, pr.y))) {
        pr.life = 0;
        this.burst(pr.x, pr.y, pr.color, 6);
        continue;
      }
      const p = this.player;
      if (p.dying <= 0 && p.invuln <= 0 && !p.dashing) {
        if (Math.hypot(pr.x - p.x, pr.y - p.y) < pr.r + p.r) {
          this.damagePlayer(pr.dmg, pr.x, pr.y);
          pr.life = 0;
          this.burst(pr.x, pr.y, pr.color, 8);
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  updateItems(dt: number) {
    for (const it of this.items) it.t += dt;
  }

  /* ----------------------------- particles / text ----------------------------- */
  burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.3,
        max: 0.6,
        size: 1 + Math.random() * 2,
        color,
        kind: "spark",
        rot: 0,
      });
    }
  }
  shardsBurst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        life: 0.5 + Math.random() * 0.6,
        max: 1.1,
        size: 2 + Math.random() * 3,
        color,
        kind: "shard",
        rot: Math.random() * 6,
      });
    }
  }
  ring(x: number, y: number, color: string) {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 8, color, kind: "ring", rot: 0 });
  }
  addText(x: number, y: number, text: string, color: string, size: number) {
    this.texts.push({ x, y, vy: -30, life: 1.1, text, color, size });
  }
  updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pr = this.particles[i];
      pr.life -= dt;
      if (pr.kind === "spark") {
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        pr.vx *= 0.92;
        pr.vy *= 0.92;
      } else if (pr.kind === "shard") {
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        pr.vy += 260 * dt;
        pr.vx *= 0.99;
        pr.rot += dt * 8;
      } else if (pr.kind === "smoke") {
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        pr.size += dt * 18;
      }
      if (pr.life <= 0) this.particles.splice(i, 1);
    }
  }
  shake(n: number) {
    this.shakeMag = Math.min(10, Math.max(this.shakeMag, n));
  }

  /* ----------------------------- dialogue ----------------------------- */
  openDialogue(lines: string[], speaker: string, color: string) {
    this.dialogueLines = lines;
    this.dialogueSpeaker = speaker;
    this.dialogueColor = color;
    this.dialogue = { speaker, text: lines[0], index: 0, total: lines.length, color };
    this.keys.clear();
    this.cb.onDialogue(this.dialogue);
    this.pushHud();
  }
  advanceDialogue() {
    if (!this.dialogue) return;
    if (this.advanceLock > 0) return;
    this.advanceLock = 0.16;
    this.dialogue.index++;
    if (this.dialogue.index >= this.dialogueLines.length) {
      this.dialogue = null;
      this.cb.onDialogue(null);
      this.pushHud();
    } else {
      this.dialogue = {
        ...this.dialogue,
        text: this.dialogueLines[this.dialogue.index],
      };
      this.cb.onDialogue(this.dialogue);
    }
  }
  tryInteract() {
    const p = this.player;
    const npc = this.map.npc;
    if (Math.hypot(p.x - npc.x, p.y - npc.y) < 48) {
      this.openDialogue(ORITHEL_LINES.slice(), "Orithel, the Last Watcher", "#9ff7e6");
      return;
    }
    for (const s of this.map.signs) {
      const sx = s.x * TILE + TILE / 2;
      const sy = s.y * TILE + TILE / 2;
      if (Math.hypot(p.x - sx, p.y - sy) < 44) {
        this.openDialogue([s.text], "Weathered Carving", "#cdbf9a");
        return;
      }
    }
  }

  endWin() {
    if (this.ended) return;
    this.ended = true;
    this.msg("The Unbound is silenced. Dawn returns to Eldrinth.");
    this.cb.onWin();
  }

  msg(text: string) {
    this.message = text;
    this.messageId++;
    this.pushHud();
  }

  currentObjective(): string {
    if (this.shards < this.totalShards)
      return `Recover the Anima Shards  (${this.shards}/${this.totalShards})`;
    if (!this.wardUnlocked) return "The ward weakens...";
    if (!this.bossSpawned) return "Enter the Glass Spire";
    if (this.boss && this.boss.alive) return "Slay the Unbound";
    return "The Spire falls silent...";
  }
  pushHud() {
    const d: HudData = {
      hp: Math.max(0, Math.ceil(this.player.hp)),
      maxHp: this.player.maxHp,
      shards: this.shards,
      totalShards: this.totalShards,
      objective: this.currentObjective(),
      message: this.message,
      messageId: this.messageId,
      prompt: this.prompt,
      enemies: this.enemies.filter((e) => e.alive && e.type !== "boss").length,
      bossActive: !!(this.boss && this.boss.alive),
      bossHp: this.boss && this.boss.alive ? Math.max(0, this.boss.hp / this.boss.maxHp) : 0,
    };
    this.cb.onHud(d);
  }

  /* ----------------------------- camera / resize ----------------------------- */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(320, Math.floor(rect.width));
    this.cssH = Math.max(240, Math.floor(rect.height));
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(this.cssW * this.dpr);
    this.canvas.height = Math.floor(this.cssH * this.dpr);
    this.viewW = this.cssW;
    this.viewH = this.cssH;
  }
  centerCam() {
    this.cam.x = clamp(this.player.x - this.viewW / 2, 0, Math.max(0, this.mapPxW - this.viewW));
    this.cam.y = clamp(this.player.y - this.viewH / 2, 0, Math.max(0, this.mapPxH - this.viewH));
  }

  objectiveTarget(): { x: number; y: number; kind: "shard" | "boss" } | null {
    const p = this.player;
    let best: Item | null = null;
    let bd = 1e9;
    for (const it of this.items) {
      if (it.type === "shard" && !it.taken) {
        const d = Math.hypot(it.x - p.x, it.y - p.y);
        if (d < bd) {
          bd = d;
          best = it;
        }
      }
    }
    if (best) return { x: best.x, y: best.y, kind: "shard" };
    if (!this.bossSpawned) {
      const c = this.map.bossCenter;
      return { x: c.x, y: c.y, kind: "boss" };
    }
    return null;
  }
}
