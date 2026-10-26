import { describe, expect, it } from "vitest";
import { buildWorkout, formatDuration, listWeeks, parsePlanRows, pickDay } from "../src/lib/personalized";
import base from "./fixtures/base-planificacion.json";

// Fixture: BASE_PLANIFICACION exported from a real athlete file, athlete IDs replaced.
const rows = parsePlanRows(base, "ATL_B");
const weeks = listWeeks(rows);

describe("parsePlanRows", () => {
  it("keeps only the requested athlete's rows", () => {
    expect(rows.length).toBeGreaterThan(100);
    expect(parsePlanRows(base, "ATL_A").map((r) => r.exercise.name)).toEqual([
      "HIP THRUST",
      "BACK SQUAT",
      "BENCH PRESS",
      "BARBELL GOOD MORNING",
      "DEADLIFT",
    ]);
    expect(parsePlanRows(base, "ATL_UNKNOWN")).toEqual([]);
  });

  it("fails loudly when a required column is missing", () => {
    expect(() => parsePlanRows([["EJERCICIO", "SERIES"]], "ATL_B")).toThrow(/missing/);
  });
});

describe("listWeeks", () => {
  it("lists weeks and days in numeric order", () => {
    expect(weeks.map((w) => w.week)).toEqual(["SEMANA 1", "SEMANA 2", "SEMANA 3", "SEMANA 4", "SEMANA 5"]);
    expect(weeks[2].days).toEqual(["DIA 1", "DIA 2"]);
  });
});

describe("buildWorkout", () => {
  it("groups exercises into blocks by ORDEN letter, in order", () => {
    const workout = buildWorkout(rows, "SEMANA 3", "DIA 1");
    expect(workout.blocks.map((b) => b.title)).toEqual(["A", "B", "C", "D", "E"]);
    expect(workout.blocks[0].exercises.map((e) => e.order)).toEqual(["A1", "A2", "A3"]);
    expect(workout.blocks[1].exercises[0]).toEqual({
      name: "BACK SQUAT",
      order: "B",
      sets: "4",
      reps: "3",
      target: "RPE 8",
      rest: "2 MIN",
      interval: undefined,
      notes: undefined,
    });
  });

  it("keeps reps and targets as written", () => {
    const exercises = buildWorkout(rows, "SEMANA 3", "DIA 1").blocks.flatMap((b) => b.exercises);
    expect(exercises.find((e) => e.name === "ZERCHER MARCH")?.reps).toBe("35 SEG");
    expect(exercises.find((e) => e.name === "ROW INTERVALS")).toMatchObject({ reps: "2 MIN", target: "500M CADA RONDA" });
  });

  it("turns WOD rows into text lines, including a trailing row without ORDEN", () => {
    const wod = buildWorkout(rows, "SEMANA 3", "DIA 2").blocks.find((b) => b.title === "E")!;
    expect(wod.exercises).toEqual([]);
    expect(wod.lines).toEqual([
      "4 RONDAS:",
      "800 M RUN",
      "RITMO 5'30''/KM",
      "250M ROW",
      "2 PASADAS BURPEES BROAD JUMP",
      "2 MIN REST X RONDA",
    ]);
  });

  it("splits multi-line WOD notes and drops blank lines", () => {
    const wod = buildWorkout(rows, "SEMANA 5", "DIA 2").blocks.find((b) => b.title === "E")!;
    expect(wod.lines).toEqual(["5 RONDAS:", "15 T2B", "12 DB SNATCH (15KG)", "15 WB", "1 MIN REST X RONDA"]);
  });

  it("puts an exercise without ORDEN in an untitled block", () => {
    const athleteA = parsePlanRows(base, "ATL_A");
    expect(buildWorkout(athleteA, "SEMANA 1", "DIA 3").blocks).toEqual([
      { title: "", lines: [], exercises: [expect.objectContaining({ name: "BENCH PRESS", order: "" })] },
    ]);
  });

  it("returns no blocks for a day that doesn't exist", () => {
    expect(buildWorkout(rows, "SEMANA 9", "DIA 1").blocks).toEqual([]);
  });
});

describe("pickDay", () => {
  it("uses the first candidate that exists in the plan, ignoring case and spacing", () => {
    expect(pickDay(weeks, { week: "semana  2", day: "dia 3" })).toEqual({ week: "SEMANA 2", day: "DIA 3" });
    expect(pickDay(weeks, { week: "SEMANA 9", day: "DIA 1" }, { week: "SEMANA 3", day: "DIA 2" })).toEqual({
      week: "SEMANA 3",
      day: "DIA 2",
    });
  });

  it("falls back to the first day of the latest week", () => {
    expect(pickDay(weeks, {})).toEqual({ week: "SEMANA 5", day: "DIA 1" });
    expect(pickDay([], {})).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats duration cells and keeps text as written", () => {
    expect(formatDuration("00:02:00")).toBe("2 MIN");
    expect(formatDuration("0:01:30")).toBe("1 MIN 30 SEG");
    expect(formatDuration("00:00:45")).toBe("45 SEG");
    expect(formatDuration(" 2MIN ")).toBe("2MIN");
    expect(formatDuration("")).toBeUndefined();
  });
});
