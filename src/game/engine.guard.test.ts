import { beforeAll, describe, expect, it } from "vitest";
import { bootGame, installHeadlessDom } from "./headlessGame";
import { combatTool, equipmentEffects } from "./equipment";

beforeAll(installHeadlessDom);

describe("guard in the live engine", () => {
  it("faces movement pressed with F in the same frame, then holds that facing", async () => {
    const game = await bootGame();
    try {
      game.enemies = [];
      const p = game.player;
      p.dir = "right";
      game.setVirtualKey("a", true);
      game.setVirtualKey("f", true);
      game.simulateStep(1 / 60);
      expect(p.dir).toBe("left");
      expect(p.guardTimer).toBeGreaterThan(0);
      game.setVirtualKey("a", false);
      game.setVirtualKey("d", true);
      game.simulateStep(1 / 60);
      expect(p.dir).toBe("left");
      const hp = p.hp;
      game.damagePlayer(3, p.x - 20, p.y);
      expect(p.hp).toBe(hp);
      expect(p.parryCount).toBe(1);
    } finally { game.destroy(); }
  });

  it("leaves a committed hammer facing intact when a simultaneous guard is rejected", async () => {
    const game = await bootGame();
    try {
      game.enemies = [];
      game.player.combatTool = "gravehammer";
      game.player.dir = "right";
      game.startAttack();
      game.setVirtualKey("a", true);
      game.setVirtualKey("f", true);
      game.simulateStep(1 / 60);
      expect(game.player.dir).toBe("right");
      expect(game.player.guardTimer ?? 0).toBe(0);
    } finally { game.destroy(); }
  });

  it("catches a frontal blow and spends the riposte on exactly one attack", async () => {
    const game = await bootGame();
    try {
      const p = game.player;
      p.dir = "right"; p.invuln = 0;
      const hp = p.hp;
      game.startGuard();
      game.damagePlayer(4, p.x + 20, p.y);
      expect(p.hp).toBe(hp);
      expect(p.parryCount).toBe(1);
      const base = combatTool(p).damage + p.attackBonus + equipmentEffects(p).attackBonus;
      game.startAttack();
      expect(p.swingDmg).toBe(base + 2);
      p.attacking = false; p.attackCd = 0;
      game.startAttack();
      expect(p.swingDmg).toBe(base);
    } finally { game.destroy(); }
  });

  it("does not guard while paused and blocks attacks and dash during the commitment", async () => {
    const game = await bootGame();
    try {
      game.setPaused(true);
      const stamina = game.player.stamina;
      game.startGuard();
      expect(game.player.stamina).toBe(stamina);
      game.setPaused(false);
      game.startGuard();
      game.startAttack(); game.startDash();
      expect(game.player.attacking).toBe(false);
      expect(game.player.dashing).toBe(false);
    } finally { game.destroy(); }
  });

  it("restores the parry record without restoring an active guard or riposte", async () => {
    const game = await bootGame();
    try {
      Object.assign(game.player, { guardTimer: 0.2, guardCooldown: 0.8, riposteTimer: 1.5, parryCount: 3 });
      game.loadWorld(game.saveWorld());
      expect(game.player.guardTimer).toBe(0);
      expect(game.player.guardCooldown).toBe(0);
      expect(game.player.riposteTimer).toBe(0);
      expect(game.player.parryCount).toBe(3);
    } finally { game.destroy(); }
  });
});
