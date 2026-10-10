import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Soundscape, type SoundscapeState } from "./Soundscape";
import { equipmentData } from "@/game/equipment";
import type { HudData } from "@/game/types";

class FakeParam {
  value = 0;
  setValueAtTime = vi.fn((value: number) => { this.value = value; });
  setTargetAtTime = vi.fn((value: number) => { this.value = value; });
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
}

class FakeNode {
  connect = vi.fn();
  disconnect = vi.fn();
}
class FakeGain extends FakeNode { gain = new FakeParam(); }
class FakeOscillator extends FakeNode {
  type = "sine";
  frequency = new FakeParam();
  detune = new FakeParam();
  onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
}

class FakeContext {
  currentTime = 0;
  state: AudioContextState = "suspended";
  destination = new FakeNode();
  gains: FakeGain[] = [];
  oscillators: FakeOscillator[] = [];
  createGain = () => { const node = new FakeGain(); this.gains.push(node); return node; };
  createOscillator = () => { const node = new FakeOscillator(); this.oscillators.push(node); return node; };
  createDelay = () => Object.assign(new FakeNode(), { delayTime: new FakeParam() });
  resume = vi.fn(async () => { this.state = "running"; });
  suspend = vi.fn(async () => { this.state = "suspended"; });
  close = vi.fn(async () => { this.state = "closed"; });
}

function hud(patch: Partial<HudData> = {}): HudData {
  return {
    regionName: "The Old Lands", hp: 10, maxHp: 10, stamina: 100, maxStamina: 100,
    shards: 0, totalShards: 9, objective: "", message: "", messageId: 0, prompt: "",
    enemies: 0, bossActive: false, bossHp: 0,
    equipment: equipmentData({ relics: [], attackBonus: 0, dashCostDiscount: 0, combatTool: "wayblade" }),
    ...patch,
  };
}

const playing = (data = hud()): SoundscapeState => ({ hud: data, active: true, paused: false });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const controllers: Soundscape[] = [];

function setup() {
  const context = new FakeContext();
  const factory = vi.fn(() => context as unknown as AudioContext);
  const sound = new Soundscape(factory);
  controllers.push(sound);
  return { context, factory, sound };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.dispose());
  vi.useRealTimers();
});

describe("procedural soundscape lifecycle", () => {
  it("does not create or play audio until a gesture unlocks it", async () => {
    const { sound, context, factory } = setup();
    sound.update(playing());
    sound.setPreferences({ muted: false, volume: 0.5 });
    expect(factory).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    sound.unlock();
    await flush();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(context.state).toBe("running");
    expect(context.oscillators).toHaveLength(3);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("unlocks silently on the title screen and reuses its context after starting", async () => {
    const { sound, context, factory } = setup();
    sound.unlock();
    await flush();
    expect(context.gains[0].gain.value).toBe(0);
    expect(context.state).toBe("suspended");
    expect(vi.getTimerCount()).toBe(0);
    sound.update(playing());
    await flush();
    expect(context.state).toBe("running");
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("suspends in hidden tabs and clears transient notes without queuing a catch-up burst", async () => {
    const { sound, context } = setup();
    sound.update(playing());
    sound.unlock();
    await flush();
    sound.update(playing(hud({ hp: 9 })));
    expect(context.oscillators).toHaveLength(5);
    const hit = context.oscillators.slice(3);
    sound.update({ ...playing(hud({ hp: 9 })), hidden: true });
    await flush();
    expect(context.state).toBe("suspended");
    expect(vi.getTimerCount()).toBe(0);
    hit.forEach((note) => expect(note.disconnect).toHaveBeenCalledOnce());
    sound.update({ ...playing(hud({ hp: 2, shards: 3 })), hidden: true });
    sound.update(playing(hud({ hp: 2, shards: 3 })));
    await flush();
    expect(context.state).toBe("running");
    expect(context.oscillators).toHaveLength(5);
    context.currentTime = 1000;
    vi.advanceTimersByTime(120);
    expect(context.oscillators).toHaveLength(6);
  });

  it("ducks the score for pause and dialogue and suspends completely when muted", async () => {
    const { sound, context } = setup();
    sound.update(playing());
    sound.unlock();
    await flush();
    const full = context.gains[0].gain.value;
    sound.update({ ...playing(), paused: true });
    expect(context.gains[0].gain.value).toBeCloseTo(full * 0.2);
    expect(vi.getTimerCount()).toBe(0);
    sound.update({ ...playing(), dialogue: true });
    expect(context.gains[0].gain.value).toBeCloseTo(full * 0.45);
    sound.setPreferences({ muted: true, volume: 0.45 });
    await flush();
    expect(context.state).toBe("suspended");
    expect(context.gains[0].gain.value).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    sound.setPreferences({ muted: false, volume: 0.45 });
    await flush();
    expect(context.state).toBe("running");
    sound.update({ ...playing(), active: false });
    await flush();
    expect(context.state).toBe("suspended");
  });

  it("changes country, adds remembered harmonies, and introduces boss dissonance", async () => {
    const { sound, context } = setup();
    sound.update(playing());
    sound.unlock();
    await flush();
    const oldRoot = context.oscillators[0].frequency.value;
    const quietHarmony = context.gains[3].gain.value;
    sound.update(playing(hud({ regionName: "Moonlit Coast", shards: 6 })));
    expect(context.oscillators[0].frequency.value).not.toBe(oldRoot);
    expect(context.gains[3].gain.value).toBeGreaterThan(quietHarmony);
    const fifth = context.oscillators[1].frequency.value;
    sound.update(playing(hud({ regionName: "Moonlit Coast", shards: 6, bossActive: true })));
    expect(context.oscillators[1].frequency.value).toBeLessThan(fifth);
    expect(context.oscillators).toHaveLength(5);
  });

  it("cues collection and equipment changes once, and uses loads as a silent baseline", async () => {
    const { sound, context } = setup();
    sound.update(playing(hud({ shards: 5 })));
    sound.unlock();
    await flush();
    expect(context.oscillators).toHaveLength(3);
    const changed = hud({ shards: 6 });
    sound.update(playing(changed));
    expect(context.oscillators).toHaveLength(6);
    sound.update(playing(changed));
    expect(context.oscillators).toHaveLength(6);
    sound.update({ ...playing({ ...changed, equipment: { ...changed.equipment!, tool: "gravehammer" } }), paused: true });
    expect(context.oscillators).toHaveLength(7);
  });

  it("limits transient voices and releases every oscillator, node and timer on disposal", async () => {
    const { sound, context } = setup();
    sound.update(playing(hud({ hp: 100 })));
    sound.unlock();
    await flush();
    for (let hp = 99; hp > 50; hp--) sound.update(playing(hud({ hp })));
    expect(context.oscillators).toHaveLength(35);
    sound.dispose();
    sound.dispose();
    expect(context.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    context.oscillators.forEach((node) => {
      expect(node.stop).toHaveBeenCalled();
      expect(node.disconnect).toHaveBeenCalledOnce();
    });
    context.gains.forEach((node) => expect(node.disconnect).toHaveBeenCalledOnce());
    sound.update(playing());
    sound.unlock();
    expect(context.resume).toHaveBeenCalledOnce();
  });

  it("acknowledges a successful parry and a newly heard name without repeating either cue", async () => {
    const { sound, context } = setup();
    const before = hud({ guard: { window: 0, cooldown: 0, riposte: 0, parries: 0 }, voices: [{ id: "lyra", name: "Lyra", heard: false }] });
    sound.update(playing(before));
    sound.unlock();
    await flush();
    const after = { ...before, guard: { ...before.guard!, parries: 1 }, voices: [{ id: "lyra", name: "Lyra", heard: true }] };
    sound.update(playing(after));
    expect(context.oscillators).toHaveLength(7);
    sound.update(playing(after));
    expect(context.oscillators).toHaveLength(7);
  });

  it("does not resurrect audio when an in-flight resume completes after disposal", async () => {
    const { sound, context } = setup();
    let complete!: () => void;
    context.resume.mockImplementationOnce(() => new Promise<void>((resolve) => { complete = resolve; }));
    sound.update(playing());
    sound.unlock();
    sound.dispose();
    complete();
    await flush();
    expect(context.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("recovers rejected permission on a later gesture without repeated automatic retries", async () => {
    const { sound, context } = setup();
    context.resume.mockRejectedValueOnce(new Error("Gesture required"));
    sound.update(playing());
    sound.unlock();
    await flush();
    sound.update(playing(hud({ hp: 9 })));
    await flush();
    expect(context.resume).toHaveBeenCalledOnce();
    sound.unlock();
    await flush();
    expect(context.state).toBe("running");
    expect(context.resume).toHaveBeenCalledTimes(2);
  });

  it.each([() => null, () => { throw new Error("No audio device"); }])("leaves the game usable when no context can be constructed", (factory) => {
    const unavailable = vi.fn();
    const sound = new Soundscape(factory, unavailable);
    expect(() => { sound.update(playing()); sound.unlock(); sound.unlock(); sound.dispose(); }).not.toThrow();
    expect(unavailable).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
