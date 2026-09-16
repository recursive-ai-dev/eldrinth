import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import GameCanvas from "./GameCanvas";
import type { WorldSnapshot } from "../game/core/WorldState";

// Mock the Game engine to test GameCanvas component lifecycle deterministically
const mockGameInstances: any[] = [];
let mockInitShouldReject = false;
let mockInitRejectError: Error | null = null;

vi.mock("@/game/engine", () => {
  return {
    Game: vi.fn().mockImplementation(function (canvas: any, callbacks: any, _db: any, options: any) {
      const instance = {
        canvas,
        callbacks,
        options,
        initialized: false,
        ended: false,
        destroyed: false,
        started: false,
        world: {
          regionId: "overworld",
        },
        init: vi.fn().mockImplementation(() => {
          if (mockInitShouldReject) {
            return Promise.reject(mockInitRejectError || new Error("WebAssembly compilation failed"));
          }
          instance.initialized = true;
          return Promise.resolve();
        }),
        start: vi.fn().mockImplementation(() => {
          instance.started = true;
        }),
        destroy: vi.fn().mockImplementation(() => {
          instance.destroyed = true;
        }),
        saveWorld: vi.fn().mockImplementation(() => ({
          regionId: instance.world.regionId,
          tick: 42,
          player: { hp: 10 },
        } as unknown as WorldSnapshot)),
        loadWorld: vi.fn().mockImplementation((snapshot: WorldSnapshot) => {
          instance.world.regionId = snapshot.regionId;
        }),
      };
      mockGameInstances.push(instance);
      return instance;
    }),
  };
});

// Setup minimal DOM for React 19 test environment in node
class MockElement {
  nodeName: string;
  tagName: string;
  nodeType = 1;
  childNodes: any[] = [];
  children: any[] = [];
  style: Record<string, string> = {};
  attributes: Record<string, string> = {};
  ownerDocument: any;
  namespaceURI = "http://www.w3.org/1999/xhtml";
  textContent = "";
  eventListeners: Record<string, ((e: any) => void)[]> = {};

  constructor(nodeName = "DIV", doc?: any) {
    this.nodeName = nodeName.toUpperCase();
    this.tagName = nodeName.toUpperCase();
    this.ownerDocument = doc;
  }

  appendChild(child: any) {
    child.parentNode = this;
    this.childNodes.push(child);
    this.children.push(child);
    return child;
  }

  removeChild(child: any) {
    const idx = this.childNodes.indexOf(child);
    if (idx >= 0) this.childNodes.splice(idx, 1);
    const cIdx = this.children.indexOf(child);
    if (cIdx >= 0) this.children.splice(cIdx, 1);
    return child;
  }

  insertBefore(newNode: any, _refNode: any) {
    return this.appendChild(newNode);
  }

  setAttribute(k: string, v: string) {
    this.attributes[k] = String(v);
  }

  getAttribute(k: string) {
    return this.attributes[k] ?? null;
  }

  hasAttribute(k: string) {
    return k in this.attributes;
  }

  removeAttribute(k: string) {
    delete this.attributes[k];
  }

  addEventListener(type: string, handler: (e: any) => void) {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push(handler);
  }

  removeEventListener(type: string, handler: (e: any) => void) {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter((h) => h !== handler);
  }

  dispatchEvent(event: { type: string }) {
    const handlers = this.eventListeners[event.type] || [];
    for (const h of handlers) h(event);
  }

  focus() {}
  blur() {}

  // Recursive querySelector / getElementsByTagName helper for tests
  querySelector(sel: string): MockElement | null {
    const attrMatch = sel.match(/^\[([a-zA-Z0-9-]+)(?:=['"]([^'"]+)['"])?\]$/);
    const testIdMatch = sel.match(/^\[data-testid="([^"]+)"\]$/);

    for (const child of this.childNodes) {
      if (child.nodeType !== 1) continue;
      if (testIdMatch && child.getAttribute("data-testid") === testIdMatch[1]) return child;
      if (attrMatch) {
        const val = child.getAttribute(attrMatch[1]);
        if (attrMatch[2] ? val === attrMatch[2] : val !== null) return child;
      }
      if (child.nodeName.toLowerCase() === sel.toLowerCase()) return child;
      const found = child.querySelector(sel);
      if (found) return found;
    }
    return null;
  }
}

class HTMLIFrameElement {}
class Element {}
class HTMLElement extends Element {}
class HTMLCanvasElement extends HTMLElement {}

describe("GameCanvas Component Lifecycle Integration Tests", () => {
  let container: MockElement;
  let root: Root;
  let mockDoc: any;
  let visibilityHandlers: ((e: any) => void)[] = [];

  const defaultCallbacks = {
    onHud: vi.fn(),
    onDialogue: vi.fn(),
    onPause: vi.fn(),
    onEnd: vi.fn(),
    onJournal: vi.fn(),
    onInterior: vi.fn(),
  };

  beforeEach(() => {
    mockGameInstances.length = 0;
    mockInitShouldReject = false;
    mockInitRejectError = null;
    visibilityHandlers = [];

    mockDoc = {
      nodeType: 9,
      createElement: (tag: string) => new MockElement(tag, mockDoc),
      createElementNS: (_ns: string, tag: string) => new MockElement(tag, mockDoc),
      createTextNode: (t: string) => ({
        nodeType: 3,
        textContent: t,
        ownerDocument: mockDoc,
      }),
      addEventListener: vi.fn((event: string, handler: (e: any) => void) => {
        if (event === "visibilitychange") visibilityHandlers.push(handler);
      }),
      removeEventListener: vi.fn((event: string, handler: (e: any) => void) => {
        if (event === "visibilitychange") {
          visibilityHandlers = visibilityHandlers.filter((h) => h !== handler);
        }
      }),
      visibilityState: "visible",
      activeElement: null,
      body: null,
    };
    mockDoc.body = new MockElement("body", mockDoc);
    mockDoc.activeElement = mockDoc.body;
    mockDoc.defaultView = global;

    (global as any).addEventListener = vi.fn((event: string, handler: (e: any) => void) => {
      if (event === "visibilitychange") visibilityHandlers.push(handler);
    });
    (global as any).removeEventListener = vi.fn((event: string, handler: (e: any) => void) => {
      if (event === "visibilitychange") {
        visibilityHandlers = visibilityHandlers.filter((h) => h !== handler);
      }
    });
    (global as any).document = mockDoc;
    (global as any).window = global;
    (global as any).HTMLIFrameElement = HTMLIFrameElement;
    (global as any).Element = Element;
    (global as any).HTMLElement = HTMLElement;
    (global as any).HTMLCanvasElement = HTMLCanvasElement;
    (global as any).IS_REACT_ACT_ENVIRONMENT = true;

    container = new MockElement("div", mockDoc);
    root = createRoot(container as any);
  });

  afterEach(async () => {
    await act(async () => {
      try {
        root.unmount();
      } catch {
        // already unmounted
      }
    });
  });

  it("restart remounting: unmounting cleans up previous engine and remounting boots fresh instance", async () => {
    const onCheckpoint = vi.fn();
    const onReady = vi.fn();

    await act(async () => {
      root.render(
        <GameCanvas
          key={1}
          callbacks={defaultCallbacks}
          onCheckpoint={onCheckpoint}
          onReady={onReady}
        />
      );
    });

    expect(mockGameInstances.length).toBe(1);
    const firstGame = mockGameInstances[0];
    expect(firstGame.init).toHaveBeenCalled();
    expect(firstGame.start).toHaveBeenCalled();
    expect(firstGame.destroyed).toBe(false);
    expect(onReady).toHaveBeenCalledWith(firstGame);

    // Unmount and remount with new session (simulating restart)
    await act(async () => {
      root.render(
        <GameCanvas
          key={2}
          callbacks={defaultCallbacks}
          onCheckpoint={onCheckpoint}
          onReady={onReady}
        />
      );
    });

    // Previous game must be destroyed and checkpointed upon unmount
    expect(firstGame.destroy).toHaveBeenCalled();
    expect(firstGame.destroyed).toBe(true);
    expect(onCheckpoint).toHaveBeenCalled();

    // New game instance must be created and started
    expect(mockGameInstances.length).toBe(2);
    const secondGame = mockGameInstances[1];
    expect(secondGame).not.toBe(firstGame);
    expect(secondGame.init).toHaveBeenCalled();
    expect(secondGame.start).toHaveBeenCalled();
  });

  it("initialization failure handling: displays error UI, prevents start, allows retry and return to title", async () => {
    mockInitShouldReject = true;
    mockInitRejectError = new Error("Failed to load WebAssembly binary");

    const onError = vi.fn();
    const onReady = vi.fn();
    const onReturnToTitle = vi.fn();

    await act(async () => {
      root.render(
        <GameCanvas
          callbacks={defaultCallbacks}
          onError={onError}
          onReady={onReady}
          onReturnToTitle={onReturnToTitle}
        />
      );
    });

    const failedGame = mockGameInstances[0];
    expect(failedGame.init).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(mockInitRejectError);
    // When init fails, start() and onReady() must NOT be called
    expect(failedGame.start).not.toHaveBeenCalled();
    expect(onReady).not.toHaveBeenCalled();

    // Error UI is rendered
    const errorScreen = container.querySelector('[data-testid="init-error-screen"]');
    expect(errorScreen).not.toBeNull();

    // Recovery path: Test clicking Return to Title
    onReturnToTitle();
    expect(onReturnToTitle).toHaveBeenCalled();

    // Now test Retry: allow init to succeed on retry
    mockInitShouldReject = false;
    await act(async () => {
      // Re-render with retry
      root.render(
        <GameCanvas
          key="retry"
          callbacks={defaultCallbacks}
          onError={onError}
          onReady={onReady}
        />
      );
    });

    const retriedGame = mockGameInstances[1];
    expect(retriedGame.init).toHaveBeenCalled();
    expect(retriedGame.start).toHaveBeenCalled();
    expect(onReady).toHaveBeenCalledWith(retriedGame);
  });

  it("autosave callbacks: saves on visibility hidden, periodic interval, and unmount", async () => {
    vi.useFakeTimers();
    const onCheckpoint = vi.fn();

    await act(async () => {
      root.render(
        <GameCanvas
          callbacks={defaultCallbacks}
          onCheckpoint={onCheckpoint}
        />
      );
    });

    const game = mockGameInstances[0];
    expect(game.initialized).toBe(true);

    // 1. Periodic 10s interval autosave
    onCheckpoint.mockClear();
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onCheckpoint).toHaveBeenCalledTimes(1);
    expect(onCheckpoint).toHaveBeenCalledWith(expect.objectContaining({ tick: 42 }));

    // 2. Visibility change to hidden
    onCheckpoint.mockClear();
    mockDoc.visibilityState = "hidden";
    for (const handler of visibilityHandlers) {
      handler(new Event("visibilitychange"));
    }
    expect(onCheckpoint).toHaveBeenCalledTimes(1);

    // Visibility change when visible does NOT trigger checkpoint
    onCheckpoint.mockClear();
    mockDoc.visibilityState = "visible";
    for (const handler of visibilityHandlers) {
      handler(new Event("visibilitychange"));
    }
    expect(onCheckpoint).not.toHaveBeenCalled();

    // 3. Unmounting flushes final checkpoint
    onCheckpoint.mockClear();
    await act(async () => {
      root.unmount();
    });
    expect(onCheckpoint).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("loading a save through GameCanvas: pre-sets region before init and restores snapshot after init", async () => {
    const savedSnapshot: WorldSnapshot = {
      regionId: "cinderwild",
      tick: 500,
      player: { hp: 14 } as any,
    } as any;

    const onReady = vi.fn();

    await act(async () => {
      root.render(
        <GameCanvas
          callbacks={defaultCallbacks}
          initialSnapshot={savedSnapshot}
          onReady={onReady}
        />
      );
    });

    const game = mockGameInstances[0];
    // Region was acquired/set before init
    expect(game.world.regionId).toBe("cinderwild");
    // Snapshot loaded after init
    expect(game.loadWorld).toHaveBeenCalledWith(savedSnapshot);
    expect(game.start).toHaveBeenCalled();
    expect(onReady).toHaveBeenCalledWith(game);
  });
});
