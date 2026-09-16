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
  NpcData,
  NpcPortrait,
} from "./types";
import { clamp, DIRV } from "./math";
import { CAMERA_ZOOM, preloadGameSprites, renderGame, TileChunkRenderer } from "./render/renderer";
import { FixedStepLoop } from "./core/FixedStepLoop";
import {
  WorldState,
  type EnemyState,
  type ItemState,
  type PlayerState,
  type ProjectileState,
  type WorldSnapshot,
} from "./core/WorldState";
import type { EndingId } from "./core/SceneStack";
import { createRegionRepository, type RegionRepository } from "./regions";
import { isInteriorRegion } from "./map";
import { applyHarvestCost, fortressShardIntakeEntry, fortressWardenEntry, shardBleedEntry, shardPickupMessage, wardDialogue, wardenFact, wardUnlockMessage } from "./escalation";
import { hazardDamageAt } from "./hazard";
import { QUESTS, TOWN_PROJECTS, canCompleteTownProject, completeTownProject, learnFact, canResolve, questKnown, questJournal, resolveQuest, settlementState, townProjectComplete, townProjects } from "./quests";
import { AISystem } from "./systems/AISystem";
import { CombatSystem } from "./systems/CombatSystem";
import { GameFlowSystem } from "./systems/GameFlowSystem";
import { InputSystem } from "./systems/InputSystem";
import { MovementSystem } from "./systems/MovementSystem";

/* ----------------------------- constants ----------------------------- */
// Player constants
const PLAYER_RADIUS = 11;
const PLAYER_START_HP = 18;
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

const ORITHEL_PORTRAIT: NpcPortrait = {
  id: "orithel-the-last-watcher",
  description: "A composed elder elf rendered in pale teal light, with a severe gold-and-ivory collar, long white hair floating as if underwater, and a fractured Spire halo behind him.",
};

const NPC_ROLE_LABEL: Record<NpcData["role"], string> = {
  lore: "LOREKEEPER · TESTIMONY",
  healer: "HEALER · SANCTUARY SERVICE",
  scout: "SCOUT · ROUTE & RUMOUR",
  merchant: "TRADER · PROVISIONS",
};

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
  "You wear the old marks upon your blade. Are you of the Line of Elun? No matter — the living are rare here, and I have learned not to ask twice.",
  "I am Orithel. A Mnemonic: a mind the Elder Elves drew out of living light and set to watch over Ilyarael, when they could no longer watch it themselves.",
  "We were shepherds once. When the Elves passed into dust a great many of my kin lost their purpose and Sundered into hunger. You will have met them on the roads by now.",
  "The greatest of the Sundered — the Unbound — wakes beneath the Glass Spire, and it is drinking the light of this world a swallow at a time.",
  "The first Spire is a husk. The Unbound withdrew east past Moonfall Reach and braided a new ward from nine Anima Shards. Nine exactly. A tidy number, and it was settled on long before either of us arrived.",
  "Three shards lie in the Old Lands. Two in the Cinderwild, two on Moonlit Coast, two in the Starfall Moors. Read the markers in the southern ash country and they will give you the frontier roads.",
  "Do not rush the final gate. Walk the ruins, let each shard answer your blade, and bring the yield back to me. I will keep it safe until the ninth.",
  "Go, wayfarer. The old light has been very patient. So have I.",
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
  /** Set when the player dies somewhere whose half-cleared state must not persist. */
  private discardCurrentRegion = false;
  private regionGateCooldown = 0;
  /** Town services that have been used since entering this region. Cleared on region change. */
  private usedTownServices = new Set<string>();
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
  /** Choices to attach once the player reaches the final line of the dialogue currently opening. */
  pendingChoices: { id: string; label: string }[] | null = null;

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
  get settlementStates() { return this.map.towns.map((town) => settlementState(this.world.quests, town.id, this.shards)); }
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
    if (this.discardCurrentRegion) {
      delete this.world.regions[this.world.regionId];
      this.discardCurrentRegion = false;
      return;
    }
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
      this.cb.onInterior(isInteriorRegion(region.id));
      this.map = region.map;
      this.usedTownServices.clear();
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
    this.cb.onInterior(isInteriorRegion(this.world.regionId));
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
    const tx = clamp(desiredX, this.cameraMinX(), this.cameraMaxX());
    const ty = clamp(desiredY, this.cameraMinY(), this.cameraMaxY());
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
        if (this.world.checkpoint) {
          if (this.map.resetOnDeath) this.discardCurrentRegion = true;
          this.respawnAtCheckpoint();
        }
        else this.endRun("spent");
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

    const standingOn = this.movement.tileAtPx(p.x, p.y);
    if (standingOn >= 0) {
      const harm = hazardDamageAt(this.map.tiles[standingOn], p.invuln);
      if (harm > 0) {
        p.hp -= harm;
        p.invuln = DIFFICULTY_TUNING[this.world.difficulty].hitInvulnerability;
        p.hurtFlash = 0.35;
        this.addText(p.x, p.y, `-${harm}`, "#ff8a5c", 13);
        if (p.hp <= 0) p.dying = PLAYER_INVULN_HIT;
      }
    }

    this.checkPickups();

    if (this.regionGateCooldown <= 0 && !this.changingRegion) {
      const exit = this.map.exits.find((gate) => !gate.requiresInteraction && Math.hypot(p.x - (gate.x * TILE + TILE / 2), p.y - (gate.y * TILE + TILE / 2)) < TILE * 1.35);
      if (exit) void this.changeRegion(exit);
    }

    if (this.world.regionId === "overworld" && !this.changingRegion && !this.bossSpawned && this.wardUnlocked && !this.dialogue && !this.ended) {
      if (Math.hypot(p.x - this.map.bossCenter.x, p.y - this.map.bossCenter.y) < TILE * 5)
        this.openWardChoice();
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
      if (learnFact(this.world.quests, wardenFact(this.world.regionId))) this.publishJournal();
      this.items.push({ x: e.x + 12, y: e.y, type: "potion", t: 0, taken: false });
      this.items.push({ x: e.x - 12, y: e.y, type: "potion", t: 0, taken: false });
      this.addText(e.x, e.y - 32, "WARDEN FALLEN", "#ffd36b", 15);
      this.msg("The region's warden has fallen. A wayfire answers in the distance.");
      if (this.world.regionId.startsWith("fortress.")) {
        const entry = fortressWardenEntry(this.world.regionId);
        if (entry && !this.world.journal.some((existing) => existing.id === entry.id)) {
          this.world.journal.push(entry);
          this.publishJournal();
          this.msg("A note has been copied into your journal. Press L to read it.");
        }
      }
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
          const harvested = applyHarvestCost(p.maxHp, p.hp, this.shards);
          p.maxHp = harvested.maxHp;
          p.hp = harvested.hp;
          this.shardsBurst(it.x, it.y, "#46f0d8", 18);
          this.addText(it.x, it.y, "ANIMA SHARD", "#5ff7df", 16);
          const bleed = shardBleedEntry(this.shards);
          if (bleed && !this.world.journal.some((entry) => entry.id === bleed.id)) {
            this.world.journal.push(bleed);
            this.publishJournal();
          }
          if (this.world.regionId.startsWith("fortress.")) {
            const intake = fortressShardIntakeEntry(this.world.regionId);
            if (intake && !this.world.journal.some((entry) => entry.id === intake.id)) {
              this.world.journal.push(intake);
              this.publishJournal();
            }
            // The reliquary's mirrors are one half of Barris's investigation.
            // Record the discovery even if the player meets him only later.
            if (this.world.regionId === "fortress.old-lands-reliquary" && learnFact(this.world.quests, "pilgrim-reflection")) {
              this.publishJournal();
            }
          }
          if (this.shards >= this.totalShards) {
            this.wardUnlocked = true;
            this.syncMovementSystem();
            this.msg(wardUnlockMessage(this.shards));
            this.burst(it.x, it.y, "#46f0d8", 30);
            this.ring(this.map.bossCenter.x, this.map.bossCenter.y, "#46f0d8");
          } else {
            this.msg(shardPickupMessage(this.shards, this.totalShards));
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

  private playerInTownSafeZone(): boolean {
    for (const town of this.map.towns) {
      const projectBonus = townProjects(town.id)
        .filter((project) => townProjectComplete(this.world.quests, project.id))
        .reduce((bonus, project) => bonus + project.safeRadiusBonus, 0);
      if (Math.hypot(this.player.x - town.x, this.player.y - town.y) < town.safeRadius + projectBonus) return true;
    }
    return false;
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
      engagementMultiplier: this.playerInTownSafeZone() ? 0 : DIFFICULTY_TUNING[this.world.difficulty].awareness,
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
    this.openDialogue([resolved ? `You have brought ${resolved === 1 ? "one account" : `${resolved} accounts`} back into this hall, and the record is the better for it. What else should we settle?` : "The roads keep better records than I do. Ask about whatever troubles you, bring back what you find, and we will decide together what it meant."], "Orithel, the Last Watcher", "#9ff7e6", ORITHEL_PORTRAIT, "THE LAST WATCHER · INVESTIGATIONS");
    this.dialogue!.choices = [
      { id: "spire", label: "The Unbound and the nine shards" },
      ...QUESTS.map((quest) => ({ id: `quest:${quest.id}`, label: `${quest.title}${this.world.quests.resolutions[quest.id] ? " · remembered" : canResolve(this.world.quests, quest) ? " · discuss discoveries" : ""}` })),
      { id: "leave", label: "Farewell" },
    ];
    this.cb.onDialogue({ ...this.dialogue! });
  }

  private openTownProjects(townId: string) {
    const town = this.map.towns.find((entry) => entry.id === townId);
    const projects = townProjects(townId);
    if (!town || projects.length === 0) return;
    this.openDialogue(
      [
        `${town.name}'s notice board is written in three hands. Each request has been left open because no one here can spare the people to finish it.`,
      ],
      `${town.name} Notice Board`,
      "#d7b978",
      undefined,
      "LOCAL REQUESTS · TOWN PROJECTS",
    );
    this.dialogue!.choices = [
      ...projects.map((project) => ({
        id: `project:${project.id}`,
        label: `${project.title}${townProjectComplete(this.world.quests, project.id) ? " · completed" : canCompleteTownProject(this.world.quests, project) ? " · ready" : " · request"}`,
      })),
      { id: "leave", label: "Leave the requests for now" },
    ];
    this.cb.onDialogue({ ...this.dialogue! });
  }

  private openWardChoice() {
    const { lines, choices } = wardDialogue();
    this.pendingChoices = choices;
    this.openDialogue(lines, "Orithel, the Architect", "#9ff7e6", ORITHEL_PORTRAIT, "THE ARCHITECT · FINAL AUDIENCE");
  }

  chooseDialogue(id: string) {
    if (!this.dialogue?.choices?.some((choice) => choice.id === id)) return;
    this.input.clear();
    if (id === "leave") {
      this.dialogue = null;
      this.pendingChoices = null;
      this.cb.onDialogue(null);
      return;
    }
    if (id === "topics") { this.openWatcherTopics(); return; }
    if (id === "ending:surrender") {
      this.dialogue = null;
      this.pendingChoices = null;
      this.cb.onDialogue(null);
      this.spawnBoss();
      return;
    }
    if (id === "ending:refuse") {
      this.dialogue = null;
      this.pendingChoices = null;
      this.cb.onDialogue(null);
      this.endRun("refusal");
      return;
    }
    if (id.startsWith("project:")) {
      const projectId = id.slice("project:".length);
      const project = TOWN_PROJECTS.find((entry) => entry.id === projectId);
      if (!project) return;
      if (townProjectComplete(this.world.quests, project.id)) {
        this.openDialogue([`${project.title} is done. The road beyond the sanctuary is quieter now, and people have started using it again.`], "Town Notice Board", "#d7b978");
        return;
      }
      if (!canCompleteTownProject(this.world.quests, project)) {
        const missing = project.requirements.filter((fact) => !this.world.quests.facts.includes(fact));
        this.openDialogue([project.request, `The request is still waiting on: ${missing.join(", ")}.`], "Town Notice Board", "#d7b978");
        return;
      }
      const completed = completeTownProject(this.world.quests, project.id);
      if (!completed) return;
      const p = this.player;
      const { stat, amount } = completed.reward;
      if (stat === "health") { p.maxHp += amount; p.hp = Math.min(p.maxHp, p.hp + amount); }
      if (stat === "stamina") { p.maxStamina += amount; p.stamina = p.maxStamina; }
      if (stat === "blade") p.attackBonus += amount;
      if (stat === "dash") p.dashCostDiscount += amount;
      this.publishJournal();
      this.openDialogue([`${completed.title} is complete. The sanctuary reaches farther along the road now. ${completed.reward.stat === "health" ? `Maximum health +${amount}.` : completed.reward.stat === "stamina" ? `Maximum stamina +${amount}.` : completed.reward.stat === "blade" ? `Blade damage +${amount}.` : `Dash cost −${amount}.`}`], "Town Notice Board", "#d7b978");
      this.msg("Town project completed. The settlement has changed.");
      return;
    }
    if (id === "spire") {
      if (learnFact(this.world.quests, "spire")) {
        this.world.journal.push({ id: "orithel:spire", title: "The Unbound Spire", text: ORITHEL_LINES.slice(3, 7).join(" "), source: "Orithel · Ilyarael" });
        this.publishJournal();
      }
      this.openDialogue(ORITHEL_LINES.slice(), "Orithel, the Last Watcher", "#9ff7e6", ORITHEL_PORTRAIT, "THE LAST WATCHER · TESTIMONY");
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
      this.openDialogue([text], "Orithel · " + quest.title, "#9ff7e6", ORITHEL_PORTRAIT, "THE LAST WATCHER · INVESTIGATION");
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
    this.openDialogue([choice.text], "Orithel, the Last Watcher", "#9ff7e6", ORITHEL_PORTRAIT, "THE LAST WATCHER · DECISION");
    this.msg("Your decision has been recorded in the journal.");
  }

  openDialogue(lines: string[], speaker: string, color: string, portrait?: NpcPortrait, roleLabel?: string) {
    // Consume any choices staged for THIS dialogue (set by the caller just before
    // this call). A single-line dialogue attaches them immediately, matching the
    // previous behaviour for every existing choices-bearing caller. A multi-line
    // dialogue defers them back into pendingChoices until advanceDialogue reaches
    // the final line, so the lines carrying the actual content are reachable.
    const stagedChoices = this.pendingChoices;
    this.pendingChoices = null;
    this.dialogueLines = lines;
    this.dialogueSpeaker = speaker;
    this.dialogueColor = color;
    this.dialogue = { speaker, text: lines[0], index: 0, total: lines.length, color, portrait, roleLabel };
    if (stagedChoices) {
      if (lines.length - 1 === 0) this.dialogue.choices = stagedChoices;
      else this.pendingChoices = stagedChoices;
    }
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
      this.pendingChoices = null;
      this.cb.onDialogue(null);
      this.pushHud();
    } else {
      this.dialogue = {
        ...this.dialogue,
        text: this.dialogueLines[this.dialogue.index],
      };
      if (this.pendingChoices && this.dialogue.index === this.dialogueLines.length - 1) {
        this.dialogue.choices = this.pendingChoices;
        this.pendingChoices = null;
      }
      this.cb.onDialogue(this.dialogue);
    }
  }
  tryInteract() {
    const p = this.player;
    const doorway = this.map.exits.find((exit) => exit.requiresInteraction && Math.hypot(p.x - (exit.x * TILE + TILE / 2), p.y - (exit.y * TILE + TILE / 2)) < INTERACT_SIGN_DISTANCE);
    if (doorway) {
      void this.changeRegion(doorway);
      return;
    }
    const fire = this.map.campfires.find((campfire) => Math.hypot(p.x - campfire.x, p.y - campfire.y) < 52);
    if (fire) {
      this.restAtCampfire(fire);
      return;
    }
    const townNpc = this.map.npcs.find((npc) => Math.hypot(p.x - npc.x, p.y - npc.y) < INTERACT_NPC_DISTANCE);
    if (townNpc) {
      this.speakWithTownNpc(townNpc);
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
        if (s.townId) {
          this.openTownProjects(s.townId);
          return;
        }
        this.discoverNote(s);
        this.openDialogue([s.text], s.title ?? "Unmarked Field Note", "#cdbf9a");
        return;
      }
    }
  }

  private openNpcDialogue(npc: NpcData, lines: string[]) {
    const reaction = typeof (this as any).townReaction === "function" ? this.townReaction(npc.id) : null;
    this.openDialogue(reaction ? [...lines, reaction] : lines, npc.name, npc.color, npc.portrait, NPC_ROLE_LABEL[npc.role]);
  }

  private townReaction(npcId: string): string | null {
    const townId = npcId.startsWith("town:ilyarael:")
      ? "ilyarael-township"
      : npcId.startsWith("town:cinderwild:")
        ? "cinder-haven"
        : npcId.startsWith("town:moonlit:")
          ? "oarsmans-bight"
          : npcId.startsWith("town:starfall:")
            ? "crater-watch"
            : null;
    if (!townId) return null;
    const state = this.settlementStates.find((entry) => entry.townId === townId);
    if (!state) return null;
    if (state.guarded) return "The watch has doubled. Six shards make every road look like an approach, and we will not be caught waiting again.";
    if (state.completedProjects > 0) return `The town is different since the work was finished. ${state.refugees ? `${state.refugees} newcomers have found a place by our lamps.` : "People have started using the road again."}`;
    if (state.refugees > 0) return `${state.refugees} people came in behind you from the frontier. We have put them near the lamps and told them the sanctuary is real.`;
    if (this.world.quests.facts.length > 2) return "The records are moving faster now. Every account you bring back gives the town one more thing it can name aloud.";
    if (this.shards > 0) return "The shard-light reaches this far. We have begun leaving a lamp lit after dusk, in case someone else comes home carrying one.";
    return null;
  }

  private speakWithTownNpc(npc: NpcData) {
    const used = this.usedTownServices.has(npc.id);
    if (npc.role === "healer") {
      const healerLines: Record<string, { heal: string[]; exhausted: string }> = {
        "town:ilyarael:healer": {
          heal: [
            "Lay your palms upon the stones. The wound is only memory trying to take form. Let me have it.",
            "Your wounds close. Mirene carries the ache away beneath her bandages.",
          ],
          exhausted: "I have done what I can for you this visit. The road will do the rest.",
        },
        "town:cinderwild:healer": {
          heal: [
            "Hold still. The sulfur will sting, but it draws the ash-heat out of your blood before it settles into your lungs.",
            "Your wounds close. The kiln's warmth settles into your limbs.",
          ],
          exhausted: "Save your strength, pilgrim. The embers will wait for no one.",
        },
        "town:moonlit:healer": {
          heal: [
            "Let the brine wash over the cuts. Salt cleans what fire cannot burn away.",
            "Your wounds close. The sea's chill numbs your pain.",
          ],
          exhausted: "The tide comes in, the tide goes out. You have had your share of the water today.",
        },
        "town:starfall:healer": {
          heal: [
            "The moss that grows beneath meteorite slabs drinks starlight. Drink this brew down slowly.",
            "Your wounds close. Your breath steadies under the quiet crater.",
          ],
          exhausted: "The kettle is dry until the next nightfall. Walk softly.",
        },
      };
      const lines = healerLines[npc.id] ?? {
        heal: ["Your wounds close. The sanctuary's warmth restores you."],
        exhausted: "I have done what I can for you this visit. The road will do the rest.",
      };
      if (used) {
        this.openNpcDialogue(npc, [lines.exhausted]);
      } else {
        this.usedTownServices.add(npc.id);
        this.player.hp = this.player.maxHp;
        this.burst(npc.x, npc.y, npc.color, 14);
        this.openNpcDialogue(npc, lines.heal);
      }
      return;
    }

    if (npc.role === "scout") {
      const entry = this.townScoutEntry(npc.id);
      const questId = this.scoutQuestId(npc.id);
      if (!used) {
        this.usedTownServices.add(npc.id);
        const started = questId ? learnFact(this.world.quests, `lead:${questId}`) : false;
        if (entry && !this.world.journal.some((existing) => entry.id === existing.id)) this.world.journal.push(entry);
        if (entry || started) this.publishJournal();
        const quest = questId ? QUESTS.find((candidate) => candidate.id === questId) : null;
        this.openNpcDialogue(npc, [
          entry?.text ?? "I have marked the safest road I know.",
          quest && started
            ? `I have added “${quest.title}” to your journal. The decision is yours when you have both accounts.`
            : "I have copied the route into your journal. Press L before you leave the sanctuary.",
        ]);
      } else {
        const lines: Record<string, { default: string; withShards: string; resolved?: string }> = {
          "town:ilyarael:smith": {
            default: "The road remembers a weight by the way the grass stays down. Yours never does. That is worth noticing.",
            withShards: "Every shard you lift changes the way you stand. Do not let the Engine decide the shape of you before you do.",
            resolved: "You chose what to call yourself. Good. Names are tools, but they should fit the hand that carries them.",
          },
          "town:cinderwild:outrunner": {
            default: "The shrine road runs hot after noon. Take the high side of the ravine; the ash slides only once before it takes you.",
            withShards: "You have that core-light under your ribs now. The ravines notice heat. Keep moving.",
            resolved: "Whatever you chose for the child, do not let anyone tell you it was an easy choice. Easy is a word people use when they were not there.",
          },
          "town:moonlit:blind-oar": {
            default: "Hear the water before you trust the ground. The sandbars hum when the tide is carrying a body beneath them.",
            withShards: "The shards make a sound like an oarlock in rough weather. You are carrying a hard crossing with you.",
            resolved: "The names have somewhere to live now. That is not the same as justice, but it is not nothing.",
          },
          "town:starfall:drift-child": {
            default: "The observatory is north-west. The loud shell waits east. They are both listening for you, but only one is curious.",
            withShards: "The voices around you are closer together now. I cannot hear where one ends. Please do not make them louder.",
            resolved: "The dawn you chose is still in the air around you. It knows you made a choice. It is trying to be glad.",
          },
        };
        const config = lines[npc.id];
        const resolved = questId && Boolean(this.world.quests.resolutions[questId]);
        this.openNpcDialogue(npc, [resolved && config?.resolved ? config.resolved : this.shards > 0 ? config?.withShards ?? "The road has changed around you." : config?.default ?? "The road has been hard. Rest while you can."]);
      }
      return;
    }

    if (npc.role === "lore") {
      if (used) {
        const reactiveLines: Record<string, { default: string; withShards: string }> = {
          "town:ilyarael:scrivener": {
            default: "The records do not change because you keep asking. Go and make a new one.",
            withShards: "The ink on your skin is darkening. Every piece you carry takes a little more of you to hold.",
          },
          "town:cinderwild:kilnmaster": {
            default: "Old smoke doesn't blow back into the chimney. Watch your step in the ash ravines.",
            withShards: "Your chest is glowing like a draft damper pulled wide. You're carrying one of them, aren't you? It's burning you from the inside out.",
          },
          "town:moonlit:dredger": {
            default: "Go on now. The drowned don't like being talked about twice in one afternoon.",
            withShards: "You smell of the Spire. That cold, clean smell. It turns my stomach just the way it did when the collectors came down the pier.",
          },
          "town:starfall:stargazer": {
            default: "The glass is cracked, traveller. Nothing I tell you will make the stars come back.",
            withShards: "I can hear the harmonic vibration from three paces away. It's vibrating at the exact frequency Orren noted down on page seventy-four.",
          },
        };
        const config = reactiveLines[npc.id];
        this.openNpcDialogue(npc, [this.shards > 0 ? config?.withShards ?? "The road is changing you." : config?.default ?? "The records do not change because you keep asking."]);
      } else {
        this.usedTownServices.add(npc.id);
        const entry = this.townLoreEntry(npc.id);
        const loreFacts: Record<string, string> = {
          "town:ilyarael:scrivener": "pilgrim-ledger",
          "town:cinderwild:kilnmaster": "town:cinderwild:kilnmaster",
          "town:moonlit:dredger": "town:moonlit:dredger",
          "town:starfall:stargazer": "town:starfall:stargazer",
        };
        const fact = loreFacts[npc.id] ?? null;
        const learned = fact ? learnFact(this.world.quests, fact) : false;
        if (entry && !this.world.journal.some((existing) => entry.id === existing.id)) this.world.journal.push(entry);
        if (entry || learned) this.publishJournal();
        this.openNpcDialogue(npc, entry
          ? [entry.text, "I have copied this testimony into your journal. Press L to read it again."]
          : ["I have nothing new for you."]);
      }
      return;
    }

    this.openNpcDialogue(npc, ["The road has been hard. Rest while you can."]);
  }

  private townLoreEntry(npcId: string): import("./types").JournalEntry | null {
    const entries: Record<string, import("./types").JournalEntry> = {
      "town:ilyarael:scrivener": {
        id: "town:ilyarael:scrivener",
        title: "The First Courier's Mark",
        text: "The glyph beneath your skin is not a blessing, Althea says. It is the intake mark of the original courier cohort: runners built to survive the Spire's radiant pressure for a few more steps than anyone else. The council called each body returnable. Althea's ancestors copied the word into the margins until the ink tore the paper. She has compared your mark to the old rolls. It matches exactly.",
        source: "Scribe Althea · Ilyarael Township",
      },
      "town:cinderwild:kilnmaster": {
        id: "town:cinderwild:kilnmaster",
        title: "What the Chimneys Drank",
        text: "The smoke from the Spire was never pine or birch. We tended the smelting kilns down here, but the wagons coming east weren't carrying ore; they were carrying closed iron crates stamped with Ilyarael's seal. When the furnace doors opened, the air smelled like scorched hair and burnt vinegar. Orithel called it 'thermal reconciliation.' I still have the delivery receipts.",
        source: "Kiln-Master Vance · Cinder Haven",
      },
      "town:moonlit:dredger": {
        id: "town:moonlit:dredger",
        title: "The Last Evacuation Barge",
        text: "Forty sailed and thirty-nine were left behind on the pier. The Beacon Keeper didn't lose the ledger; he balanced it. I've dragged forty-one chests out of the breakers, and half of them were filled with children's shoes and silver hairpins traded to buy passage that never came. If you find the Salt Graves, don't look for bones. The tide took what was left after the collectors were done.",
        source: "Mistress Morveth · Oarsman's Bight",
      },
      "town:starfall:stargazer": {
        id: "town:starfall:stargazer",
        title: "The Lens of Orren",
        text: "Master Orren built the great glass at the observatory not to study the stars, but to capture their light and compress it into living minds. He believed the human spirit could be hardened into diamond if you heated it fast enough. When the funding ran out, he clamped himself into the apparatus to prove it was painless. He has been screaming inside that iron casing for nine hundred years.",
        source: "Reeve Toran · Crater Watch",
      },
    };
    return entries[npcId] ?? null;
  }

  private scoutQuestId(npcId: string): string | null {
    const quests: Record<string, string> = {
      "town:ilyarael:smith": "pilgrim",
      "town:cinderwild:outrunner": "courier",
      "town:moonlit:blind-oar": "salt",
      "town:starfall:drift-child": "dawn",
    };
    return quests[npcId] ?? null;
  }

  /** Scouts write practical routes, while lorekeepers preserve testimony. Both are journal-worthy. */
  private townScoutEntry(npcId: string): import("./types").JournalEntry | null {
    const entries: Record<string, import("./types").JournalEntry> = {
      "town:ilyarael:smith": {
        id: "town:ilyarael:smith",
        title: "Barris's Comparison",
        text: "Barris has met seven wayfarers bearing my scars. He remembers because each one used the same hand to test a blade, as if the body knew the motion before the person inside it did. He directs me to Scribe Althea for the courier rolls, then north across the lake to the Glass Reliquary. “The mirrors in there know more faces than I do,” he says. “Ask one who you are. Then decide whether you like the answer.”",
        source: "Barris the Smith · Ilyarael Township",
      },
      "town:cinderwild:outrunner": {
        id: "town:cinderwild:outrunner",
        title: "Elodie's Ravine Route",
        text: "From the Cinder Circle, Elodie marks the northeast road to the Broken Shrine. Take the upper side of the ember cracks, she says; the lower shelf has no ground beneath its ash. Her great-grandmother was a courier who refused the northern run. A sealed vessel went to the shrine anyway, and Elodie wants to know whether its runner ever chose anything for herself.",
        source: "Elodie the Outrunner · Cinder Haven",
      },
      "town:moonlit:blind-oar": {
        id: "town:moonlit:blind-oar",
        title: "Kieran's Tide Route",
        text: "Kieran hears the old harbour in the tide. From the pale circle, he marks the southwest path to the Salt Graves and the northeast path to the Keeper's Beacon. “Read both,” he says. “The sea will give you one kind of truth. A man defending his arithmetic gives you another.” He asks that the erased names be carried somewhere they cannot be struck out again.",
        source: "Kieran the Blind Oar · Oarsman's Bight",
      },
      "town:starfall:drift-child": {
        id: "town:starfall:drift-child",
        title: "Mina's Listening Route",
        text: "Mina presses her tuning fork to the ground. Its north-west tine sings toward the Fallen Observatory; its east tine answers the Astronomer's Watch. She says one place contains a promise Orren made to himself, and the other contains what that promise became. “Read the first before you break the second,” she says. “Otherwise he will only be a monster to you.”",
        source: "Mina the Drift-Child · Crater Watch",
      },
    };
    return entries[npcId] ?? null;
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
      this.openDialogue([`The flames recognise you and read you over, the way a clerk reads a docket. ${reward}.`, "This wayfire is your refuge now. Death returns you here, resting restores your strength, and everything you are carrying is noted down somewhere you cannot see."], fire.name, "#ffd28a");
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
      this.discardCurrentRegion = false;
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
    // Camera math works in world pixels. Rendering those pixels at 1.2× means
    // the visible world is 1 / 1.2 of the CSS canvas in each direction.
    this.viewW = this.cssW / CAMERA_ZOOM;
    this.viewH = this.cssH / CAMERA_ZOOM;
    if (this.initialized) {
      this.clampCamera();
      this.tileRenderer.warm(this.cam, this.viewW, this.viewH);
    }
  }
  /** Keep a smaller interior centred too, instead of pinning it to top-left. */
  private clampCamera() {
    this.cam.x = clamp(this.cam.x, this.cameraMinX(), this.cameraMaxX());
    this.cam.y = clamp(this.cam.y, this.cameraMinY(), this.cameraMaxY());
  }
  // A half-viewport overscan keeps a player at a frontier spawn exactly
  // centred, including in a small interior. The canvas background supplies a
  // deliberate, unobtrusive margin beyond map edges when necessary.
  private cameraMinX() { return -this.viewW / 2; }
  private cameraMaxX() { return this.mapPxW - this.viewW / 2; }
  private cameraMinY() { return -this.viewH / 2; }
  private cameraMaxY() { return this.mapPxH - this.viewH / 2; }
  centerCam() {
    this.cam.x = this.player.x - this.viewW / 2;
    this.cam.y = this.player.y - this.viewH / 2;
    this.clampCamera();
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
