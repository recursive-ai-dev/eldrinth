import { TILE, MAP_W, MAP_H } from "./constants";
import type {
  Dir,
  Vec,
  EnemyType,
  Difficulty,
  MapData,
  GameCallbacks,
  DialogueData,
  RegionExit,
} from "./types";
import { clamp, DIRV } from "./math";
import { preloadGameSprites, renderGame, TileChunkRenderer } from "./render/renderer";
import { FixedStepLoop } from "./core/FixedStepLoop";
import {
  WorldState,
  type EnemyState,
  type ItemState,
  type PlayerState,
  type ProjectileState,
  type WorldSnapshot,
} from "./core/WorldState";
import { createRegionRepository, type RegionRepository } from "./regions";
import type { EndingId } from "./core/SceneStack";
import { QUESTS, learnFact, canResolve, questKnown, questJournal, resolveQuest } from "./quests";
import { AISystem } from "./systems/AISystem";
import { CombatSystem } from "./systems/CombatSystem";
import { GameFlowSystem } from "./systems/GameFlowSystem";
import { InputSystem } from "./systems/InputSystem";
import { MovementSystem } from "./systems/MovementSystem";

/* ----------------------------- constants ----------------------------- */
// Player constants
const PLAYER_RADIUS = 11;
const PLAYER_START_HP = 6;
const PLAYER_MAX_STAMINA = 100;
const PLAYER_DASH_STAMINA_COST = 35;
const PLAYER_STAMINA_REGEN = 28;
const PLAYER_STAMINA_REGEN_DELAY = 0.45;
const PLAYER_SPEED = 152;
const PLAYER_ATTACK_DURATION = 0.2;
const PLAYER_ATTACK_COOLDOWN = 0.16;
const PLAYER_ATTACK_DAMAGE = 1;
const PLAYER_DASH_DURATION = 0.16;
const PLAYER_DASH_COOLDOWN = 0.62;
const PLAYER_DASH_SPEED = 520;
const PLAYER_INVULN_DASH = 0.2;
const PLAYER_INVULN_HIT = 0.9;
const PLAYER_HURT_FLASH = 0.4;

// Enemy constants
const ENEMY_DEFAULT_RADIUS = 12;
const ENEMY_DEFAULT_HP = 3;
const ENEMY_DEFAULT_SPEED = 60;
const ENEMY_DEFAULT_DAMAGE = 1;

// Wraith specific
const WRATH_RADIUS = 13;
const WRATH_HP = 3;
const WRATH_SPEED = 62;
const WRATH_DAMAGE = 1;

// Sentinel specific
const SENTINEL_RADIUS = 14;
const SENTINEL_HP = 5;
const SENTINEL_SPEED = 90;
const SENTINEL_DAMAGE = 1;

// Adept specific
const ADEPT_RADIUS = 13;
const ADEPT_HP = 4;
const ADEPT_SPEED = 70;
const ADEPT_DAMAGE = 1;

// Boss specific (The Unbound)
// Nine shards raise the player's ceiling; the final encounter is tuned to be
// a finale instead of evaporating under the extra exploration rewards.
const BOSS_HP = 96;
const BOSS_RADIUS = 26;
const BOSS_SPEED = 46;
const BOSS_DAMAGE = 2;
const BOSS_BURST_COOLDOWN = 2.2;
const BOSS_LUNGE_COOLDOWN = 3.5;

const DIFFICULTY_TUNING = {
  story: { hp: 0.65, damage: 0.6, speed: 0.74, awareness: 0.6, playerHealth: 2, hitInvulnerability: 1.25 },
  standard: { hp: 1, damage: 1, speed: 1, awareness: 1, playerHealth: 0, hitInvulnerability: PLAYER_INVULN_HIT },
  brutal: { hp: 1.45, damage: 1.5, speed: 1.08, awareness: 1.08, playerHealth: 0, hitInvulnerability: 0.78 },
} as const;

// Interaction distances
const INTERACT_NPC_DISTANCE = 48;
const INTERACT_SIGN_DISTANCE = 44;

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
export type Player = PlayerState;
export type Enemy = EnemyState;
export type Projectile = ProjectileState;
export type Item = ItemState;

const ORITHEL_LINES = [
  "You wear the old marks upon your blade... Are you of the Line of Elun? No matter. The living are rare here.",
  "I am Orithel — a Mnemonic. A mind the Elder Elves forged from living light and patient logic, to watch over Ilyarael.",
  "We were shepherds. But when the Elves passed into dust, many of my kin lost their purpose... and Sundered into hunger.",
  "Now the greatest of the Sundered — the Unbound — wakes beneath the Glass Spire, drinking the light of the world.",
  "The first Spire is only a husk. The Unbound withdrew east, beyond Moonfall Reach, and braided a new ward from nine Anima Shards.",
  "Three shards rest in the Old Lands. Two lie in the Cinderwild, two on Moonlit Coast, and two in the Starfall Moors. Read the road markers in the southern ash country to find the frontier roads.",
  "Do not rush the final gate. Search the ruins, follow the broken roads, and let each shard answer your blade. Then end the Unbound's long dreaming — for its sake, and ours.",
  "Go, wayfarer. May the old light guide your blade.",
];

/* ----------------------------- the game ----------------------------- */
export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cb: GameCallbacks;
  /** The sole authority for saveable simulation data. */
  readonly world = new WorldState();
  tileRenderer!: TileChunkRenderer;

  dpr = 1;
  cssW = 800;
  cssH = 600;
  viewW = 800;
  viewH = 600;
  mapPxW = 0;
  mapPxH = 0;

  input = new InputSystem();
  combat = new CombatSystem();
  ai = new AISystem();
  flow = new GameFlowSystem();
  private readonly regions: RegionRepository;
  private regionAbort = new AbortController();
  /** Dynamic inhabitants are retained per region, while static terrain stays cached by RegionRepository. */
  private changingRegion = false;
  private regionGateCooldown = 0;
  journalOpen = false;
  private initPromise: Promise<void> | null = null;
  private destroyed = false;
  private readonly gameLoop = new FixedStepLoop({
    simulate: (stepSeconds) => this.simulateStep(stepSeconds),
    render: () => renderGame(this),
    onError: (error) => console.error("Game loop error:", error),
  });
  movement = new MovementSystem({
    width: MAP_W,
    height: MAP_H,
    wardTiles: new Set<number>(),
    wardUnlocked: false,
    tileAt: () => undefined,
  });
  particles: Particle[] = [];
  texts: FloatText[] = [];

  cam = { x: 0, y: 0 };
  paused = false;
  ended = false;
  initialized = false;

  dialogueLines: string[] = [];
  dialogueSpeaker = "";
  dialogueColor = "#bff7ff";

  shakeMag = 0;
  lastShakeX = 0;
  lastShakeY = 0;
  prompt = "";
  advanceLock = 0;
  hudAccum = 0;

  constructor(canvas: HTMLCanvasElement, cb: GameCallbacks, regions = createRegionRepository(), options?: { difficulty?: Difficulty }) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to create Canvas 2D context - browser may not support Canvas");
    }
    this.ctx = ctx;
    this.cb = cb;
    this.regions = regions;
    this.world.difficulty = options?.difficulty ?? "standard";
  }

  // These accessors preserve the existing system APIs while making `world`
  // the only backing store for gameplay and save data.
  get map(): MapData { return this.world.map; }
  set map(value: MapData) { this.world.map = value; }
  get wardSet() { return this.world.wardSet; }
  set wardSet(value: Set<number>) { this.world.wardSet = value; }
  get player(): Player { return this.world.player; }
  set player(value: Player) { this.world.player = value; }
  get enemies(): Enemy[] { return this.world.enemies; }
  set enemies(value: Enemy[]) { this.world.enemies = value; }
  get projectiles(): Projectile[] { return this.world.projectiles; }
  set projectiles(value: Projectile[]) { this.world.projectiles = value; }
  get items(): Item[] { return this.world.items; }
  set items(value: Item[]) { this.world.items = value; }
  get boss(): Enemy | null { return this.world.boss; }
  set boss(value: Enemy | null) { this.world.boss = value; }
  get time() { return this.world.simulationTime; }
  get dialogue(): DialogueData | null { return this.world.dialogue; }
  set dialogue(value: DialogueData | null) { this.world.dialogue = value; }
  get wardUnlocked() { return this.world.wardUnlocked; }
  set wardUnlocked(value: boolean) { this.world.wardUnlocked = value; }
  get bossSpawned() { return this.world.bossSpawned; }
  set bossSpawned(value: boolean) { this.world.bossSpawned = value; }
  get shards() { return this.world.shards; }
  set shards(value: number) { this.world.shards = value; }
  get totalShards() { return this.world.totalShards; }
  set totalShards(value: number) { this.world.totalShards = value; }
  get message() { return this.world.message; }
  set message(value: string) { this.world.message = value; }
  get messageId() { return this.world.messageId; }
  set messageId(value: number) { this.world.messageId = value; }
  get nextEnemyId() { return this.world.nextEnemyId; }
  set nextEnemyId(value: number) { this.world.nextEnemyId = value; }

  init(): Promise<void> {
    if (this.initialized) return Promise.resolve();
    if (!this.initPromise) this.initPromise = this.initialize();
    return this.initPromise;
  }

  private async initialize() {
    try {
      const spriteLoad = preloadGameSprites();
      const region = await this.regions.acquire(this.world.regionId, this.regionAbort.signal);
      if (this.destroyed) {
        this.regions.release(region.id);
        return;
      }
      this.map = region.map;
      this.mapPxW = this.map.width * TILE;
      this.mapPxH = this.map.height * TILE;
      this.wardSet = new Set(this.map.wardTiles);
      this.syncMovementSystem();

      await spriteLoad;
      this.tileRenderer = new TileChunkRenderer(this.map);

      const s = this.map.spawn;
      const startingHealth = PLAYER_START_HP + DIFFICULTY_TUNING[this.world.difficulty].playerHealth;
      this.player = {
        x: s.x,
        y: s.y,
        r: PLAYER_RADIUS,
        hp: startingHealth,
        maxHp: startingHealth,
        stamina: PLAYER_MAX_STAMINA,
        maxStamina: PLAYER_MAX_STAMINA,
        staminaRegenDelay: 0,
        dir: "down",
        speed: PLAYER_SPEED,
        attackTimer: 0,
        attackCd: 0,
        attackDur: PLAYER_ATTACK_DURATION,
        attacking: false,
        swingHit: new Set(),
        swingDmg: PLAYER_ATTACK_DAMAGE,
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
        relics: [],
        dashCostDiscount: 0,
        attackBonus: 0,
      };

      this.restoreOrPopulateRegion();

      this.input.bind({
        onKeyDown: this.onKeyDown,
        onKeyUp: this.onKeyUp,
        onBlur: this.onBlur,
      });
      window.addEventListener("resize", this.onResize);
      this.resize();
      this.centerCam();
      this.tileRenderer.warm(this.cam, this.viewW, this.viewH);
      this.message = "Seek the Anima Shards — or speak with the Watcher in the ruins.";
      this.publishJournal();
      this.pushHud();
      this.initialized = true;
    } catch (e) {
      this.initialized = false;
      this.enemies = [];
      this.projectiles = [];
      this.particles = [];
      this.texts = [];
      this.items = [];
      this.destroy();
      throw e;
    }
  }

  private restoreOrPopulateRegion() {
    const stored = this.world.regions[this.world.regionId];
    if (stored) {
      this.enemies = stored.enemies;
      this.items = stored.items;
      this.boss = stored.enemies.find((enemy) => enemy.id === stored.bossId) ?? null;
      this.bossSpawned = stored.bossSpawned;
      return;
    }
    this.enemies = [];
    this.items = [];
    this.projectiles = [];
    this.boss = null;
    this.bossSpawned = false;
    for (const es of this.map.enemySpawns) {
      const t = this.findWalkableTile(es.x, es.y);
      const enemy = this.makeEnemy(es.type, t.x, t.y);
      if (es.elite) {
        enemy.elite = true;
        enemy.hp = Math.ceil(enemy.hp * 2.25);
        enemy.maxHp = enemy.hp;
        enemy.speed *= 1.12;
        enemy.dmg += 1;
      }
      this.enemies.push(enemy);
    }
    for (const shard of this.map.shards)
      this.items.push({ x: shard.x, y: shard.y, type: "shard", t: this.world.nextRandom() * 6, taken: false });
    this.rememberRegion();
  }

  private rememberRegion() {
    this.world.regions[this.world.regionId] = { enemies: this.enemies, items: this.items, bossId: this.boss?.id ?? null, bossSpawned: this.bossSpawned };
  }

  private async changeRegion(exit: RegionExit) {
    if (this.changingRegion || this.destroyed) return;
    this.changingRegion = true;
    const previousId = this.world.regionId;
    try {
      const region = await this.regions.acquire(exit.targetRegion, this.regionAbort.signal);
      if (this.destroyed) { this.regions.release(region.id); return; }
      this.rememberRegion();
      this.regions.release(previousId);
      this.world.regionId = region.id;
      this.map = region.map;
      this.mapPxW = this.map.width * TILE;
      this.mapPxH = this.map.height * TILE;
      this.wardSet = new Set(this.map.wardTiles);
      this.syncMovementSystem();
      this.restoreOrPopulateRegion();
      this.projectiles = [];
      this.particles = [];
      this.texts = [];
      this.player.x = exit.destination.x;
      this.player.y = exit.destination.y;
      this.tileRenderer = new TileChunkRenderer(this.map);
      this.centerCam();
      this.tileRenderer.warm(this.cam, this.viewW, this.viewH);
      this.regionGateCooldown = 1.25;
      this.msg(`You arrive in ${this.map.regionName}.`);
      this.pushHud();
    } catch (error) {
      if (!this.destroyed) console.error("Region transition failed:", error);
    } finally {
      this.changingRegion = false;
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.initialized = false;
    this.regionAbort.abort();
    this.gameLoop.stop();
    this.input.destroy();
    window.removeEventListener("resize", this.onResize);
    if (this.world.map) this.regions.release(this.world.regionId);
  }

  start() {
    if (!this.initialized || this.destroyed) return;
    this.gameLoop.start();
  }

  saveWorld(): WorldSnapshot {
    this.rememberRegion();
    return this.world.snapshot();
  }

  /** Restores saveable simulation state into the already acquired region. */
  loadWorld(snapshot: WorldSnapshot) {
    if (!this.initialized) throw new Error("Initialize the game before loading a world snapshot.");
    if (snapshot.regionId !== this.world.regionId) {
      throw new Error(`Region ${snapshot.regionId} must be acquired before loading its world snapshot.`);
    }
    this.world.restore(snapshot);
    this.rememberRegion();
    this.publishJournal();
    this.wardSet = new Set(this.map.wardTiles);
    this.syncMovementSystem();
    this.centerCam();
    this.pushHud();
  }

  /* ----------------------------- map / collision ----------------------------- */
  findWalkableTile(tx: number, ty: number): Vec {
    // Search in expanding rings using Chebyshev distance (max of x,y distance)
    // This ensures we find the closest walkable tile
    for (let r = 0; r < 7; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          // Only check tiles at exactly Chebyshev distance r (the perimeter)
          // Inner tiles were checked in previous iterations
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = tx + dx;
          const y = ty + dy;
          if (x < 0 || y < 0 || x >= this.map.width || y >= this.map.height) continue;
          const i = y * this.map.width + x;
          if (!this.solidAtIdx(i))
            return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
        }
      }
    }
    // Fallback to original position if no walkable tile found
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  }

  syncMovementSystem() {
    this.movement = new MovementSystem({
      width: this.map.width,
      height: this.map.height,
      wardTiles: this.wardSet,
      wardUnlocked: this.wardUnlocked,
      tileAt: (tx: number, ty: number) => {
        if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return undefined;
        return this.map.tiles[ty * this.map.width + tx];
      },
    });
  }

  tileAtPx(x: number, y: number): number {
    return this.movement.tileAtPx(x, y);
  }
  solidAtIdx(i: number): boolean {
    return this.movement.solidAtIdx(i);
  }
  hitsSolid(x: number, y: number, r: number): boolean {
    return this.movement.hitsSolid(x, y, r);
  }
  moveX(e: { x: number; y: number; r: number }, dx: number) {
    this.movement.moveX(e, dx);
  }
  moveY(e: { x: number; y: number; r: number }, dy: number) {
    this.movement.moveY(e, dy);
  }
  moveEntity(e: { x: number; y: number; r: number }, dx: number, dy: number) {
    this.movement.moveEntity(e, dx, dy);
  }

  /* ----------------------------- entity factory ----------------------------- */
  makeEnemy(type: EnemyType, x: number, y: number): Enemy {
    const e: Enemy = {
      id: this.nextEnemyId++,
      type,
      x,
      y,
      r: ENEMY_DEFAULT_RADIUS,
      hp: ENEMY_DEFAULT_HP,
      maxHp: ENEMY_DEFAULT_HP,
      speed: ENEMY_DEFAULT_SPEED,
      dmg: ENEMY_DEFAULT_DAMAGE,
      vx: 0,
      vy: 0,
      hurt: 0,
      t: this.world.nextRandom() * 6,
      shootCd: 1 + this.world.nextRandom(),
      lungeCd: 0,
      lungeTimer: 0,
      lungeVx: 0,
      lungeVy: 0,
      burstCd: 2.4,
      summonCd: 8,
      telegraph: null,
      telegraphTimer: 0,
      wanderA: this.world.nextRandom() * 6,
      bob: 0,
      alive: true,
      dying: 0,
    };
    if (type === "wraith") {
      e.hp = WRATH_HP;
      e.maxHp = WRATH_HP;
      e.speed = WRATH_SPEED;
      e.r = WRATH_RADIUS;
      e.dmg = WRATH_DAMAGE;
    } else if (type === "sentinel") {
      e.hp = SENTINEL_HP;
      e.maxHp = SENTINEL_HP;
      e.speed = SENTINEL_SPEED;
      e.r = SENTINEL_RADIUS;
      e.dmg = SENTINEL_DAMAGE;
    } else if (type === "adept") {
      e.hp = ADEPT_HP;
      e.maxHp = ADEPT_HP;
      e.speed = ADEPT_SPEED;
      e.r = ADEPT_RADIUS;
      e.dmg = ADEPT_DAMAGE;
    }
    const tuning = DIFFICULTY_TUNING[this.world.difficulty];
    e.hp = Math.max(1, Math.ceil(e.hp * tuning.hp));
    e.maxHp = e.hp;
    e.dmg = Math.max(1, Math.round(e.dmg * tuning.damage));
    e.speed *= tuning.speed;
    return e;
  }
  spawnBoss() {
    if (this.bossSpawned) return;
    this.bossSpawned = true;
    const c = this.map.bossCenter;
    const b = this.makeEnemy("boss", c.x, c.y);
    b.hp = BOSS_HP;
    b.maxHp = BOSS_HP;
    b.r = BOSS_RADIUS;
    b.speed = BOSS_SPEED;
    b.dmg = BOSS_DAMAGE;
    const tuning = DIFFICULTY_TUNING[this.world.difficulty];
    b.hp = Math.ceil(b.hp * tuning.hp);
    b.maxHp = b.hp;
    b.dmg = Math.max(1, Math.round(b.dmg * tuning.damage));
    b.speed *= tuning.speed;
    b.burstCd = BOSS_BURST_COOLDOWN;
    b.lungeCd = BOSS_LUNGE_COOLDOWN;
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
  };
  onKeyUp = (_e: KeyboardEvent) => undefined;
  onBlur = () => undefined;
  onResize = () => this.resize();

  setPaused(b: boolean) {
    this.paused = b;
    if (b) this.input.clear();
    this.syncMovementSystem();
    this.cb.onPause(b);
  }
  setJournalOpen(open: boolean) {
    this.journalOpen = open;
    this.input.clear();
  }
  togglePause() {
    this.setPaused(!this.paused);
  }

  /* ----------------------- fixed simulation pipeline ----------------------- */
  /**
   * Ordered once per 1/60 s tick:
   * input commands → player → AI/enemy motion → entity cleanup → projectiles
   * → items → presentation effects → camera → UI projection.
   * Rendering is deliberately outside this method.
   */
  simulateStep(dt: number) {
    this.processInputCommands();
    if (!this.paused && !this.journalOpen && !this.changingRegion && !this.dialogue && !this.ended) {
      this.world.simulationTime += dt;
      this.world.tick++;
      this.update(dt);
    }
    if (this.advanceLock > 0) this.advanceLock = Math.max(0, this.advanceLock - dt);
    this.hudAccum += dt;
    if (this.hudAccum >= 0.1) {
      this.hudAccum = 0;
      this.pushHud();
    }
  }

  private processInputCommands() {
    if (this.journalOpen || this.changingRegion) return;
    if (this.input.consumePressed("escape") || this.input.consumePressed("p")) {
      if (!this.dialogue && !this.ended) this.togglePause();
      return;
    }
    if (this.paused || this.ended) return;
    if (this.dialogue) {
      if (this.dialogue.choices) {
        for (let i = 0; i < this.dialogue.choices.length; i++) {
          if (this.input.consumePressed(String(i + 1))) { this.chooseDialogue(this.dialogue.choices[i].id); break; }
        }
        return;
      }
      if (this.input.consumePressed("e") || this.input.consumePressed("enter") || this.input.consumePressed(" ") || this.input.consumePressed("j")) {
        this.advanceDialogue();
      }
      return;
    }
    if (this.input.consumePressed(" ") || this.input.consumePressed("j")) this.startAttack();
    else if (this.input.consumePressed("shift")) this.startDash();
    else if (this.input.consumePressed("e") || this.input.consumePressed("enter")) this.tryInteract();
  }

  private update(dt: number) {
    this.regionGateCooldown = Math.max(0, this.regionGateCooldown - dt);
    this.updatePlayer(dt);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dying > 0) {
        e.dying -= dt;
        if (e.dying <= 0) {
          if (e.type === "boss") {
            this.boss = null;
            this.endRun("silence");
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
    const deadzoneX = Math.min(112, this.viewW * 0.2);
    const deadzoneY = Math.min(80, this.viewH * 0.16);
    const centerX = this.cam.x + this.viewW / 2;
    const centerY = this.cam.y + this.viewH / 2;
    const desiredX = p.x < centerX - deadzoneX ? p.x + deadzoneX - this.viewW / 2
      : p.x > centerX + deadzoneX ? p.x - deadzoneX - this.viewW / 2 : this.cam.x;
    const desiredY = p.y < centerY - deadzoneY ? p.y + deadzoneY - this.viewH / 2
      : p.y > centerY + deadzoneY ? p.y - deadzoneY - this.viewH / 2 : this.cam.y;
    const tx = clamp(desiredX, 0, Math.max(0, this.mapPxW - this.viewW));
    const ty = clamp(desiredY, 0, Math.max(0, this.mapPxH - this.viewH));
    const f = 1 - Math.exp(-8 * dt);
    this.cam.x += (tx - this.cam.x) * f;
    this.cam.y += (ty - this.cam.y) * f;

    this.updatePrompt();
  }

  updatePrompt() {
    if (this.dialogue || this.ended) {
      this.prompt = "";
      return;
    }
    this.prompt = this.flow.updatePrompt({
      player: this.player,
      enemies: this.enemies,
      boss: this.boss,
      shards: this.shards,
      totalShards: this.totalShards,
      wardUnlocked: this.wardUnlocked,
      bossSpawned: this.bossSpawned,
      message: this.message,
      messageId: this.messageId,
      prompt: this.prompt,
      dialogue: this.dialogue,
      map: this.map,
      items: this.items,
    });
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
        if (this.world.checkpoint) this.respawnAtCheckpoint();
        else {
          this.ended = true;
          this.cb.onEnd("spent");
        }
      }
      return;
    }
    if (this.ended) return;

    let mx = 0;
    let my = 0;
    const k = this.input.keys;
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
      this.moveEntity(p, dx * PLAYER_DASH_SPEED * dt, dy * PLAYER_DASH_SPEED * dt);
      p.walkT += dt * 22;
      if (p.dashTimer <= 0) p.dashing = false;
    } else if (mx || my) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      this.moveEntity(p, mx * p.speed * dt, my * p.speed * dt);
      p.walkT += dt * 16;
    } else {
      // Generated walk sheets reserve frame zero as the neutral pose. Reset
      // the phase while stationary so the player does not freeze mid-stride.
      p.walkT = 0;
    }

    p.attackCd = Math.max(0, p.attackCd - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.staminaRegenDelay = Math.max(0, p.staminaRegenDelay - dt);
    if (p.staminaRegenDelay <= 0 && !p.dashing) {
      p.stamina = Math.min(p.maxStamina, p.stamina + PLAYER_STAMINA_REGEN * dt);
    }
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

    if (this.regionGateCooldown <= 0 && !this.changingRegion) {
      const exit = this.map.exits.find((gate) => Math.hypot(p.x - (gate.x * TILE + TILE / 2), p.y - (gate.y * TILE + TILE / 2)) < TILE * 1.35);
      if (exit) void this.changeRegion(exit);
    }

    if (this.world.regionId === "overworld" && !this.changingRegion && !this.bossSpawned && this.wardUnlocked) {
      if (Math.hypot(p.x - this.map.bossCenter.x, p.y - this.map.bossCenter.y) < TILE * 5)
        this.spawnBoss();
    }
  }

  startAttack() {
    const p = this.player;
    if (this.ended || p.dying > 0 || p.attacking || p.attackCd > 0 || p.dashing) return;
    p.attacking = true;
    p.attackTimer = p.attackDur;
    p.attackCd = p.attackDur + PLAYER_ATTACK_COOLDOWN;
    p.swingHit.clear();
    p.swingDmg = PLAYER_ATTACK_DAMAGE + p.attackBonus;
  }
  startDash() {
    const p = this.player;
    const dashCost = Math.max(10, PLAYER_DASH_STAMINA_COST - p.dashCostDiscount);
    if (this.ended || p.dying > 0 || p.dashing || p.dashCd > 0 || p.stamina < dashCost) return;
    p.dashing = true;
    p.dashTimer = PLAYER_DASH_DURATION;
    p.dashCd = PLAYER_DASH_COOLDOWN;
    p.stamina -= dashCost;
    p.staminaRegenDelay = PLAYER_STAMINA_REGEN_DELAY;
    p.dashDir = p.dir;
    p.invuln = Math.max(p.invuln, PLAYER_INVULN_DASH);
    this.burst(p.x, p.y, "rgba(180,220,255,0.8)", 6);
  }

  attackBox(p: Player) {
    return this.combat.attackBox(p);
  }
  rectCircle(b: { x: number; y: number; w: number; h: number }, cx: number, cy: number, cr: number) {
    return this.combat.rectCircle(b, cx, cy, cr);
  }
  doAttackHit() {
    const p = this.player;
    this.combat.resolvePlayerSwing(p, this.enemies, (enemy, dmg, dir) => this.hitEnemy(enemy as Enemy, dmg, dir));
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
    if (e.type !== "boss" && this.world.nextRandom() < 0.28)
      this.items.push({ x: e.x, y: e.y, type: "potion", t: 0, taken: false });
    if (e.elite) {
      if (learnFact(this.world.quests, `warden:${this.world.regionId}`)) this.publishJournal();
      this.items.push({ x: e.x + 12, y: e.y, type: "potion", t: 0, taken: false });
      this.items.push({ x: e.x - 12, y: e.y, type: "potion", t: 0, taken: false });
      this.addText(e.x, e.y - 32, "WARDEN FALLEN", "#ffd36b", 15);
      this.msg("The region's warden has fallen. A wayfire answers in the distance.");
    }
  }

  damagePlayer(dmg: number, fx: number, fy: number) {
    const p = this.player;
    if (p.invuln > 0 || p.dashing || this.ended || p.dying > 0) return;
    p.hp -= dmg;
    p.invuln = DIFFICULTY_TUNING[this.world.difficulty].hitInvulnerability;
    p.hurtFlash = PLAYER_HURT_FLASH;
    const a = Math.atan2(p.y - fy, p.x - fx);
    p.kx += Math.cos(a) * 300;
    p.ky += Math.sin(a) * 300;
    this.shake(6);
    this.burst(p.x, p.y, "#ff5a5a", 10);
    if (p.hp <= 0) {
      p.hp = 0;
      p.dying = PLAYER_INVULN_HIT;
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
            this.syncMovementSystem();
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
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].taken) {
        this.items.splice(i, 1);
      }
    }
  }

  /* ----------------------------- enemies ----------------------------- */
  updateEnemy(e: Enemy, dt: number) {
    if (Math.abs(e.vx) > 1 || Math.abs(e.vy) > 1) this.moveEntity(e, e.vx * dt, e.vy * dt);
    e.vx -= e.vx * Math.min(1, dt * 8);
    e.vy -= e.vy * Math.min(1, dt * 8);
    e.hurt = Math.max(0, e.hurt - dt);
    if (!e.alive) return;

    const p = this.player;
    this.ai.updateEnemy(e, dt, {
      player: p,
      onShoot: (x, y, ux, uy, speed, damage, color) => this.shoot(x, y, ux, uy, speed, damage, color),
      onBossBurst: (enemy) => this.bossBurst(enemy as Enemy),
      onSummonAdd: (enemy) => {
        const adds = this.enemies.filter((x) => x.alive && x.type === "wraith").length;
        if (adds < 3) this.summonAdd(enemy as Enemy);
        else (enemy as Enemy).summonCd = 2;
      },
      onDamagePlayer: (damage, fx, fy) => this.damagePlayer(damage, fx, fy),
      onText: (x, y, text, color, size) => this.addText(x, y, text, color, size),
      onShake: (mag) => this.shake(mag),
      random: () => this.world.nextRandom(),
      engagementMultiplier: DIFFICULTY_TUNING[this.world.difficulty].awareness,
    });

    this.moveEntity(e, e.vx * dt, e.vy * dt);
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
    const ang = this.world.nextRandom() * Math.PI * 2;
    const x = e.x + Math.cos(ang) * 60;
    const y = e.y + Math.sin(ang) * 60;
    const w = this.makeEnemy("wraith", x, y);
    w.shootCd = 0.5;
    this.enemies.push(w);
    this.burst(x, y, "#8fe6b8", 12);
    this.addText(e.x, e.y - 40, "RISE", "#8fe6b8", 15);
  }
  shoot(x: number, y: number, ux: number, uy: number, spd: number, dmg: number, color: string) {
    const scale = this.world.difficulty === "story" ? 0.7 : this.world.difficulty === "brutal" ? 1.5 : 1;
    this.projectiles.push({ x, y, vx: ux * spd, vy: uy * spd, r: 6, life: 3.2, dmg: Math.max(1, Math.ceil(dmg * scale)), color });
  }

  updateProjectiles(dt: number) {
    this.combat.processProjectiles(
      this.projectiles,
      this.player,
      dt,
      (pr) => {
        if (this.solidAtIdx(this.tileAtPx(pr.x, pr.y))) {
          this.burst(pr.x, pr.y, pr.color, 6);
          return true;
        }
        return false;
      },
      (pr) => {
        this.damagePlayer(pr.dmg, pr.x, pr.y);
        this.burst(pr.x, pr.y, pr.color, 8);
      },
      (pr) => {
        this.burst(pr.x, pr.y, pr.color, 6);
      },
    );
  }

  updateItems(dt: number) {
    for (const it of this.items) it.t += dt;
  }

  /* ----------------------------- particles / text ----------------------------- */
  burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = this.world.nextRandom() * Math.PI * 2;
      const sp = 40 + this.world.nextRandom() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.3 + this.world.nextRandom() * 0.3,
        max: 0.6,
        size: 1 + this.world.nextRandom() * 2,
        color,
        kind: "spark",
        rot: 0,
      });
    }
  }
  shardsBurst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = this.world.nextRandom() * Math.PI * 2;
      const sp = 30 + this.world.nextRandom() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        life: 0.5 + this.world.nextRandom() * 0.6,
        max: 1.1,
        size: 2 + this.world.nextRandom() * 3,
        color,
        kind: "shard",
        rot: this.world.nextRandom() * 6,
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
  private publishJournal() {
    this.cb.onJournal([...this.world.journal, ...questJournal(this.world.quests)]);
  }

  addPersonalNote(text: string) {
    const trimmed = text.trim().slice(0, 1200);
    if (!trimmed) return;
    this.world.journal.push({ id: `personal:${this.world.tick}:${this.world.journal.length}`, title: "My observations", text: trimmed, source: this.map.regionName });
    this.publishJournal();
  }

  private openWatcherTopics() {
    const resolved = Object.keys(this.world.quests.resolutions).length;
    this.openDialogue([resolved ? `You have brought ${resolved === 1 ? "one lost story" : `${resolved} lost stories`} back to these halls. What else should we remember?` : "The roads remember more than I do. Ask about what troubles you; bring back what you find, and we will decide what it means."], "Orithel, the Last Watcher", "#9ff7e6");
    this.dialogue!.choices = [
      { id: "spire", label: "The Unbound and the nine shards" },
      ...QUESTS.map((quest) => ({ id: `quest:${quest.id}`, label: `${quest.title}${this.world.quests.resolutions[quest.id] ? " · remembered" : canResolve(this.world.quests, quest) ? " · discuss discoveries" : ""}` })),
      { id: "leave", label: "Farewell" },
    ];
    this.cb.onDialogue({ ...this.dialogue! });
  }

  chooseDialogue(id: string) {
    if (!this.dialogue?.choices?.some((choice) => choice.id === id)) return;
    this.input.clear();
    if (id === "leave") {
      this.dialogue = null;
      this.cb.onDialogue(null);
      return;
    }
    if (id === "topics") { this.openWatcherTopics(); return; }
    if (id === "spire") {
      if (learnFact(this.world.quests, "spire")) {
        this.world.journal.push({ id: "orithel:spire", title: "The Unbound Spire", text: ORITHEL_LINES.slice(3, 7).join(" "), source: "Orithel · Ilyarael" });
        this.publishJournal();
      }
      this.openDialogue(ORITHEL_LINES.slice(), "Orithel, the Last Watcher", "#9ff7e6");
      return;
    }
    if (id.startsWith("quest:")) {
      const quest = QUESTS.find((entry) => entry.id === id.slice(6));
      if (!quest) return;
      learnFact(this.world.quests, `lead:${quest.id}`);
      this.publishJournal();
      const resolution = quest.choices.find((entry) => entry.id === this.world.quests.resolutions[quest.id]);
      const evidence = quest.evidence.filter(({ fact }) => this.world.quests.facts.includes(fact));
      const text = resolution?.text ?? (canResolve(this.world.quests, quest)
        ? `${evidence.map((entry) => entry.text).join(" ")} What do you ask of me?`
        : `${quest.lead}${questKnown(this.world.quests, quest) && evidence.length ? ` You have learned this: ${evidence.map((entry) => entry.text).join(" ")}` : ""}`);
      this.openDialogue([text], "Orithel · " + quest.title, "#9ff7e6");
      this.dialogue!.choices = [
        ...(canResolve(this.world.quests, quest) ? quest.choices.map((choice) => ({ id: `resolve:${quest.id}:${choice.id}`, label: choice.label })) : []),
        { id: "topics", label: "Ask about something else" },
        { id: "leave", label: "Leave the decision for now" },
      ];
      this.cb.onDialogue({ ...this.dialogue! });
      return;
    }
    const [, questId, choiceId] = id.split(":");
    const choice = resolveQuest(this.world.quests, questId, choiceId);
    if (!choice) return;
    const p = this.player;
    if (choice.reward) {
      const { stat, amount } = choice.reward;
      if (stat === "health") { p.maxHp += amount; p.hp = Math.min(p.maxHp, p.hp + amount); }
      if (stat === "stamina") { p.maxStamina += amount; p.stamina = p.maxStamina; }
      if (stat === "blade") p.attackBonus += amount;
      if (stat === "dash") p.dashCostDiscount += amount;
    }
    this.publishJournal();
    this.openDialogue([choice.text], "Orithel, the Last Watcher", "#9ff7e6");
    this.msg("Your decision has been recorded in the journal.");
  }

  openDialogue(lines: string[], speaker: string, color: string) {
    this.dialogueLines = lines;
    this.dialogueSpeaker = speaker;
    this.dialogueColor = color;
    this.dialogue = { speaker, text: lines[0], index: 0, total: lines.length, color };
    this.input.clear();
    this.cb.onDialogue(this.dialogue);
    this.pushHud();
  }
  advanceDialogue() {
    if (!this.dialogue) return;
    if (this.dialogue.choices) return;
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
    const fire = this.map.campfires.find((campfire) => Math.hypot(p.x - campfire.x, p.y - campfire.y) < 52);
    if (fire) {
      this.restAtCampfire(fire);
      return;
    }
    const npc = this.map.npc;
    if (Math.hypot(p.x - npc.x, p.y - npc.y) < INTERACT_NPC_DISTANCE) {
      this.openWatcherTopics();
      return;
    }
    for (const s of this.map.signs) {
      const sx = s.x * TILE + TILE / 2;
      const sy = s.y * TILE + TILE / 2;
      if (Math.hypot(p.x - sx, p.y - sy) < INTERACT_SIGN_DISTANCE) {
        this.discoverNote(s);
        this.openDialogue([s.text], s.title ?? "Unmarked Field Note", "#cdbf9a");
        return;
      }
    }
  }

  private discoverNote(sign: import("./types").SignData) {
    if (sign.fact) learnFact(this.world.quests, sign.fact);
    const id = `${this.world.regionId}:${sign.x}:${sign.y}`;
    if (!this.world.journal.some((entry) => entry.id === id)) this.world.journal.push({ id, title: sign.title ?? "Unmarked Field Note", text: sign.text, source: this.map.regionName });
    this.publishJournal();
    this.msg("A note has been copied into your journal. Press L to read it.");
  }

  private restAtCampfire(fire: import("./types").CampfireData) {
    const p = this.player;
    this.world.checkpoint = { regionId: this.world.regionId, x: fire.x, y: fire.y, name: fire.name };
    p.hp = p.maxHp;
    p.stamina = p.maxStamina;
    if (!p.relics.includes(fire.relic)) {
      p.relics.push(fire.relic);
      const rewards = {
        emberheart: () => { p.maxHp += 2; p.hp = p.maxHp; return "EMBERHEART — maximum health +2"; },
        ashstep: () => { p.dashCostDiscount += 12; return "ASHSTEP — dash stamina cost -12"; },
        tidewell: () => { p.maxStamina += 25; p.stamina = p.maxStamina; return "TIDEWELL — maximum stamina +25"; },
        starblade: () => { p.attackBonus += 1; return "STARBLADE — blade damage +1"; },
      } as const;
      const reward = rewards[fire.relic]();
      this.burst(fire.x, fire.y, "#ffbf66", 20);
      this.openDialogue([`The flames recognize you. ${reward}.`, "This wayfire is now your refuge. Death will return you here, and resting restores your strength."], fire.name, "#ffd28a");
    } else {
      this.msg(`${fire.name} restores your strength.`);
      this.burst(fire.x, fire.y, "#ffbf66", 10);
    }
  }

  private respawnAtCheckpoint() {
    const point = this.world.checkpoint;
    if (!point) return;
    const p = this.player;
    p.dying = 0;
    p.hp = p.maxHp;
    p.stamina = p.maxStamina;
    p.invuln = 1.5;
    p.kx = 0;
    p.ky = 0;
    p.dashing = false;
    p.attacking = false;
    p.swingHit.clear();
    this.projectiles = [];
    if (point.regionId === this.world.regionId) {
      p.x = point.x;
      p.y = point.y;
      this.centerCam();
      this.msg(`The wayfire draws you back: ${point.name}.`);
      return;
    }
    void this.changeRegion({ x: 0, y: 0, targetRegion: point.regionId, destination: { x: point.x, y: point.y }, label: point.name });
  }

  endRun(ending: EndingId) {
    if (this.ended) return;
    this.ended = true;
    if (ending === "silence") this.msg("The Unbound stops. All of it, at once.");
    this.cb.onEnd(ending);
  }

  msg(text: string) {
    this.message = text;
    this.messageId++;
    this.pushHud();
  }

  currentObjective(): string {
    return this.flow.currentObjective({
      player: this.player,
      enemies: this.enemies,
      boss: this.boss,
      shards: this.shards,
      totalShards: this.totalShards,
      wardUnlocked: this.wardUnlocked,
      bossSpawned: this.bossSpawned,
      message: this.message,
      messageId: this.messageId,
      prompt: this.prompt,
      dialogue: this.dialogue,
      map: this.map,
      items: this.items,
    });
  }
  pushHud() {
    this.cb.onHud(
      this.flow.buildHud({
        player: this.player,
        enemies: this.enemies,
        boss: this.boss,
        shards: this.shards,
        totalShards: this.totalShards,
        wardUnlocked: this.wardUnlocked,
        bossSpawned: this.bossSpawned,
        message: this.message,
        messageId: this.messageId,
        prompt: this.prompt,
        dialogue: this.dialogue,
        map: this.map,
        items: this.items,
      }),
    );
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
    if (this.initialized) {
      this.cam.x = clamp(this.cam.x, 0, Math.max(0, this.mapPxW - this.viewW));
      this.cam.y = clamp(this.cam.y, 0, Math.max(0, this.mapPxH - this.viewH));
      this.tileRenderer.warm(this.cam, this.viewW, this.viewH);
    }
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
