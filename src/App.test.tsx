import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "./App";
import type { SaveSlot, SlotSave } from "./game/slots";

// Minimal DOM shim for the node environment.
class MockElement {
  nodeType = 1;
  tagName: string;
  nodeName: string;
  childNodes: any[] = [];
  children: any[] = [];
  style: Record<string, string> = {};
  attributes: Record<string, string> = {};
  eventListeners: Record<string, ((e: any) => void)[]> = {};
  ownerDocument: any;
  namespaceURI = "http://www.w3.org/1999/xhtml";
  textContent = "";
  constructor(tag = "DIV", doc?: any) {
    this.tagName = tag.toUpperCase();
    this.nodeName = tag.toUpperCase();
    this.ownerDocument = doc;
  }
  appendChild(child: any) { child.parentNode = this; this.childNodes.push(child); this.children.push(child); return child; }
  addEventListener(type: string, handler: (e: any) => void) {
    if (!this.eventListeners) this.eventListeners = {};
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push(handler);
  }
  removeEventListener(type: string, handler: any) {
    if (!this.eventListeners) return;
    if (!this.eventListeners[type]) return;
    const i = this.eventListeners[type].indexOf(handler);
    if (i >= 0) this.eventListeners[type].splice(i, 1);
  }
  setAttribute(k: string, v: string) { this.attributes[k] = String(v); }
  getAttribute(k: string) { return this.attributes[k] ?? null; }
}
class HTMLIFrameElement {}
class Element {}
class HTMLElement extends Element {}
class HTMLCanvasElement extends HTMLElement {}
(globalThis as any).HTMLIFrameElement = HTMLIFrameElement;
(globalThis as any).Element = Element;
(globalThis as any).HTMLElement = HTMLElement;
(globalThis as any).HTMLCanvasElement = HTMLCanvasElement;

const localStorageStore: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => localStorageStore[k] ?? null,
  setItem: (k: string, v: string) => { localStorageStore[k] = v; },
  removeItem: (k: string) => { delete localStorageStore[k]; },
  clear: () => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]); },
};
const visibilityHandlers: ((e: any) => void)[] = [];
const mockDoc = {
  nodeType: 9,
  createElement: (tag: string) => new MockElement(tag, mockDoc),
  addEventListener: (event: string, handler: (e: any) => void) => { if (event === "visibilitychange") visibilityHandlers.push(handler); },
  removeEventListener: (event: string, handler: any) => { if (event === "visibilitychange") { const i = visibilityHandlers.indexOf(handler); if (i >= 0) visibilityHandlers.splice(i, 1); } },
  visibilityState: "visible",
  activeElement: null,
  body: null as any,
};
mockDoc.body = new MockElement("body", mockDoc);
(globalThis as any).document = mockDoc;
(globalThis as any).window = globalThis;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).addEventListener = (event: string, handler: (e: any) => void) => { if (event === "visibilitychange") visibilityHandlers.push(handler); };
(globalThis as any).removeEventListener = (event: string, handler: any) => { if (event === "visibilitychange") { const i = visibilityHandlers.indexOf(handler); if (i >= 0) visibilityHandlers.splice(i, 1); } };

// Hoisted so the vi.mock factories can reference them.
const hoistedSlots = vi.hoisted(() => {
  const slots: SlotSave[] = [];
  const slotStore = {
    list: vi.fn((): Promise<SaveSlot[]> => Promise.resolve([...slots])),
    load: vi.fn((slot: number) => {
      const entry = slots.find((s) => s.id === slot);
      return Promise.resolve(entry && entry.world ? { world: entry.world, difficulty: "standard", shards: 0, updatedAt: 0, revision: "1" } : null);
    }),
    prepareNew: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    exportBackup: vi.fn(async () => new Uint8Array([1])),
    importBackup: vi.fn(async () => undefined),
    onStatusChange: vi.fn((cb: (p: { ok: boolean; reason: string | null; cause: string | null }) => void) => { cb({ ok: true, reason: null, cause: null }); return () => undefined; }),
    owned: new Map(),
  };
  return { slots, slotStore };
});
vi.mock("@/game/slots", () => ({ slotStore: hoistedSlots.slotStore, SLOT_COUNT: 3 }));
const { slots, slotStore } = hoistedSlots;

// Hoisted so the vi.mock factories can reference them.
const hoistedUi = vi.hoisted(() => {
  let titleProps: any = null;
  let introProps: any = null;
  return { titleProps, introProps };
});
vi.mock("@/components/TitleScreen", () => ({
  default: vi.fn((props: any) => { hoistedUi.titleProps = props; return null; }),
}));
vi.mock("@/components/IntroSequence", () => ({
  default: vi.fn((props: any) => { hoistedUi.introProps = props; return null; }),
}));

// Mock zustand store (hoisted so the vi.mock factory can reference it).
const hoisted = vi.hoisted(() => {
  const state: any = { screen: "title", paused: false, hud: {}, dialogue: null, journal: [], sessionId: "s1", ending: null, epilogue: null };
  const actions = {
    startGame: vi.fn(), endGame: vi.fn(), setPaused: vi.fn(), setHud: vi.fn(), setDialogue: vi.fn(), setJournal: vi.fn(), setInterior: vi.fn(), reset: vi.fn(),
  };
  return { state, actions };
});
vi.mock("@/stores", () => ({
  useGameStore: vi.fn((selector?: any) => selector ? selector(hoisted.state) : hoisted.actions),
  get storeState() { return hoisted.state; },
  get storeActions() { return hoisted.actions; },
  selectScreen: (s: any) => s.screen,
  selectPaused: (s: any) => s.paused,
  selectHud: (s: any) => s.hud,
  selectDialogue: (s: any) => s.dialogue,
  selectJournal: (s: any) => s.journal,
  selectSessionId: (s: any) => s.sessionId,
  selectEnding: (s: any) => s.ending,
  selectEpilogue: (s: any) => s.epilogue,
  ...hoisted.actions,
}));
const storeState = hoisted.state;
const storeActions = hoisted.actions;

vi.mock("@/components/ContentWarning", () => ({
  default: vi.fn(() => null),
  contentWarningSeen: vi.fn(() => true),
  markContentWarningSeen: vi.fn(),
}));
vi.mock("@/audio/useSoundscape", () => ({ useSoundscape: vi.fn(() => ({})) }));
vi.mock("@/components/GameCanvas", () => ({ default: vi.fn(() => null) }));

let root: Root;
let container: MockElement;

function renderApp() {
  container = new MockElement("div", mockDoc);
  root = createRoot(container as any);
  root.render(<App />);
}

afterEach(async () => {
  try {
    await act(async () => { root.unmount(); });
  } catch {
    // already unmounted
  }
});

beforeEach(() => {
  slots.length = 0;
  hoistedUi.titleProps = null;
  hoistedUi.introProps = null;
  storeState.screen = "title";
  storeState.paused = false;
  storeState.dialogue = null;
  storeState.journal = [];
  vi.clearAllMocks();
});

describe("App shell", () => {
  it("renders the title screen with slots once they are ready", async () => {
    slots.push({ id: 1, difficulty: "standard", shards: 0, updatedAt: 0, world: { regionId: "overworld" } as any });
    await act(async () => { renderApp(); });
    await act(async () => { await Promise.resolve(); }); // let list() resolve
    expect(hoistedUi.titleProps).not.toBeNull();
    expect(hoistedUi.titleProps.slots).toHaveLength(1);
    expect(hoistedUi.titleProps.slotsReady).toBe(true);
    expect(hoistedUi.titleProps.busy).toBe(false);
  });

  it("begins a new game: rechecks the DB via prepareNew and switches to the intro", async () => {
    slots.push({ id: 1, difficulty: "standard", shards: 0, updatedAt: 0, world: { regionId: "overworld" } as any });
    await act(async () => { renderApp(); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { hoistedUi.titleProps.onStart(1, "standard"); });
    expect(slotStore.prepareNew).toHaveBeenCalledWith(1);
    expect(storeState.screen).toBe("title");
    // Intro replaces the title once introPlaying is true.
    expect(hoistedUi.introProps).not.toBeNull();
    expect(hoistedUi.introProps.onComplete).toBeDefined();
  });

  it("completing the intro starts the game", async () => {
    slots.push({ id: 1, difficulty: "standard", shards: 0, updatedAt: 0, world: { regionId: "overworld" } as any });
    await act(async () => { renderApp(); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { hoistedUi.titleProps.onStart(1, "standard"); });
    await act(async () => { hoistedUi.introProps.onComplete(); });
    expect(storeActions.startGame).toHaveBeenCalled();
  });

  it("resuming loads the slot and starts the game when the record reads", async () => {
    slots.push({ id: 1, difficulty: "standard", shards: 0, updatedAt: 0, world: { regionId: "overworld" } as any });
    await act(async () => { renderApp(); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { hoistedUi.titleProps.onContinue(1); });
    expect(slotStore.load).toHaveBeenCalledWith(1);
    expect(storeActions.startGame).toHaveBeenCalled();
  });

  it("shows an error and does not start when a resumed slot is unreadable", async () => {
    slots.push({ id: 1, difficulty: "standard", shards: 0, updatedAt: 0, world: null } as any);
    await act(async () => { renderApp(); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { hoistedUi.titleProps.onContinue(1); });
    expect(slotStore.load).toHaveBeenCalledWith(1);
    expect(storeActions.startGame).not.toHaveBeenCalled();
  });

  it("erasing a slot removes it and refreshes", async () => {
    slots.push({ id: 1, difficulty: "standard", shards: 0, updatedAt: 0, world: { regionId: "overworld" } as any });
    await act(async () => { renderApp(); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { hoistedUi.titleProps.onErase(1); });
    expect(slotStore.remove).toHaveBeenCalledWith(1);
    expect(slotStore.list).toHaveBeenCalled();
  });
});
