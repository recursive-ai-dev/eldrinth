import { describe, expect, it, vi } from "vitest";
import { T } from "./constants";
import { RegionRepository, WorkerRegionSource, type RegionSource } from "./regions";

describe("RegionRepository", () => {
  it("lets one caller abort without cancelling a shared region load", async () => {
    let finish!: (region: Awaited<ReturnType<RegionSource["load"]>>) => void;
    let sourceSignal!: AbortSignal;
    let loads = 0;
    const source: RegionSource = {
      load: (_id, signal) => {
        loads++;
        sourceSignal = signal;
        return new Promise((resolve) => { finish = resolve; });
      },
    };
    const repository = new RegionRepository(source);
    const first = new AbortController();
    const second = new AbortController();
    const aborted = repository.acquire("shared", first.signal);
    const active = repository.acquire("shared", second.signal);
    await Promise.resolve();
    first.abort();
    await expect(aborted).rejects.toMatchObject({ name: "AbortError" });
    expect(sourceSignal.aborted).toBe(false);
    const region = { id: "shared", map: {} as Awaited<ReturnType<RegionSource["load"]>>["map"] };
    finish(region);
    await expect(active).resolves.toBe(region);
    expect(loads).toBe(1);
    repository.release("shared");
  });

  it("stops a load after its last caller aborts and allows a fresh request", async () => {
    const signals: AbortSignal[] = [];
    const source: RegionSource = {
      load: (_id, signal) => {
        signals.push(signal);
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), { once: true });
        });
      },
    };
    const repository = new RegionRepository(source);
    const first = new AbortController();
    const request = repository.acquire("shared", first.signal);
    await Promise.resolve();
    first.abort();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(signals[0].aborted).toBe(true);

    const second = new AbortController();
    const retry = repository.acquire("shared", second.signal);
    await Promise.resolve();
    expect(signals).toHaveLength(2);
    second.abort();
    await expect(retry).rejects.toMatchObject({ name: "AbortError" });
  });

  it("keeps a bounded idle look-ahead window instead of retaining the explored world", async () => {
    const source: RegionSource = {
      load: async (id) => ({
        id,
        map: {
          regionName: "Test",
          width: 1,
          height: 1,
          tiles: new Uint8Array([T.GRASS]),
          wardTiles: [],
          spawn: { x: 0, y: 0 }, npcs: [], npc: { x: 0, y: 0 }, signs: [], shards: [], enemySpawns: [], bossCenter: { x: 0, y: 0 }, exits: [], campfires: [], towns: [],
          dark: false, resetOnDeath: false, lights: [],
        },
      }),
    };
    const repository = new RegionRepository(source, 2);
    const signal = new AbortController().signal;

    await repository.preload("0,0", signal);
    await repository.preload("1,0", signal);
    await repository.preload("2,0", signal);

    expect(repository.residentCount).toBe(2);
  });

  it("rejects an unreadable worker response and terminates the worker", async () => {
    const originalWorker = globalThis.Worker;
    let worker!: {
      onmessageerror: (() => void) | null;
      terminate: ReturnType<typeof vi.fn>;
      postMessage: ReturnType<typeof vi.fn>;
    };
    class FakeWorker {
      onmessageerror: (() => void) | null = null;
      terminate = vi.fn();
      postMessage = vi.fn();
      constructor() { worker = this; }
    }
    vi.stubGlobal("Worker", FakeWorker);
    try {
      const pending = new WorkerRegionSource().load("overworld", new AbortController().signal);
      worker.onmessageerror?.();
      await expect(pending).rejects.toThrow("response could not be read");
      expect(worker.terminate).toHaveBeenCalledOnce();
    } finally {
      vi.stubGlobal("Worker", originalWorker);
    }
  });
});
