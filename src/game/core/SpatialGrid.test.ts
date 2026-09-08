import { describe, expect, it } from "vitest";
import { SpatialGrid } from "./SpatialGrid";

describe("SpatialGrid", () => {
  it("returns nearby entities within a radius", () => {
    const grid = new SpatialGrid({ cellSize: 32 });

    const a = { id: "a", x: 12, y: 20, r: 8 };
    const b = { id: "b", x: 80, y: 20, r: 8 };
    const c = { id: "c", x: 40, y: 40, r: 8 };

    grid.insert(a);
    grid.insert(b);
    grid.insert(c);

    const hits = grid.queryCircle(16, 20, 24);
    expect(hits.map((entity) => entity.id).sort()).toEqual(["a"]);
  });

  it("updates moved entities when the grid is rebuilt", () => {
    const grid = new SpatialGrid({ cellSize: 32 });
    const entity = { id: "moved", x: 10, y: 10, r: 10 };

    grid.insert(entity);
    expect(grid.queryCircle(10, 10, 12)).toHaveLength(1);

    entity.x = 200;
    entity.y = 200;
    grid.rebuild();

    expect(grid.queryCircle(10, 10, 12)).toHaveLength(0);
    expect(grid.queryCircle(200, 200, 16)).toHaveLength(1);
  });
});
