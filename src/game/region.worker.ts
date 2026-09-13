/// <reference lib="webworker" />
import { generateMap } from "./map";

self.onmessage = ({ data }: MessageEvent<{ id: string }>) => {
  const map = generateMap(data.id);
  self.postMessage({ id: data.id, map }, [map.tiles.buffer]);
};

export {};
