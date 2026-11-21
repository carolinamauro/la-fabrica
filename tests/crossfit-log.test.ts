import { describe, expect, it } from "vitest";
import { parseCrossfitDays } from "../src/lib/crossfit";
import {
  crossfitCatalog,
  crossfitLogKey,
  crossfitRecords,
  formatScore,
  liftName,
  loggableItems,
  validScore,
  type CrossfitLog,
} from "../src/lib/crossfit-log";
import { parseCrossfitLog } from "../src/lib/firestore";
import { buildHistory, parseRounds } from "../src/lib/history";
import { personalRecordOver } from "../src/lib/results";
import fixture from "./fixtures/crossfit.json";

const days = parseCrossfitDays(fixture.plan, fixture.hiddenColumns);
const items = (day: number) => [...loggableItems(days[day]).values()];

describe("what a CrossFit day lets the athlete log", () => {
  it("cleans lift lines into exercise names", () => {
    expect(liftName("4 BACK SQUAT")).toBe("BACK SQUAT");
    expect(liftName("A: 10 PUSH PRESS (RPE8)")).toBe("PUSH PRESS");
    expect(liftName("10+10 SENTADILLA BÚLGARA CON BARRA")).toBe("SENTADILLA BÚLGARA CON BARRA");
    expect(liftName("2 HANG POWER SNATCH")).toBe("HANG POWER SNATCH");
  });

  it("logs lifts with their series and reps, and scored sections as WODs (never the warm-up)", () => {
    // "A. 3 RONDAS:" of mobility isn't scored; "D. 4 MIN ON X …" is.
    expect(items(0)).toEqual([
      { kind: "lift", id: "l6", exercise: "BACK SQUAT", sets: 6, reps: 4 },
      { kind: "lift", id: "l8", exercise: "PUSH PRESS", sets: 3, reps: 10 },
      { kind: "lift", id: "l9", exercise: "PULL UP CON CARGA", sets: 3, reps: 5 },
      { kind: "wod", id: "w11", name: "4 MIN ON X 1'30 MIN OFF X 5 RONDAS · 10 SHUTTLE RUN" },
    ]);
    // E1:30M X 6 RONDAS → 6 series of the snatch; E3MO3M X 4 RONDAS → 4 of the bench. A coach's
    // note with a % next to it isn't a lift.
    expect(items(2).filter((i) => i.kind === "lift")).toEqual([
      expect.objectContaining({ exercise: "HANG POWER SNATCH", sets: 6, reps: 2 }),
      expect.objectContaining({ exercise: "BENCH PRESS", sets: 4, reps: 6 }),
    ]);
    // "3 POWER CLEAN (75%)": the % on the line; the AMRAP is named by its first line.
    expect(items(3).map((i) => (i.kind === "lift" ? i.exercise : i.name))).toEqual(["PAUSE DEADLIFT", "POWER CLEAN", "PRESS MILITAR", "3 RONDAS · AMRAP 6 MIN"]);
    // The only movement of an E2MO2M is a lift even without a %.
    expect(items(1).map((i) => i.kind)).toEqual(["lift"]);
    expect(items(4)[0]).toMatchObject({ kind: "lift", exercise: "POWER CLEAN + 2 SPLIT JERK", sets: 6, reps: 2 });
  });

  it("keys the log by week, day and content", () => {
    const key = crossfitLogKey(days[0]);
    expect(key).toMatch(/^SEMANA-2__DIA-1__[0-9a-f]{8}$/);
    expect(crossfitLogKey(structuredClone(days[0]))).toBe(key);
    // Same labels, new programming (next cycle): a new log.
    const next = structuredClone(days[0]);
    next.blocks[1].exercises[5].target = "80%";
    expect(crossfitLogKey(next)).not.toBe(key);
  });
});

describe("a day written one part per block (ACTIVACIÓN, FUERZA, WORKOUT OF THE DAY)", () => {
  const e = (name: string, target?: string) => ({ name, target });
  const day = {
    week: "SEMANA 2",
    day: "DIA 1",
    blocks: [
      { title: "ENTRADA EN CALOR", lines: [], exercises: [e("MOVILIDAD GENERAL 10 MIN")] },
      { title: "ACTIVACIÓN", lines: [], exercises: [e("E1:30M X 6 RONDAS:"), e("15 V-UPS"), e("MAX SEG HOLD LONG TALL PLANK")] },
      { title: "LEVANTAMIENTO", lines: [], exercises: [e("E2MO2M X 5 RONDAS:"), e("1 PAUSE SQUAT CLEAN + 2 LOW HANG POWER CLEAN (70-75%)")] },
      { title: "FUERZA", lines: [], exercises: [e("E3MO3M X 5 RONDAS:"), e("2 DEADLIFT (80%)"), e("4 SEATED HIGH JUMP https://youtu.be/x")] },
      { title: "WORKOUT OF THE DAY", lines: [], exercises: [e("FOR TIME"), e("40-30-20-10"), e("ONE ARM DB PUSH PRESS (22,5/15KG)")] },
    ],
  };

  it("takes each block's first line as the part's scheme", () => {
    expect([...loggableItems(day).values()]).toEqual([
      { kind: "lift", id: "l5", exercise: "PAUSE SQUAT CLEAN + 2 LOW HANG POWER CLEAN", sets: 5, reps: 1 },
      { kind: "lift", id: "l7", exercise: "DEADLIFT", sets: 5, reps: 2 },
      { kind: "wod", id: "w9", name: "FOR TIME · ONE ARM DB PUSH PRESS" },
    ]);
  });
});

describe("WOD scores", () => {
  it("formats and validates each kind", () => {
    expect(formatScore({ type: "time", seconds: 755 })).toBe("12:35");
    expect(formatScore({ type: "rounds", rounds: 5, reps: 12 })).toBe("5 + 12");
    expect(formatScore({ type: "reps", reps: 120 })).toBe("120 reps");
    expect(validScore({ type: "time", seconds: 0 })).toMatch(/tiempo/);
    expect(validScore({ type: "rounds", rounds: 0, reps: 0 })).toMatch(/rondas/);
    expect(validScore({ type: "reps", reps: 80 })).toBeNull();
  });

  it("orders rounds + reps as one number", () => {
    expect(parseRounds("5+12")).toBeCloseTo(5.012);
    expect(parseRounds("6")).toBe(6);
    expect(parseRounds("x")).toBeUndefined();
  });
});

const log = (key: string, entries: CrossfitLog["entries"]): CrossfitLog => ({ key, week: "SEMANA 2", day: "DIA 1", entries });

describe("CrossFit logs in the history", () => {
  const logs = [
    log("A", {
      l6: { kind: "lift", exercise: "BACK SQUAT", line: "4 BACK SQUAT", sets: [{ set: 1, load: 100, reps: 4, at: "2026-11-02T19:00:00" }, { set: 2, load: 105, reps: 4, at: "2026-11-02T19:03:00" }] },
      w11: { kind: "wod", name: "AMRAP 12 · WALL BALL", score: { type: "rounds", rounds: 5, reps: 12 }, rx: true, at: "2026-11-02T19:30:00" },
    }),
    log("B", {
      w3: { kind: "wod", name: "AMRAP 12 · WALL BALL", score: { type: "rounds", rounds: 6, reps: 3 }, rx: true, at: "2026-11-16T19:30:00" },
      w5: { kind: "wod", name: "FRAN", score: { type: "time", seconds: 275 }, rx: false, at: "2026-11-16T20:00:00" },
    }),
  ];

  it("joins lifts to the catalog's exercise and gives WODs their own entries", () => {
    const records = crossfitRecords(logs);
    expect(records.filter((r) => r.exercise === "BACK SQUAT")).toHaveLength(2);
    // A lift cleared again leaves nothing.
    expect(crossfitCatalog([log("C", { l1: { kind: "lift", exercise: "DEADLIFT", line: "2 DEADLIFT", sets: [] } })], new Set())).toEqual([]);
    // BACK SQUAT is in the athlete's catalog already: only the WODs are new.
    const extra = crossfitCatalog(logs, new Set(["BACK SQUAT"]));
    expect(extra.map((e) => [e.key, e.category, e.measurement, e.better])).toEqual([
      ["AMRAP 12 · WALL BALL", "WOD", "ROUNDS", "HIGHER"],
      ["FRAN", "WOD", "TIME", "LOWER"],
    ]);

    const history = buildHistory(extra, records, 70);
    const amrap = history.find((e) => e.key === "AMRAP 12 · WALL BALL")!;
    expect(amrap.metric).toBe("rounds");
    expect(amrap.days.map((d) => d.value)).toEqual([6.003, 5.012]);
    expect(history.find((e) => e.key === "FRAN")!.summary.best).toBe(275);
  });

  it("finds a PR against every earlier series, wherever it was logged", () => {
    const before = crossfitRecords(logs).filter((r) => r.exercise === "BACK SQUAT");
    expect(personalRecordOver(before, "BACK SQUAT", [{ set: 1, load: 110, reps: 3 }])).toMatchObject({ kind: "load", previous: 105, load: 110 });
    expect(personalRecordOver(before, "BACK SQUAT", [{ set: 1, load: 105, reps: 4 }])).toBeUndefined();
  });

  it("reads stored logs, leaving out anything malformed", () => {
    const parsed = parseCrossfitLog("K", {
      week: "SEMANA 2",
      day: "DIA 1",
      entries: {
        l6: { kind: "lift", exercise: "BACK SQUAT", line: "4 BACK SQUAT", sets: { s2: { load: 105, reps: 4, at: "2026-11-02T19:03:00" }, s1: { load: 100, at: "2026-11-02T19:00:00" }, s3: { at: "x" } } },
        w1: { kind: "wod", name: "FRAN", score: { type: "time", seconds: 275 }, rx: true, at: "2026-11-02T19:30:00" },
        w2: { kind: "wod", name: "BAD", score: { type: "distance" }, at: "2026-11-02T19:30:00" },
      },
    });
    expect(parsed.entries.l6).toMatchObject({ sets: [{ set: 1, load: 100 }, { set: 2, load: 105, reps: 4 }] });
    expect(parsed.entries.w1).toMatchObject({ kind: "wod", rx: true, score: { type: "time", seconds: 275 } });
    expect(parsed.entries.w2).toBeUndefined();
  });
});
