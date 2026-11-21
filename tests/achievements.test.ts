import { describe, expect, it } from "vitest";
import { buildAchievements, newBadges, recordEvents, weekOf, weekStreaks } from "../src/lib/achievements";
import { fromValue, parseProfile, toValue } from "../src/lib/firestore";
import { DEFAULT_GOALS } from "../src/lib/goals";
import { buildHistory, parseHistoryCatalog, parseHistoryRecords } from "../src/lib/history";
import { detectPersonalRecord } from "../src/lib/results";

const CATALOG_HEADER = ["EJERCICIO", "TIPO_ATLETA", "CATEGORIA", "TIPO_MEDICION", "UNIDAD", "MEJOR_RESULTADO", "PESO_CORPORAL", "E1RM", "REGISTRAR_HISTORIAL"];
const REGISTRO_HEADER = [
  "FECHA", "ID_ATLETA", "SEMANA", "DIA", "EJERCICIO", "SERIE", "REPS_PRESCRIPTAS", "CARGA",
  "REPS_REALES", "RESULTADO", "UNIDAD", "NOTA", "OBJETIVO", "PESO_CORPORAL", "E1RM", "RATIO_BW",
];

type Row = [date: string, name: string, load: string, reps: string, id?: string];
const registro = (...rows: Row[]) => [
  REGISTRO_HEADER,
  ...rows.map(([date, name, load, reps, id = "ATL_A"]) => [`${date} 10:00:00`, id, "SEMANA 1", "DIA 1", name, "1", "5", load, reps, load, "KG", "", "", "70", "", ""]),
];
const catalog = [
  CATALOG_HEADER,
  ["BACK SQUAT", "FUERZA", "PIERNAS", "CARGA_REPS", "KG", "MAYOR", "SI", "NO", "SI"],
  ["DEADLIFT", "FUERZA", "PIERNAS", "CARGA_REPS", "KG", "MAYOR", "SI", "NO", "SI"],
];
const historyOf = (rows: string[][]) => buildHistory(parseHistoryCatalog(catalog, "FUERZA"), parseHistoryRecords(rows, "ATL_A"));

describe("weekOf", () => {
  it("is the Monday of the date's week", () => {
    expect(weekOf("2026-11-16")).toBe("2026-11-16"); // Monday
    expect(weekOf("2026-11-21")).toBe("2026-11-16"); // Saturday
    expect(weekOf("2026-11-22")).toBe("2026-11-16"); // Sunday
    expect(weekOf("2026-11-23")).toBe("2026-11-23");
  });
});

describe("weekStreaks", () => {
  // Two days in each of the 3 weeks before 16 Nov, nothing yet this week.
  const dates = ["2026-10-26", "2026-10-28", "2026-11-02", "2026-11-04", "2026-11-09", "2026-11-11"];

  it("counts back from last week while this week isn't met yet", () => {
    expect(weekStreaks(dates, 2, "2026-11-18")).toEqual({ streak: 3, best: 3 });
  });

  it("includes this week once it is met", () => {
    expect(weekStreaks([...dates, "2026-11-16", "2026-11-17"], 2, "2026-11-18").streak).toBe(4);
  });

  it("breaks on a week below the goal, keeping the best run", () => {
    const gap = ["2026-10-05", "2026-10-07", "2026-10-12", "2026-10-14", "2026-10-19", "2026-11-09", "2026-11-10"];
    expect(weekStreaks(gap, 2, "2026-11-18")).toEqual({ streak: 1, best: 2 });
  });

  it("counts a day once however many exercises were logged", () => {
    expect(weekStreaks(["2026-11-09", "2026-11-09", "2026-11-09"], 2, "2026-11-18").streak).toBe(0);
  });
});

describe("recordEvents", () => {
  it("is every day that beat all earlier days, not the first one", () => {
    const history = historyOf(
      registro(["2026-10-01", "BACK SQUAT", "80", "5"], ["2026-10-08", "BACK SQUAT", "85", "5"], ["2026-10-15", "BACK SQUAT", "82", "5"], ["2026-10-22", "BACK SQUAT", "90", "3"]),
    );
    const events = recordEvents(history);
    expect(events.map((e) => [e.date, e.value, e.previous])).toEqual([
      ["2026-10-22", 90, 85],
      ["2026-10-08", 85, 80],
    ]);
  });
});

describe("buildAchievements", () => {
  const rows = registro(
    ["2026-11-02", "BACK SQUAT", "80", "5"],
    ["2026-11-04", "DEADLIFT", "100", "5"],
    ["2026-11-09", "BACK SQUAT", "85", "5"],
    ["2026-11-11", "OTHER THING", "10", "10"],
    ["2026-11-16", "BACK SQUAT", "90", "5"],
    ["2026-11-20", "DEADLIFT", "110", "5"],
    ["2026-11-20", "BACK SQUAT", "70", "5", "ATL_B"],
  );
  const achievements = buildAchievements({
    records: parseHistoryRecords(rows, "ATL_A"),
    history: historyOf(rows),
    goals: { weeklyDays: 2, lifts: [{ exercise: "BACK SQUAT", targetKg: 90 }, { exercise: "DEADLIFT", targetKg: 140 }] },
    today: "2026-11-21",
  });

  it("counts sessions, this week and the streak from the athlete's own rows", () => {
    expect(achievements.sessions).toBe(6);
    expect(achievements.thisWeek).toEqual({ days: 2, weekdays: [0, 4] });
    expect(achievements.streak).toBe(3);
  });

  it("counts PRs and lift goal progress", () => {
    expect(achievements.records).toBe(3);
    expect(achievements.lifts).toEqual([
      { exercise: "BACK SQUAT", name: "BACK SQUAT", targetKg: 90, bestKg: 90, reached: true },
      { exercise: "DEADLIFT", name: "DEADLIFT", targetKg: 140, bestKg: 110, reached: false },
    ]);
  });

  it("earns the badges whose rule is met and tracks progress on the rest", () => {
    const badge = (id: string) => achievements.badges.find((b) => b.id === id)!;
    expect(badge("sesion-1").earned).toBe(true);
    expect(badge("racha-2").earned).toBe(true);
    expect(badge("pr-1").earned).toBe(true);
    expect(badge("objetivo-1").earned).toBe(true);
    expect(badge("sesiones-10")).toMatchObject({ earned: false, current: 6, target: 10 });
  });

  it("finds badges earned since the ones stored", () => {
    const fresh = newBadges(achievements.badges, { "sesion-1": "2026-11-02", "pr-1": "2026-11-09" });
    expect(fresh.map((b) => b.id)).toEqual(["racha-2", "objetivo-1"]);
  });
});

describe("detectPersonalRecord", () => {
  const before = registro(["2026-11-02", "BACK SQUAT", "100", "3"], ["2026-11-09", "BACK SQUAT", "95", "5"], ["2026-11-09", "BACK SQUAT", "200", "1", "ATL_B"]);

  it("is a load record when heavier than ever", () => {
    expect(detectPersonalRecord(before, "ATL_A", "Back Squat", [{ set: 1, load: 102.5, reps: 2 }])).toEqual({
      exercise: "Back Squat",
      kind: "load",
      load: 102.5,
      reps: 2,
      previous: 100,
      value: 102.5,
    });
  });

  it("is an E1RM record with the same load and more reps", () => {
    // Best E1RM before: 95 × 5 → 110.8.
    const record = detectPersonalRecord(before, "ATL_A", "BACK SQUAT", [{ set: 1, load: 95, reps: 7 }]);
    expect(record).toMatchObject({ kind: "e1rm", load: 95, reps: 7, previous: 110.8, value: 117.2 });
  });

  it("is nothing when matching the best, on a first log, or for another athlete's rows", () => {
    expect(detectPersonalRecord(before, "ATL_A", "BACK SQUAT", [{ set: 1, load: 100, reps: 3 }])).toBeUndefined();
    expect(detectPersonalRecord(before, "ATL_A", "DEADLIFT", [{ set: 1, load: 140, reps: 3 }])).toBeUndefined();
    expect(detectPersonalRecord(before, "ATL_C", "BACK SQUAT", [{ set: 1, load: 300, reps: 1 }])).toBeUndefined();
  });
});

describe("Firestore values", () => {
  it("round-trips the profile document", () => {
    const data = { goals: { weeklyDays: 4, lifts: [{ exercise: "BACK SQUAT", targetKg: 102.5 }] }, badges: { "pr-1": "2026-11-21" } };
    expect(fromValue(toValue(data))).toEqual(data);
  });

  it("falls back to defaults for missing or invalid parts", () => {
    expect(parseProfile(undefined)).toEqual({ goals: DEFAULT_GOALS, badges: {} });
    expect(parseProfile({ goals: { weeklyDays: 12, lifts: [{ exercise: "X", targetKg: -1 }, "junk"] }, badges: { a: 3 } })).toEqual({
      goals: DEFAULT_GOALS,
      badges: {},
    });
  });
});
