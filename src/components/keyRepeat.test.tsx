import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import ContentWarning from "./ContentWarning";
import TitleScreen from "./TitleScreen";
import IntroSequence from "./IntroSequence";
import EndScreen from "./EndScreen";

/**
 * Every pre-game screen advances on Enter/Space through a window listener. The
 * listeners ignored `KeyboardEvent.repeat`, so a single held Enter dismissed the
 * content warning, then — as each next screen mounted and caught the same
 * key's auto-repeat — started a run in the first empty slot at a difficulty the
 * player never chose and skipped the whole intro. A held Space from the last
 * fight skipped the ending the same way.
 */

class Node_ {
  nodeType = 1;
  nodeName: string;
  tagName: string;
  namespaceURI = "http://www.w3.org/1999/xhtml";
  childNodes: Node_[] = [];
  parentNode: Node_ | null = null;
  style: Record<string, string> = {};
  attributes: Record<string, string> = {};
  textContent = "";
  constructor(name: string, public ownerDocument: unknown) {
    this.nodeName = name.toUpperCase();
    this.tagName = this.nodeName;
  }
  appendChild(child: Node_) { child.parentNode = this; this.childNodes.push(child); return child; }
  insertBefore(child: Node_) { return this.appendChild(child); }
  removeChild(child: Node_) { this.childNodes = this.childNodes.filter((c) => c !== child); return child; }
  setAttribute(k: string, v: unknown) { this.attributes[k] = String(v); }
  getAttribute(k: string) { return this.attributes[k] ?? null; }
  removeAttribute(k: string) { delete this.attributes[k]; }
  addEventListener() {}
  removeEventListener() {}
  focus() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

let keyListeners: ((event: unknown) => void)[] = [];
let root: Root;

function press(key: string, repeat: boolean) {
  const event = { key, repeat, target: null, preventDefault: vi.fn() };
  for (const listener of [...keyListeners]) listener(event);
}

async function mount(element: ReactElement) {
  await act(async () => { root.render(element); });
}

beforeEach(() => {
  keyListeners = [];
  const doc: Record<string, unknown> = {
    nodeType: 9,
    createElement: (tag: string) => new Node_(tag, doc),
    createElementNS: (_ns: string, tag: string) => new Node_(tag, doc),
    createTextNode: (text: string) => ({ nodeType: 3, textContent: text, ownerDocument: doc }),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  doc.body = new Node_("body", doc);
  doc.activeElement = doc.body;
  doc.defaultView = globalThis;
  const g = globalThis as Record<string, unknown>;
  g.document = doc;
  g.window = globalThis;
  g.addEventListener = (type: string, listener: (event: unknown) => void) => {
    if (type === "keydown") keyListeners.push(listener);
  };
  g.removeEventListener = (type: string, listener: (event: unknown) => void) => {
    if (type === "keydown") keyListeners = keyListeners.filter((l) => l !== listener);
  };
  g.HTMLElement = Node_;
  g.HTMLIFrameElement = class {};
  g.IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(new Node_("div", doc) as unknown as HTMLElement);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
});

describe("screen shortcuts ignore key auto-repeat", () => {
  it("content warning", async () => {
    const onAcknowledge = vi.fn();
    await mount(<ContentWarning onAcknowledge={onAcknowledge} />);
    press("Enter", true);
    expect(onAcknowledge).not.toHaveBeenCalled();
    press("Enter", false);
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it("title screen", async () => {
    const onStart = vi.fn();
    const onContinue = vi.fn();
    await mount(<TitleScreen onStart={onStart} onContinue={onContinue} onErase={vi.fn()} slots={[]} />);
    press("Enter", true);
    press(" ", true);
    expect(onStart).not.toHaveBeenCalled();
    press("Enter", false);
    expect(onStart).toHaveBeenCalledWith(1, "standard");
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("intro sequence", async () => {
    const onComplete = vi.fn();
    await mount(<IntroSequence onComplete={onComplete} />);
    for (let i = 0; i < 10; i++) await act(async () => { press("Enter", true); });
    expect(onComplete).not.toHaveBeenCalled();
    await act(async () => { press("Escape", false); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("end screen", async () => {
    const onRestart = vi.fn();
    await mount(<EndScreen ending="silence" epilogue={[]} onRestart={onRestart} />);
    press(" ", true);
    expect(onRestart).not.toHaveBeenCalled();
    press(" ", false);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
