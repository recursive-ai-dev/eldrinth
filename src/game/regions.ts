import { generateMap } from "./map";
import type { MapData } from "./types";

export interface WorldRegion {
  id: string;
  map: MapData;
}

export interface RegionSource {
  load(regionId: string, signal: AbortSignal): Promise<WorldRegion>;
}

interface LoadingRegion {
  promise: Promise<WorldRegion>;
  controller: AbortController;
  users: number;
  settled: boolean;
}

/**
 * Reference-counted region cache. Requests are deduplicated; releasing a
 * region only removes the cache entry after its final user is gone.
 */
export class RegionRepository {
  /** Idle regions are a look-ahead window, never an unbounded visited-world cache. */
  private readonly cached = new Map<string, { region: WorldRegion; users: number; lastUsed: number }>();
  private readonly loading = new Map<string, LoadingRegion>();
  private clock = 0;

  constructor(private readonly source: RegionSource, private readonly maxIdleRegions = 8) {}

  get residentCount() { return this.cached.size; }

  private load(regionId: string): LoadingRegion {
    const existing = this.loading.get(regionId);
    if (existing) return existing;
    const controller = new AbortController();
    const pending: LoadingRegion = {
      promise: Promise.resolve().then(() => this.source.load(regionId, controller.signal)),
      controller,
      users: 0,
      settled: false,
    };
    this.loading.set(regionId, pending);
    void pending.promise.then(
      () => { pending.settled = true; if (this.loading.get(regionId) === pending) this.loading.delete(regionId); },
      () => { pending.settled = true; if (this.loading.get(regionId) === pending) this.loading.delete(regionId); },
    );
    return pending;
  }

  private waitFor(regionId: string, pending: LoadingRegion, signal: AbortSignal): Promise<WorldRegion> {
    if (signal.aborted) return Promise.reject(new DOMException("Region load aborted", "AbortError"));
    pending.users++;
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = () => {
        if (done) return false;
        done = true;
        signal.removeEventListener("abort", abort);
        pending.users--;
        if (pending.users === 0 && !pending.settled) {
          pending.controller.abort();
          if (this.loading.get(regionId) === pending) this.loading.delete(regionId);
        }
        return true;
      };
      const abort = () => { if (finish()) reject(new DOMException("Region load aborted", "AbortError")); };
      signal.addEventListener("abort", abort, { once: true });
      void pending.promise.then(
        (region) => { if (finish()) resolve(region); },
        (error) => { if (finish()) reject(error); },
      );
    });
  }

  async acquire(regionId: string, signal: AbortSignal): Promise<WorldRegion> {
    if (signal.aborted) throw new DOMException("Region load aborted", "AbortError");
    const cached = this.cached.get(regionId);
    if (cached) {
      cached.users++;
      cached.lastUsed = ++this.clock;
      return cached.region;
    }

    const region = await this.waitFor(regionId, this.load(regionId), signal);
    const resident = this.cached.get(regionId);
    if (resident) {
      resident.users++;
      resident.lastUsed = ++this.clock;
      return resident.region;
    }
    this.cached.set(regionId, { region, users: 1, lastUsed: ++this.clock });
    return region;
  }

  preload(regionId: string, signal: AbortSignal): Promise<WorldRegion> {
    if (signal.aborted) return Promise.reject(new DOMException("Region load aborted", "AbortError"));
    const cached = this.cached.get(regionId);
    if (cached) {
      cached.lastUsed = ++this.clock;
      return Promise.resolve(cached.region);
    }
    return this.waitFor(regionId, this.load(regionId), signal)
      .then((region) => {
        // A preload is resident but has no active owner until `acquire`.
        if (!this.cached.has(regionId)) this.cached.set(regionId, { region, users: 0, lastUsed: ++this.clock });
        this.trimIdle();
        return region;
      });
  }

  release(regionId: string) {
    const cached = this.cached.get(regionId);
    if (!cached) return;
    cached.users = Math.max(0, cached.users - 1);
    cached.lastUsed = ++this.clock;
    this.trimIdle();
  }

  private trimIdle() {
    let idle = [...this.cached.entries()].filter(([, entry]) => entry.users === 0);
    while (idle.length > this.maxIdleRegions) {
      let oldest = idle[0];
      for (const candidate of idle) if (candidate[1].lastUsed < oldest[1].lastUsed) oldest = candidate;
      this.cached.delete(oldest[0]);
      idle = idle.filter(([id]) => id !== oldest[0]);
    }
  }
}

/**
 * The generated prototype overworld is loaded off the main thread. Future
 * authored regions implement `RegionSource` and keep the same lifecycle.
 */
export class WorkerRegionSource implements RegionSource {
  load(regionId: string, signal: AbortSignal): Promise<WorldRegion> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Region load aborted", "AbortError"));
        return;
      }
      const worker = new Worker(new URL("./region.worker.ts", import.meta.url), { type: "module" });
      const fail = (error: unknown) => {
        signal.removeEventListener("abort", abort);
        worker.terminate();
        reject(error);
      };
      const abort = () => {
        worker.terminate();
        reject(new DOMException("Region load aborted", "AbortError"));
      };
      signal.addEventListener("abort", abort, { once: true });
      worker.onmessage = ({ data }: MessageEvent<{ id: string; map: MapData }>) => {
        if (data?.id !== regionId || !data.map || !(data.map.tiles instanceof Uint8Array)) {
          fail(new Error("Region worker returned invalid map data."));
          return;
        }
        signal.removeEventListener("abort", abort);
        worker.terminate();
        resolve(data);
      };
      worker.onerror = (event) => {
        fail(event.error ?? new Error("Region worker failed."));
      };
      worker.onmessageerror = () => fail(new Error("Region worker response could not be read."));
      try {
        worker.postMessage({ id: regionId });
      } catch (error) {
        fail(error);
      }
    });
  }
}

class LocalRegionSource implements RegionSource {
  async load(regionId: string, signal: AbortSignal): Promise<WorldRegion> {
    // Used only by non-browser test environments. Yielding keeps its API async.
    await Promise.resolve();
    if (signal.aborted) throw new DOMException("Region load aborted", "AbortError");
    return { id: regionId, map: generateMap(regionId) };
  }
}

export function createRegionRepository(): RegionRepository {
  return new RegionRepository(typeof Worker === "undefined" ? new LocalRegionSource() : new WorkerRegionSource());
}
