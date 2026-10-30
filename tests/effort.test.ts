import { describe, expect, it } from "vitest";
import { effortFromTarget, formatEffort, loadFor, parseEffort, rpePercent } from "../src/lib/effort";

describe("effortFromTarget", () => {
  it("reads percents, single or as a range, in the formats of the sheets", () => {
    expect(effortFromTarget("70 %")).toEqual({ min: 70, max: 70 });
    expect(effortFromTarget("80%%")).toEqual({ min: 80, max: 80 });
    expect(effortFromTarget("75-85%")).toEqual({ min: 75, max: 85 });
    expect(effortFromTarget("RPE 8 · 75%")).toEqual({ min: 75, max: 75 }); // the percent wins
  });

  it("turns an RPE into a percent with the reps of the exercise", () => {
    // 6 reps at RPE 8 = 8 to failure: Epley's 100 / (1 + 8/30) ≈ 79 %.
    expect(effortFromTarget("RPE 8", "6")!.min).toBeCloseTo(78.9, 1);
    expect(effortFromTarget("RPE8", "6")).toEqual(effortFromTarget("RPE 8", "6"));
    const range = effortFromTarget("80 KG / RPE 6-7", "5")!;
    expect(range.min).toBeCloseTo(rpePercent(6, 5));
    expect(range.max).toBeCloseTo(rpePercent(7, 5));
    expect(effortFromTarget("RPE 7-7,5", "3")!.max).toBeCloseTo(rpePercent(7.5, 3));
  });

  it("has no effort without a percent, or for an RPE without numeric reps", () => {
    expect(effortFromTarget("82,5 KG")).toBeUndefined();
    expect(effortFromTarget("RPE 8", "35 SEG")).toBeUndefined();
    expect(effortFromTarget("RPE 8")).toBeUndefined();
    expect(effortFromTarget(undefined)).toBeUndefined();
  });
});

describe("calculator", () => {
  it("parses what the athlete types and shows it back", () => {
    expect(parseEffort("75")).toEqual({ min: 75, max: 75 });
    expect(parseEffort("70 - 80 %")).toEqual({ min: 70, max: 80 });
    expect(parseEffort("70,5")).toEqual({ min: 70.5, max: 70.5 });
    expect(parseEffort("mucho")).toBeUndefined();
    expect(formatEffort({ min: 78.9, max: 78.9 })).toBe("79");
    expect(formatEffort({ min: 70, max: 80 })).toBe("70-80");
  });

  it("rounds the weight to 2,5 kg", () => {
    expect(loadFor(65, 70)).toBe(45); // 45,5
    expect(loadFor(112.5, 79)).toBe(90); // 88,9
    expect(loadFor(100, 76)).toBe(75);
  });
});
