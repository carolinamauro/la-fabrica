import { describe, expect, it } from "vitest";
import {
  durationFromText,
  formatClock,
  PREPARE_SECONDS,
  previousWorkIndex,
  segmentsAfterJump,
  segmentStart,
  segments,
  stateAt,
  timerFromExercise,
  timerFromText,
} from "../src/lib/timer";

describe("segments", () => {
  it("starts every timer with the prepare countdown", () => {
    expect(segments({ mode: "amrap", time: 12 * 60 + 30 })).toEqual([
      { phase: "prepare", seconds: PREPARE_SECONDS, round: 0, rounds: 0 },
      { phase: "work", seconds: 750, round: 1, rounds: 1 },
    ]);
  });

  it("repeats N series of blocks, with rest between blocks and between series", () => {
    // 10 series (1:00 between them) of 5 blocks of 4:00 work / 0:30 rest.
    const list = segments({ mode: "series", groups: [{ sets: 10, setRest: 60, blocks: 5, work: 240, rest: 30, restAfter: 0 }] }).slice(1);
    const count = (phase: string) => list.filter((s) => s.phase === phase).length;
    expect([count("work"), count("rest"), count("setRest")]).toEqual([50, 40, 9]);
    expect(list.reduce((sum, s) => sum + s.seconds, 0)).toBe(10 * (5 * 240 + 4 * 30) + 9 * 60);
    expect(list.at(-1)).toMatchObject({ phase: "work", serie: 10, series: 10, round: 5, rounds: 5 });
  });

  it("chains groups with different shapes and a rest between them", () => {
    const list = segments({
      mode: "series",
      groups: [
        { sets: 2, setRest: 60, blocks: 2, work: 40, rest: 20, restAfter: 90 },
        { sets: 1, setRest: 0, blocks: 2, work: 30, rest: 0, restAfter: 60 },
      ],
    }).slice(1);
    expect(list.map((s) => `${s.phase}:${s.seconds} g${s.group}/${s.groups} s${s.serie}/${s.series} b${s.round}/${s.rounds}`)).toEqual([
      "work:40 g1/2 s1/2 b1/2",
      "rest:20 g1/2 s1/2 b1/2",
      "work:40 g1/2 s1/2 b2/2",
      "setRest:60 g1/2 s1/2 b0/0",
      "work:40 g1/2 s2/2 b1/2",
      "rest:20 g1/2 s2/2 b1/2",
      "work:40 g1/2 s2/2 b2/2",
      "groupRest:90 g1/2 sundefined/undefined b0/0",
      // No rest between blocks (0), and nothing after the last group.
      "work:30 g2/2 s1/1 b1/2",
      "work:30 g2/2 s1/1 b2/2",
    ]);
  });

  it("alternates work and rest in a tabata, without a final rest", () => {
    const list = segments({ mode: "tabata", work: 20, rest: 10, rounds: 3 }).slice(1);
    expect(list.map((s) => `${s.phase}${s.round}`)).toEqual(["work1", "rest1", "work2", "rest2", "work3"]);
  });

  it("gives an EMOM one segment per minute", () => {
    expect(segments({ mode: "emom", every: 60, rounds: 15 }).slice(1)).toHaveLength(15);
  });

  it("runs a For Time without cap until it is stopped", () => {
    expect(segments({ mode: "fortime", cap: 0 })[1].seconds).toBe(Infinity);
    expect(segments({ mode: "fortime", cap: 615 })[1].seconds).toBe(615);
  });
});

describe("stateAt", () => {
  const list = segments({ mode: "tabata", work: 20, rest: 10, rounds: 2 });

  it("finds the current segment and time left", () => {
    expect(stateAt(list, 5)).toMatchObject({ done: false, segment: { phase: "prepare" }, remaining: 5 });
    expect(stateAt(list, PREPARE_SECONDS + 25)).toMatchObject({ segment: { phase: "rest", round: 1 }, elapsed: 5, remaining: 5 });
  });

  it("is done after the last segment", () => {
    expect(stateAt(list, PREPARE_SECONDS + 50).done).toBe(true);
  });

  it("never finishes an open-ended For Time", () => {
    expect(stateAt(segments({ mode: "fortime", cap: 0 }), 99_999)).toMatchObject({ done: false, elapsed: 99_999 - PREPARE_SECONDS });
  });
});

describe("skipping", () => {
  // prepare, work1, rest1, work2, rest2, work3
  const list = segments({ mode: "tabata", work: 20, rest: 10, rounds: 3 });

  it("knows when each segment starts", () => {
    expect([0, 1, 2, 3].map((i) => segmentStart(list, i))).toEqual([0, PREPARE_SECONDS, PREPARE_SECONDS + 20, PREPARE_SECONDS + 30]);
    expect(segmentStart(list, list.length)).toBe(PREPARE_SECONDS + 80);
  });

  it("goes back to the previous work block, skipping rests", () => {
    expect(previousWorkIndex(list, 5)).toBe(3); // from work3 → work2
    expect(previousWorkIndex(list, 4)).toBe(3); // from the rest after work2 → work2
    expect(previousWorkIndex(list, 1)).toBe(0); // from the first block → the countdown
    expect(previousWorkIndex(list, 0)).toBe(0);
  });
});

describe("timerFromText", () => {
  it("reads EMOMs, including every-N-minutes ones", () => {
    expect(timerFromText("C. EMOM X 15 MIN")).toEqual({ mode: "emom", every: 60, rounds: 15 });
    expect(timerFromText("E2MOM x 10 min")).toEqual({ mode: "emom", every: 120, rounds: 5 });
  });

  it("reads AMRAPs", () => {
    expect(timerFromText("AMRAP 6 MIN")).toEqual({ mode: "amrap", time: 360 });
  });

  it("reads work/rest intervals as written by the coach", () => {
    expect(timerFromText("D. 4 MIN ON X 1'30 MIN OFF X 5 RONDAS:")).toEqual({ mode: "tabata", work: 240, rest: 90, rounds: 5 });
  });

  it("reads tabata and For Time with cap", () => {
    expect(timerFromText("TABATA")).toEqual({ mode: "tabata", work: 20, rest: 10, rounds: 8 });
    expect(timerFromText("FOR TIME (CAP 12)")).toEqual({ mode: "fortime", cap: 720 });
  });

  it("ignores lines that only mention a format", () => {
    expect(timerFromText("EN EMOM (TODO EN EL MISMO MIN)")).toBeNull();
    expect(timerFromText("AMRAP CAL/MTS/SEG REMO")).toBeNull();
    expect(timerFromText("8 SUPERMAN")).toBeNull();
  });
});

describe("open-ended series", () => {
  // 3 series of a lift, 2:00 between them, each one as long as it takes.
  const planned = segments({ mode: "series", groups: [{ sets: 3, setRest: 120, blocks: 1, work: 0, rest: 0, restAfter: 0 }] });

  it("counts a series up until the athlete moves on", () => {
    expect(planned[1]).toMatchObject({ phase: "work", seconds: Infinity, serie: 1 });
    expect(stateAt(planned, 10_000)).toMatchObject({ done: false, index: 1 });
  });

  it("keeps the time a series took when moving on, so the rest starts", () => {
    const next = segmentsAfterJump(planned, planned, 1, 45, 2);
    expect(next[1].seconds).toBe(45);
    expect(next[3].seconds).toBe(Infinity);
    expect(stateAt(next, segmentStart(next, 2))).toMatchObject({ index: 2, remaining: 120, segment: { phase: "setRest" } });
  });

  it("reopens a series when going back to it", () => {
    const moved = segmentsAfterJump(planned, planned, 1, 45, 2);
    expect(segmentsAfterJump(planned, moved, 2, 30, 1)[1].seconds).toBe(Infinity);
  });

  it("finishes an open-ended For Time at the time it took", () => {
    const fortime = segments({ mode: "fortime", cap: 0 });
    const next = segmentsAfterJump(fortime, fortime, 1, 300, 2);
    expect(stateAt(next, segmentStart(next, 2)).done).toBe(true);
  });
});

describe("timerFromExercise", () => {
  it("reads rest and timed reps as the coach writes them", () => {
    expect(durationFromText("2MIN")).toBe(120);
    expect(durationFromText("2 MIN X RONDA")).toBe(120);
    expect(durationFromText("1 MIN 30 SEG")).toBe(90);
    expect(durationFromText("30 SEG")).toBe(30);
    expect(durationFromText("10+10")).toBeNull();
  });

  it("opens N open-ended series with the rest between them", () => {
    expect(timerFromExercise({ sets: "5", reps: "3", rest: "2 MIN" })).toEqual({
      mode: "series",
      groups: [{ sets: 5, setRest: 120, blocks: 1, work: 0, rest: 0, restAfter: 0 }],
    });
  });

  it("times each series when the reps are a time", () => {
    expect(timerFromExercise({ sets: "10", reps: "2 MIN", rest: "30 SEG" })?.mode).toBe("series");
    expect(timerFromExercise({ sets: "10", reps: "2 MIN", rest: "30 SEG" })).toMatchObject({ groups: [{ sets: 10, work: 120, setRest: 30 }] });
  });

  it("needs a number of series", () => {
    expect(timerFromExercise({ reps: "10" })).toBeNull();
    expect(timerFromExercise({ sets: "3-4" })).toBeNull();
  });
});

describe("formatClock", () => {
  it("shows m:ss and h:mm:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(95.7)).toBe("1:35");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});
