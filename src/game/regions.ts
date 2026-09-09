import { generateMap } from "./map";
import type { MapData } from "./types";

export interface WorldRegion {
  id: string;
  map: MapData;
}

export interface RegionSource {
  load(regionId: string, signal: AbortSignal): Promise<WorldRegion>;
}

/**
 * Reference-counted region cache. Requests are deduplicated; releasing a
 * region only removes the cache entry after its final user is gone.
 */
export class RegionRepository {
  private readonly cached = new Map<string, { region: WorldRegion; users: number }>();
  private readonly loading = new Map<string, Promise<WorldRegion>>();

  constructor(private readonly source: RegionSource) {}

  async acquire(regionId: string, signal: AbortSignal): Promise<WorldRegion> {
    const cached = this.cached.get(regionId);
    if (cached) {
      cached.users++;
      return cached.region;
    }

    let pending = this.loading.get(regionId);
    if (!pending) {
      pending = this.source.load(regionId, signal);
      this.loading.set(regionId, pending);
    }
    try {
      const region = await pending;
      const resident = this.cached.get(regionId);
      if (resident) {
        resident.users++;
        return resident.region;
      }
      this.cached.set(regionId, { region, users: 1 });
      return region;
    } finally {
      this.loading.delete(regionId);
    }
  }

  preload(regionId: string, signal: AbortSignal): Promise<WorldRegion> {
    const cached = this.cached.get(regionId);
    if (cached) return Promise.resolve(cached.region);
    const loading = this.loading.get(regionId);
    if (loading) return loading;
    const pending = this.source.load(regionId, signal);
    this.loading.set(regionId, pending);
    return pending
      .then((region) => {
        // A preload is resident but has no active owner until `acquire`.
        if (!this.cached.has(regionId)) this.cached.set(regionId, { region, users: 0 });
        return region;
      })
      .finally(() => this.loading.delete(regionId));
  }

  release(regionId: string) {
    const cached = this.cached.get(regionId);
    if (!cached) return;
    cached.users--;
    if (cached.users <= 0) this.cached.delete(regionId);
  }
}

/**
 * The generated prototype overworld is loaded off the main thread. Future
 * authored regions implement `RegionSource` and keep the same lifecycle.
 */
export class WorkerRegionSource implements RegionSource {
  load(regionId: string, signal: AbortSignal): Promise<WorldRegion> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./region.worker.ts", import.meta.url), { type: "module" });
      const abort = () => {
        worker.terminate();
        reject(new DOMException("Region load aborted", "AbortError"));
      };
      signal.addEventListener("abort", abort, { once: true });
      worker.onmessage = ({ data }: MessageEvent<{ id: string; map: MapData }>) => {
        signal.removeEventListener("abort", abort);
        worker.terminate();
        resolve(data);
      };
      worker.onerror = (event) => {
        signal.removeEventListener("abort", abort);
        worker.terminate();
        reject(event.error ?? new Error("Region worker failed."));
      };
      worker.postMessage({ id: regionId });
    });
  }
}

class LocalRegionSource implements RegionSource {
  async load(regionId: string, signal: AbortSignal): Promise<WorldRegion> {
    // Used only by non-browser test environments. Yielding keeps its API async.
    await Promise.resolve();
    if (signal.aborted) throw new DOMException("Region load aborted", "AbortError");
    return { id: regionId, map: generateMap() };
  }
}

export function createRegionRepository(): RegionRepository {
  return new RegionRepository(typeof Worker === "undefined" ? new LocalRegionSource() : new WorkerRegionSource());
}
