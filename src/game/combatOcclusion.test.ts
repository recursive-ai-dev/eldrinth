import { beforeAll, describe, expect, it } from "vitest";
import { bootGame, installHeadlessDom } from "./headlessGame";
import { CombatSystem } from "./systems/CombatSystem";
import { TILE } from "./constants";

/**
 * Finds a horizontal wall the test can stand a body on either side of:
 * tile `x` open, `x + 1` solid, `x + 2` open.
 */
function findWallSeam(game: Awaited<ReturnType<typeof bootGame>>): { x: number; y: number } | null {
  const map = game.map;
  for (let y = 20; y < 60; y++) {
    for (let x = 20; x < 60; x++) {
      if (
        game.solidAtIdx(y * map.width + (x + 1)) &&
        !game.solidAtIdx(y * map.width + x) &&
        !game.solidAtIdx(y * map.width + (x + 2))
      ) {
        return { x, y };
      }
    }
  }
  return null;
}

/**
 * Two tiles of open ground immediately before a wall, so a swinger and its
 * target can both stand on the near side without either ending up inside rock.
 */
function findOpenRunBeforeWall(game: Awaited<ReturnType<typeof bootGame>>): { x: number; y: number } | null {
  const map = game.map;
  for (let y = 20; y < 60; y++) {
    for (let x = 20; x < 58; x++) {
      if (
        !game.solidAtIdx(y * map.width + x) &&
        !game.solidAtIdx(y * map.width + (x + 1)) &&
        game.solidAtIdx(y * map.width + (x + 2))
      ) {
        return { x, y };
      }
    }
  }
  return null;
}

describe("combat and terrain", () => {
  beforeAll(() => installHeadlessDom());

  it("does not let a swing reach an enemy standing on the far side of a wall", async () => {
    const game = await bootGame();
    const seam = findWallSeam(game);
    expect(seam).not.toBeNull();
    const { x, y } = seam!;
    const py = y * TILE + TILE / 2;
    const px = x * TILE + TILE / 2;

    game.player.x = px;
    game.player.y = py;
    game.player.dir = "right";

    // A pursuer is stopped by the wall with its body flush against the far
    // face, so its surface sits 32px from the player's centre — inside the
    // 42px swing box, but behind a full tile of rock.
    const probe = game.makeEnemy("sentinel", px, py);
    const enemy = game.makeEnemy("sentinel", px + TILE + probe.r, py);
    game.enemies.push(enemy);

    const reach = enemy.x - enemy.r - px;
    expect(reach).toBeLessThan(42);

    game.startAttack();
    const hpBefore = enemy.hp;
    game.doAttackHit();
    expect(enemy.hp).toBe(hpBefore);
    game.destroy();
  });

  it("still hits an enemy sharing the player's side of the wall", async () => {
    const game = await bootGame();
    const run = findOpenRunBeforeWall(game);
    expect(run).not.toBeNull();
    const { x, y } = run!;
    const py = y * TILE + TILE / 2;

    game.player.x = x * TILE + TILE / 2;
    game.player.y = py;
    game.player.dir = "right";

    // One tile along, still on open ground.
    const enemy = game.makeEnemy("sentinel", (x + 1) * TILE + TILE / 2, py);
    game.enemies.push(enemy);
    expect(game.solidAtIdx(game.tileAtPx(enemy.x, enemy.y))).toBe(false);

    game.startAttack();
    const hpBefore = enemy.hp;
    game.doAttackHit();
    expect(enemy.hp).toBe(hpBefore - (game.player.swingDmg ?? 1));
    game.destroy();
  });

  it("reports line of sight honestly across open ground and through rock", async () => {
    const game = await bootGame();
    const seam = findWallSeam(game);
    expect(seam).not.toBeNull();
    const { x, y } = seam!;
    const py = y * TILE + TILE / 2;
    expect(game.losClear(x * TILE + TILE / 2, py, x * TILE + TILE / 2 + 20, py)).toBe(true);
    expect(game.losClear(x * TILE + TILE / 2, py, (x + 2) * TILE + TILE / 2, py)).toBe(false);
    game.destroy();
  });
});

describe("projectile precedence", () => {
  it("consumes a bolt in terrain before it can touch the player", () => {
    const system = new CombatSystem();
    const projectiles = [{ x: 0, y: 0, vx: 0, vy: 0, r: 6, life: 1, dmg: 3, color: "white" }];
    let playerHit = false;
    system.processProjectiles(
      projectiles,
      { x: 10, y: 0, r: 11, dying: 0, invuln: 0, dashing: false },
      1 / 60,
      () => true,
      () => {
        playerHit = true;
      },
      () => undefined,
    );
    expect(playerHit).toBe(false);
    expect(projectiles).toHaveLength(0);
  });

  it("still damages the player when the bolt is in open air", () => {
    const system = new CombatSystem();
    const projectiles = [{ x: 0, y: 0, vx: 0, vy: 0, r: 6, life: 1, dmg: 3, color: "white" }];
    let damage = 0;
    system.processProjectiles(
      projectiles,
      { x: 10, y: 0, r: 11, dying: 0, invuln: 0, dashing: false },
      1 / 60,
      () => false,
      (pr) => {
        damage = pr.dmg;
      },
      () => undefined,
    );
    expect(damage).toBe(3);
    expect(projectiles).toHaveLength(0);
  });
});
