import { describe, expect, it } from "vitest";
import { resourceMeter } from "./hudMetrics";

describe("accessible HUD meters", () => {
  it("clamps values to the meter range", () => {
    expect(resourceMeter(-2, 10)).toEqual({ value: 0, maximum: 10, display: 0, percent: 0 });
    expect(resourceMeter(12, 10)).toEqual({ value: 10, maximum: 10, display: 10, percent: 100 });
    expect(resourceMeter(3.2, 10)).toEqual({ value: 3.2, maximum: 10, display: 4, percent: 32 });
  });
  it("keeps zero capacity and non-finite transient values out of CSS and ARIA", () => {
    for (const [value, maximum] of [[10, 0], [10, -5], [NaN, 0], [Infinity, Infinity]]) {
      expect(resourceMeter(value, maximum)).toEqual({ value: 0, maximum: 0, display: 0, percent: 0 });
    }
    expect(resourceMeter(NaN, 10)).toEqual({ value: 0, maximum: 10, display: 0, percent: 0 });
  });
});
