import { describe, expect, it } from "vitest";
import {
  buildResultRows,
  epley,
  formatRecordedAt,
  parseE1rmExercises,
  parseResults,
  setCount,
} from "../src/lib/results";

// Same header as the real REGISTRO_PLANIFICACION tab.
const HEADER = [
  "FECHA", "ID_ATLETA", "SEMANA", "DIA", "EJERCICIO", "SERIE", "REPS_PRESCRIPTAS", "CARGA",
  "REPS_REALES", "RESULTADO", "UNIDAD", "NOTA", "OBJETIVO", "PESO_CORPORAL", "E1RM", "RATIO_BW",
];
const row = (id: string, week: string, day: string, name: string, set: string, load: string, reps: string) =>
  ["2026-09-01 10:00:00", id, week, day, name, set, "8", load, reps];

const selection = { week: "SEMANA 1", day: "DIA 2" };

describe("parseResults", () => {
  const rows = [
    HEADER,
    row("ATL_A", "SEMANA 1", "DIA 2", "HIP THRUST", "1", "100", "8"),
    row("ATL_A", "SEMANA 1", "DIA 2", "HIP THRUST", "2", "110", "8"),
    row("ATL_A", "SEMANA 1", "DIA 2", "HIP THRUST", "1", "105", "7"), // later correction wins
    row("ATL_A", "SEMANA 1", "DIA 2", "PULL UP", "1", "", "12"),
    row("ATL_A", "SEMANA 2", "DIA 2", "HIP THRUST", "1", "120", "8"), // other week
    row("ATL_B", "SEMANA 1", "DIA 2", "HIP THRUST", "1", "50", "8"), // other athlete
    row("ATL_A", "1", "LUNES", "HIP THRUST", "1", "90", "8"), // legacy format
  ];

  it("returns the latest value per exercise and set for that athlete and day", () => {
    expect(parseResults(rows, "ATL_A", selection)).toEqual({
      "HIP THRUST": [
        { set: 1, load: 105, reps: 7 },
        { set: 2, load: 110, reps: 8 },
      ],
      "PULL UP": [{ set: 1, load: undefined, reps: 12 }],
    });
  });

  it("fails loudly when the tab changed shape", () => {
    expect(() => parseResults([["FECHA", "ID_ATLETA"]], "ATL_A", selection)).toThrow(/missing/);
  });
});

describe("buildResultRows", () => {
  const base = {
    header: HEADER,
    athlete: { id: "ATL_A", bodyWeightKg: 80 },
    selection,
    exercise: { name: "HIP THRUST", order: "A", sets: "3", reps: "8", target: "RPE8" },
    previous: [{ set: 1, load: 100, reps: 8 }],
    recordedAt: "2026-10-26 08:30:00",
  };

  it("writes changed sets in the tab's column order, with E1RM and ratio when the catalog asks", () => {
    const rows = buildResultRows({
      ...base,
      withE1rm: true,
      sets: [
        { set: 1, load: 100, reps: 8 }, // unchanged → skipped
        { set: 2, load: 110, reps: 8 },
        { set: 3 }, // empty → skipped
      ],
    });
    expect(rows).toEqual([
      ["2026-10-26 08:30:00", "ATL_A", "SEMANA 1", "DIA 2", "HIP THRUST", 2, 8, 110, 8, 110, "KG", "", "RPE8", 80, 139.3, 1.74],
    ]);
  });

  it("stores reps-only sets as REPS and leaves E1RM empty", () => {
    const [written] = buildResultRows({ ...base, withE1rm: true, previous: [], sets: [{ set: 1, reps: 12 }] });
    expect(written.slice(7, 11)).toEqual(["", 12, 12, "REPS"]);
    expect(written.slice(14)).toEqual(["", ""]);
  });

  it("keeps non-numeric prescribed reps as written", () => {
    const [written] = buildResultRows({
      ...base,
      withE1rm: false,
      previous: [],
      exercise: { ...base.exercise, reps: "10+10" },
      sets: [{ set: 1, load: 20, reps: 10 }],
    });
    expect(written[6]).toBe("10+10");
    expect(written[14]).toBe("");
  });
});

describe("helpers", () => {
  it("setCount clamps the prescribed series to 1–6", () => {
    expect([setCount("3"), setCount("10"), setCount("0"), setCount(undefined), setCount("x")]).toEqual([3, 6, 1, 1, 1]);
  });

  it("epley matches the values already in the sheet", () => {
    expect(epley(90, 4)).toBe(102);
    expect(epley(100, 8)).toBe(126.7);
  });

  it("parseE1rmExercises reads the catalog flag", () => {
    const catalog = [
      ["EJERCICIO", "TIPO_ATLETA", "E1RM"],
      ["BACK SQUAT", "FUERZA", "SI"],
      ["STRICT PULL UP", "FUERZA", "NO"],
    ];
    expect([...parseE1rmExercises(catalog)]).toEqual(["BACK SQUAT"]);
  });

  it("formatRecordedAt uses Argentina time in a format Sheets parses as a date", () => {
    expect(formatRecordedAt(new Date("2026-10-26T11:30:05Z"))).toBe("2026-10-26 08:30:05");
  });
});
