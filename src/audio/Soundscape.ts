import type { HudData } from "@/game/types";
import { DEFAULT_SOUND_PREFERENCES, normalizeSoundPreferences, type SoundPreferences } from "./preferences";

export interface SoundscapeState {
  hud: HudData | null;
  active: boolean;
  paused: boolean;
  dialogue?: boolean;
  hidden?: boolean;
}

interface Palette {
  root: number;
  color: OscillatorType;
  motif: readonly number[];
  beat: number;
}

// Each country remembers the same nine-note lament in a different register.
const PALETTES: Record<string, Palette> = {
  old: { root: 73.416, color: "sine", motif: [0, 7, 3, 10, 7, 2, 0, 5, 3], beat: 1.48 },
  cinder: { root: 65.406, color: "triangle", motif: [0, 1, 7, 3, 1, 10, 7, 3, 0], beat: 1.2 },
  coast: { root: 82.407, color: "sine", motif: [0, 7, 10, 5, 7, 3, 2, 7, 0], beat: 1.68 },
  star: { root: 98, color: "sine", motif: [0, 7, 14, 3, 10, 7, 5, 14, 3], beat: 1.86 },
  stone: { root: 61.735, color: "triangle", motif: [0, 7, 1, 0, 6, 3, 1, 7, 0], beat: 1.72 },
};

function paletteFor(region: string): Palette {
  if (/cinder|kiln|shrine|watchpost/i.test(region)) return PALETTES.cinder;
  if (/coast|moonlit|salt|beacon|drift|oar/i.test(region)) return PALETTES.coast;
  if (/star|moor|astronom|observatory/i.test(region)) return PALETTES.star;
  if (/fortress|spire|crypt|vault|hollow|ossuary/i.test(region)) return PALETTES.stone;
  return PALETTES.old;
}

function browserContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Constructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Constructor ? new Constructor() : null;
}

export function soundSupported(): boolean {
  return typeof window !== "undefined" && Boolean(window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
}

interface Voice { oscillator: OscillatorNode; envelope: GainNode }
type Cue = "hurt" | "remember" | "equipment" | "boss" | "parry" | "listen";

/** A small, entirely local score. Constructing or updating it never unlocks audio. */
export class Soundscape {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private delay: DelayNode | null = null;
  private nodes: AudioNode[] = [];
  private drones: Voice[] = [];
  private notes = new Set<Voice>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private state: SoundscapeState = { hud: null, active: false, paused: false };
  private preferences: SoundPreferences = { ...DEFAULT_SOUND_PREFERENCES };
  private disposed = false;
  private unavailable = false;
  private pending = false;
  private resumeDenied = false;
  private beat = 0;
  private nextBeat = 0;
  private mixKey = "";
  private region = "";

  constructor(
    private readonly createContext: () => AudioContext | null = browserContext,
    private readonly onUnavailable: () => void = () => {},
  ) {}

  /** Call directly from a trusted pointer/key event, including on the title screen. */
  unlock() {
    if (this.disposed || this.unavailable) return;
    if (this.context && !this.audible() && !this.resumeDenied) return;
    this.resumeDenied = false;
    if (!this.context) {
      try {
        this.context = this.createContext();
        if (!this.context) throw new Error("Web Audio is unavailable");
        this.buildGraph(this.context);
      } catch {
        this.unavailable = true;
        this.onUnavailable();
        this.dispose();
        return;
      }
    }
    // Resume inside the gesture even on the title screen. The silent graph can
    // then suspend, retaining browser authorization when the game loads later.
    if (this.context.state !== "running") this.transition(true);
    else this.syncPlayback();
  }

  setPreferences(preferences: SoundPreferences) {
    this.preferences = normalizeSoundPreferences(preferences);
    this.syncPlayback();
  }

  update(state: SoundscapeState) {
    const previous = this.state;
    this.state = state;
    if (state.hud?.regionName !== this.region) {
      this.region = state.hud?.regionName ?? "";
      this.beat = 0;
      this.nextBeat = (this.context?.currentTime ?? 0) + 0.3;
    }
    this.syncPlayback();
    // A load, transition, unpause or return from another tab is a new baseline,
    // not a burst of historical damage/collection sounds.
    if (!previous.active || previous.hidden || !this.audible() || !previous.hud || !state.hud || previous.hud.regionName !== state.hud.regionName) return;
    const before = previous.hud;
    const after = state.hud;
    if (!state.paused && !previous.paused) {
      if (after.hp < before.hp) this.cue("hurt");
      if (after.shards > before.shards) this.cue("remember");
      if (after.bossActive && !before.bossActive) this.cue("boss");
      if (after.guard && before.guard && after.guard.parries > before.guard.parries) this.cue("parry");
      if (after.voices && before.voices && after.voices.filter((voice) => voice.heard).length > before.voices.filter((voice) => voice.heard).length) this.cue("listen");
    }
    if (before.equipment && after.equipment && before.equipment.tool !== after.equipment.tool) this.cue("equipment");
  }

  private audible() {
    return !this.disposed && this.state.active && !!this.state.hud && !this.state.hidden && !this.preferences.muted && this.preferences.volume > 0;
  }

  private buildGraph(context: AudioContext) {
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    this.master = master;
    const delay = context.createDelay(1);
    delay.delayTime.value = 0.43;
    const echo = context.createGain();
    echo.gain.value = 0.2;
    delay.connect(echo);
    echo.connect(delay);
    echo.connect(master);
    this.delay = delay;
    this.nodes = [master, delay, echo];
    for (let index = 0; index < 3; index++) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 73.416 * 2 ** ([0, 7, 12][index] / 12);
      oscillator.detune.value = index === 1 ? -5 : index === 2 ? 4 : 0;
      envelope.gain.value = 0;
      oscillator.connect(envelope);
      envelope.connect(master);
      this.drones.push({ oscillator, envelope });
      oscillator.start();
    }
  }

  private transition(running: boolean) {
    const context = this.context;
    if (!context || this.pending || this.disposed) return;
    this.pending = true;
    let operation: Promise<void>;
    try { operation = running ? context.resume() : context.suspend(); }
    catch { this.pending = false; this.resumeDenied = true; return; }
    void operation.then(() => {
      this.pending = false;
      if (!this.disposed) this.syncPlayback();
    }).catch(() => {
      this.pending = false;
      // Browsers may revoke permission after a device interruption; a later
      // gesture retries. Never loop on rejected resume promises on every HUD tick.
      this.resumeDenied = true;
      this.stopClock();
    });
  }

  private syncPlayback() {
    const context = this.context;
    if (!context || !this.master || this.disposed) return;
    if (!this.audible()) {
      this.master.gain.cancelScheduledValues(context.currentTime);
      this.master.gain.setValueAtTime(0, context.currentTime);
      this.mixKey = "";
      this.stopClock();
      this.clearNotes();
      if (context.state === "running") this.transition(false);
      return;
    }
    if (context.state !== "running") {
      if (!this.resumeDenied) this.transition(true);
      return;
    }
    this.mix();
    if (this.state.paused) this.stopClock();
    else if (this.timer === null) {
      this.nextBeat = context.currentTime + 0.2;
      this.timer = setInterval(() => this.tick(), 120);
    }
  }

  private mix() {
    const hud = this.state.hud!;
    const context = this.context!;
    const palette = paletteFor(hud.regionName);
    const remembered = Math.min(9, Math.max(0, hud.shards));
    const key = [hud.regionName, remembered, hud.bossActive, this.state.paused, this.state.dialogue, this.preferences.volume].join(":");
    if (key === this.mixKey) return;
    this.mixKey = key;
    const now = context.currentTime;
    const duck = this.state.paused ? 0.2 : this.state.dialogue ? 0.45 : 1;
    this.master!.gain.setTargetAtTime(this.preferences.volume * duck * 0.6, now, 0.12);
    this.drones.forEach((voice, index) => {
      voice.oscillator.frequency.setTargetAtTime(palette.root * 2 ** ([0, hud.bossActive ? 6 : 7, 12][index] / 12), now, 1.5);
      voice.envelope.gain.setTargetAtTime([0.1, 0.018 + remembered * 0.003, 0.007 + remembered * 0.002][index], now, 1.2);
    });
  }

  private tick() {
    const context = this.context;
    const hud = this.state.hud;
    if (!context || !hud || !this.audible() || this.state.paused || context.state !== "running") return;
    if (context.currentTime + 0.14 < this.nextBeat) return;
    // Schedule at most one beat after a delayed timer; never replay a backlog.
    const at = Math.max(context.currentTime + 0.02, this.nextBeat);
    const palette = paletteFor(hud.regionName);
    const step = this.beat++ % 9;
    if (step <= Math.min(8, hud.shards) || step === 4) {
      const pitch = palette.root * 4 * 2 ** (palette.motif[step] / 12);
      this.note(pitch, 1.7, 0.07, palette.color, at);
      if (hud.shards >= 5 && step % 3 === 0) this.note(pitch * 1.5, 2.1, 0.025, "sine", at + 0.12);
    }
    if (hud.bossActive) {
      this.note(palette.root * 0.6, 0.28, 0.21, "sine", at);
      if (step % 2 === 0) this.note(palette.root * 0.6, 0.2, 0.1, "sine", at + 0.19);
    }
    this.nextBeat = at + (hud.bossActive ? 0.65 : palette.beat);
  }

  private cue(cue: Cue) {
    if (!this.context || this.context.state !== "running" || !this.audible()) return;
    const now = this.context.currentTime + 0.01;
    const root = paletteFor(this.state.hud!.regionName).root;
    if (cue === "hurt") {
      this.note(65, 0.17, 0.28, "triangle", now);
      this.note(44, 0.24, 0.2, "sine", now + 0.04);
    } else if (cue === "remember") {
      [4, 6, 8].forEach((ratio, index) => this.note(root * ratio, 1.4, 0.13, "sine", now + index * 0.18));
    } else if (cue === "boss") {
      this.note(root / 2, 1.8, 0.28, "triangle", now);
      this.note(root * 1.06, 1.5, 0.12, "sine", now);
    } else if (cue === "parry") {
      this.note(880, 0.3, 0.13, "sine", now);
      this.note(1320, 0.45, 0.075, "triangle", now + 0.025);
    } else if (cue === "listen") {
      this.note(root * 3, 1.8, 0.09, "sine", now);
      this.note(root * 4, 2, 0.06, "sine", now + 0.3);
    } else {
      this.note(this.state.hud?.equipment?.tool === "gravehammer" ? 110 : 330, 0.2, 0.12, "triangle", now);
    }
  }

  private note(frequency: number, duration: number, level: number, type: OscillatorType, at: number) {
    if (!this.context || !this.master || this.notes.size >= 32) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const voice = { oscillator, envelope };
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(level, at + 0.018);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    if (this.delay) envelope.connect(this.delay);
    this.notes.add(voice);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
      this.notes.delete(voice);
    };
    oscillator.start(at);
    oscillator.stop(at + duration + 0.03);
  }

  private stopClock() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private clearNotes() {
    for (const voice of this.notes) {
      voice.oscillator.onended = null;
      try { voice.oscillator.stop(); } catch { /* Already ended. */ }
      voice.oscillator.disconnect();
      voice.envelope.disconnect();
    }
    this.notes.clear();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopClock();
    this.clearNotes();
    for (const voice of this.drones) {
      try { voice.oscillator.stop(); } catch { /* A partially built graph may not have started. */ }
      voice.oscillator.disconnect();
      voice.envelope.disconnect();
    }
    this.drones = [];
    this.nodes.forEach((node) => node.disconnect());
    this.nodes = [];
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") void context.close().catch(() => {});
  }
}
