import { describe, expect, it } from "vitest";
import {
  buildExerciseHistory,
  buildHistory,
  defaultExercise,
  parseDecimal,
  parseDuration,
  parseHistoryCatalog,
  parseHistoryRecords,
  parseTimestamp,
  type CatalogExercise,
} from "../src/lib/history";

// Same headers as the real tabs.
const CATALOG_HEADER = [
  "EJERCICIO", "TIPO_ATLETA", "CATEGORIA", "TIPO_MEDICION", "UNIDAD", "MEJOR_RESULTADO",
  "PESO_CORPORAL", "E1RM", "REGISTRAR_HISTORIAL", "INCLUIR_INDICE",
];
const REGISTRO_HEADER = [
  "FECHA", "ID_ATLETA", "SEMANA", "DIA", "EJERCICIO", "SERIE", "REPS_PRESCRIPTAS", "CARGA",
  "REPS_REALES", "RESULTADO", "UNIDAD", "NOTA", "OBJETIVO", "PESO_CORPORAL", "E1RM", "RATIO_BW",
];

type Row = { at: string; id?: string; name: string; set?: string; load?: string; reps?: string; result?: string; unit?: string };
const registro = (...rows: Row[]) => [
  REGISTRO_HEADER,
  ...rows.map(({ at, id = "ATL_A", name, set = "1", load = "", reps = "", result = "", unit = "" }) => [
    at, id, "SEMANA 1", "DIA 2", name, set, "3", load, reps, result || load || reps, unit, "", "", "66", "", "",
  ]),
];

const strength: CatalogExercise = {
  key: "PAUSE BENCH PRESS",
  name: "PAUSE BENCH PRESS",
  category: "TREN SUPERIOR",
  measurement: "LOAD_REPS",
  better: "HIGHER",
  withE1rm: true,
  withBodyWeight: true,
};

// The rows behind the HISTORIAL tab's PAUSE BENCH PRESS example (as Sheets displays them).
const pauseBench = registro(
  { at: "15/09/2026 17:28:47", name: "PAUSE BENCH PRESS", set: "1", load: "50", reps: "4" },
  { at: "10/09/2026 14:43:56", name: "PAUSE BENCH PRESS", set: "2", load: "50" }, // no reps: counts for best load only
  { at: "10/09/2026 14:49:21", name: "PAUSE BENCH PRESS", set: "3", load: "50" },
  { at: "1/10/2026 15:45:28", name: "PAUSE BENCH PRESS", set: "1", load: "52,5", reps: "3" },
  { at: "1/10/2026 15:44:56", name: "PAUSE BENCH PRESS", set: "2", load: "52,5", reps: "3" },
  { at: "16/09/2026 7:46:24", name: "PAUSE BENCH PRESS", set: "3", load: "55", reps: "3" },
  { at: "16/09/2026 7:50:22", name: "PAUSE BENCH PRESS", set: "4", load: "55", reps: "3" },
  { at: "1/10/2026 15:38:44", name: "PAUSE BENCH PRESS", set: "1", load: "55", reps: "3" },
  { at: "1/10/2026 15:39:05", name: "PAUSE BENCH PRESS", set: "2", load: "55", reps: "3" },
  { at: "1/10/2026 15:30:00", id: "ATL_B", name: "PAUSE BENCH PRESS", load: "90", reps: "5" }, // other athlete
);

describe("parsing sheet values", () => {
  it("reads decimals with comma or dot and a KG suffix", () => {
    expect(parseDecimal("52,5")).toBe(52.5);
    expect(parseDecimal("52.5")).toBe(52.5);
    expect(parseDecimal("60,50 KG")).toBe(60.5);
    expect(parseDecimal("1.234,5")).toBe(1234.5);
    expect(parseDecimal("")).toBeUndefined();
    expect(parseDecimal("RPE 8")).toBeUndefined();
  });

  it("reads the sheet's d/MM/yyyy dates and the app's yyyy-MM-dd ones", () => {
    expect(parseTimestamp("1/10/2026 15:45:28")).toEqual({ at: "2026-10-01T15:45:28", date: "2026-10-01" });
    expect(parseTimestamp("2026-10-26 8:30:00")).toEqual({ at: "2026-10-26T08:30:00", date: "2026-10-26" });
    expect(parseTimestamp("01/10/2026")).toEqual({ at: "2026-10-01T00:00:00", date: "2026-10-01" });
    expect(parseTimestamp("13/31/2026")).toBeUndefined();
    expect(parseTimestamp("")).toBeUndefined();
  });

  it("reads times as m:ss, h:mm:ss or seconds", () => {
    expect(parseDuration("4:35")).toBe(275);
    expect(parseDuration("0:04:35")).toBe(275);
    expect(parseDuration("1:04:35")).toBe(3875);
    expect(parseDuration("95")).toBe(95);
    expect(parseDuration("rápido")).toBeUndefined();
    expect(parseDuration("")).toBeUndefined();
  });
});

describe("parseHistoryCatalog", () => {
  const catalog = [
    CATALOG_HEADER,
    ["BACK SQUAT", "FUERZA", "TREN INFERIOR", "CARGA_REPS", "KG", "MAYOR", "SI", "SI", "SI", "SI"],
    ["STRICT PULL UP", "FUERZA", "TREN SUPERIOR", "REPS", "", "MAYOR", "SI", "NO", "SI", "SI"],
    ["WEIGHTED STRICT PULL UP", "FUERZA", "TREN SUPERIOR", "CARGA ", "KG", "MAYOR", "SI", "SI", "SI", "SI"],
    ["SNATCH", "CROSSFIT", "WEIGHTLIFTING", "CARGA_REPS", "KG", "MAYOR", "SI", "SI", "SI", "SI"],
    ["FRAN", "CROSSFIT", "BENCHMARK", "TIEMPO", "MIN:SEG", "MENOR", "NO", "NO", "SI", "SI"],
    ["SNATCH", "FUERZA", "OLÍMPICOS", "CARGA_REPS", "KG", "MAYOR", "SI", "SI", "SI", "SI"],
    ["BICEPS CURL", "FUERZA", "ACCESORIOS", "CARGA_REPS", "KG", "MAYOR", "SI", "NO", "NO", "NO"],
    [" back  squat ", "FUERZA", "TREN INFERIOR", "CARGA_REPS", "KG", "MAYOR", "SI", "SI", "SI", "SI"],
  ];

  it("lists exercises enabled for history once, with how to measure them", () => {
    const parsed = parseHistoryCatalog(catalog, "FUERZA");
    expect(parsed.map((e) => e.key)).toEqual(["BACK SQUAT", "STRICT PULL UP", "WEIGHTED STRICT PULL UP", "SNATCH", "FRAN"]);
    expect(parsed.find((e) => e.key === "STRICT PULL UP")).toMatchObject({ measurement: "REPS", withE1rm: false });
    expect(parsed.find((e) => e.key === "WEIGHTED STRICT PULL UP")).toMatchObject({ measurement: "LOAD", withE1rm: true });
    expect(parsed.find((e) => e.key === "FRAN")).toMatchObject({ measurement: "TIME", better: "LOWER", withBodyWeight: false });
  });

  it("prefers the entry of the athlete's own type for a repeated name", () => {
    expect(parseHistoryCatalog(catalog, "FUERZA").find((e) => e.key === "SNATCH")?.category).toBe("OLÍMPICOS");
    expect(parseHistoryCatalog(catalog, "CROSSFIT").find((e) => e.key === "SNATCH")?.category).toBe("WEIGHTLIFTING");
  });

  it("returns nothing when the tab has no REGISTRAR_HISTORIAL column", () => {
    expect(parseHistoryCatalog([["EJERCICIO"], ["BACK SQUAT"]])).toEqual([]);
  });
});

describe("parseHistoryRecords", () => {
  it("keeps only the athlete's rows and normalizes exercise names", () => {
    const records = parseHistoryRecords(
      registro(
        { at: "25/08/2026 11:51:24", name: "SNATCH ", load: "80", reps: "2" },
        { at: "25/08/2026 12:08:05", name: "snatch", load: "85", reps: "3" },
        { at: "25/08/2026 12:08:05", name: "SNATCH", id: "ATL_B", load: "40", reps: "3" },
        { at: "sin fecha", name: "SNATCH", load: "90", reps: "1" },
      ),
      " ATL_A ",
    );
    expect(records.map((r) => [r.exercise, r.load])).toEqual([["SNATCH", 80], ["SNATCH", 85]]);
  });

  it("fails loudly when the tab changed shape", () => {
    expect(() => parseHistoryRecords([["ID_ATLETA"]], "ATL_A")).toThrow(/missing/);
  });
});

describe("strength history (HISTORIAL's PAUSE BENCH PRESS example)", () => {
  const history = buildExerciseHistory(strength, parseHistoryRecords(pauseBench, "ATL_A"), 66);

  it("matches the sheet's summary", () => {
    const { summary } = history;
    expect(summary.bestLoad).toBe(55);
    expect(summary.bestE1rm).toBeCloseTo(60.5, 6);
    expect(summary.ratio).toBeCloseTo(0.9167, 4);
    expect(summary.lastAt).toBe("2026-10-01T15:45:28");
    expect(summary.progress).toBeCloseTo(6.7647, 3);
  });

  it("keeps the best-E1RM set of each day, newest day first", () => {
    expect(history.days.map((d) => [d.date, d.best.load, d.best.reps, Number(d.value.toFixed(2))])).toEqual([
      ["2026-10-01", 55, 3, 60.5],
      ["2026-09-16", 55, 3, 60.5],
      ["2026-09-15", 50, 4, 56.67],
    ]);
    expect(history.days[0].ratio).toBeCloseTo(0.9167, 4);
  });

  it("keeps every set of a day for the detail, by series and then time", () => {
    expect(history.days[0].sets.map((s) => [s.set, s.at.slice(11)])).toEqual([
      [1, "15:38:44"], [1, "15:45:28"], [2, "15:39:05"], [2, "15:44:56"],
    ]);
    expect(history.days[0].topLoad).toBe(55);
  });

  it("leaves out days whose sets have no reps (no E1RM), but counts their load as best load", () => {
    expect(history.days.some((d) => d.date === "2026-09-10")).toBe(false);
    const onlyLoads = buildExerciseHistory(
      strength,
      parseHistoryRecords(registro({ at: "10/09/2026 14:43:56", name: "PAUSE BENCH PRESS", load: "70" }), "ATL_A"),
      66,
    );
    expect(onlyLoads.days).toEqual([]);
    expect(onlyLoads.summary).toMatchObject({ bestLoad: 70, bestE1rm: undefined, progress: undefined, lastAt: "2026-09-10T14:43:56" });
  });

  it("separates best load from best E1RM", () => {
    const records = parseHistoryRecords(
      registro(
        { at: "1/09/2026 10:00:00", name: "PAUSE BENCH PRESS", load: "60", reps: "1" }, // E1RM 62
        { at: "1/09/2026 10:05:00", name: "PAUSE BENCH PRESS", load: "50", reps: "8" }, // E1RM 63.3
      ),
      "ATL_A",
    );
    const { summary, days } = buildExerciseHistory(strength, records, 66);
    expect(summary.bestLoad).toBe(60);
    expect(summary.bestE1rm).toBeCloseTo(63.33, 2);
    expect(days[0].best).toMatchObject({ load: 50, reps: 8 });
    expect(days[0].topLoad).toBe(60);
  });

  it("shows no ratio without a body weight", () => {
    const { summary, days } = buildExerciseHistory(strength, parseHistoryRecords(pauseBench, "ATL_A"));
    expect(summary.ratio).toBeUndefined();
    expect(days[0].ratio).toBeUndefined();
  });

  it("uses the load when the catalog has no E1RM", () => {
    const { metric, summary, days } = buildExerciseHistory(
      { ...strength, withE1rm: false },
      parseHistoryRecords(pauseBench, "ATL_A"),
      66,
    );
    expect(metric).toBe("load");
    expect(summary.bestE1rm).toBeUndefined();
    expect(days.map((d) => d.value)).toEqual([55, 55, 50, 50]) // 10/09 counts: no reps needed;
    expect(summary.progress).toBeCloseTo(10, 6);
  });
});

describe("reps and time history", () => {
  const pullUps: CatalogExercise = {
    ...strength, key: "STRICT PULL UP", name: "STRICT PULL UP", measurement: "REPS", withE1rm: false,
  };
  const fran: CatalogExercise = {
    ...strength, key: "FRAN", name: "FRAN", measurement: "TIME", better: "LOWER", withE1rm: false, withBodyWeight: false,
  };

  it("tracks the most reps per day without E1RM or ratio", () => {
    const records = parseHistoryRecords(
      registro(
        { at: "20/08/2026 20:03:31", name: "STRICT PULL UP", set: "1", reps: "8", unit: "REPS" },
        { at: "20/08/2026 20:03:38", name: "STRICT PULL UP", set: "2", reps: "6", unit: "REPS" },
        { at: "27/08/2026 20:00:00", name: "STRICT PULL UP", set: "1", result: "10", unit: "REPS" },
        { at: "27/08/2026 20:01:00", name: "STRICT PULL UP", set: "2" }, // incomplete
      ),
      "ATL_A",
    );
    const { metric, days, summary } = buildExerciseHistory(pullUps, records, 66);
    expect(metric).toBe("reps");
    expect(days.map((d) => [d.date, d.value])).toEqual([["2026-08-27", 10], ["2026-08-20", 8]]);
    expect(summary).toMatchObject({ best: 10, bestE1rm: undefined, ratio: undefined, bestLoad: undefined });
    expect(summary.progress).toBeCloseTo(25, 6);
    expect(days[0].sets).toHaveLength(2);
  });

  it("treats a lower time as better", () => {
    const records = parseHistoryRecords(
      registro(
        { at: "1/08/2026 9:00:00", name: "FRAN", result: "0:05:00", unit: "MIN:SEG" },
        { at: "1/09/2026 9:00:00", name: "FRAN", result: "0:04:30", unit: "MIN:SEG" },
        { at: "1/09/2026 9:30:00", name: "FRAN", result: "0:04:45", unit: "MIN:SEG" },
        { at: "1/10/2026 9:00:00", name: "FRAN", result: "4:50", unit: "MIN:SEG" },
      ),
      "ATL_A",
    );
    const { metric, days, summary } = buildExerciseHistory(fran, records, 66);
    expect(metric).toBe("time");
    expect(days.map((d) => d.value)).toEqual([290, 270, 300]);
    expect(summary.best).toBe(270);
    expect(summary.progress).toBeCloseTo(10, 6); // 10% less time than the first one
    expect(summary.ratio).toBeUndefined();
  });
});

describe("buildHistory", () => {
  it("lists every catalog exercise, with or without records, and matches names exactly", () => {
    const bench: CatalogExercise = { ...strength, key: "BENCH PRESS", name: "BENCH PRESS" };
    const history = buildHistory([strength, bench], parseHistoryRecords(pauseBench, "ATL_A"), 66);
    expect(history.map((e) => [e.key, e.days.length])).toEqual([["PAUSE BENCH PRESS", 3], ["BENCH PRESS", 0]]);
    expect(history[1].summary).toMatchObject({ bestLoad: undefined, lastAt: undefined, progress: undefined });
  });

  it("opens the remembered exercise, else the latest trained one", () => {
    const list = [
      { key: "A", summary: { lastAt: "2026-09-01T10:00:00" } },
      { key: "B", summary: { lastAt: "2026-10-01T10:00:00" } },
      { key: "C", summary: {} },
    ];
    expect(defaultExercise(list, " c ")).toBe("C");
    expect(defaultExercise(list, "GONE")).toBe("B");
    expect(defaultExercise([{ key: "C", summary: {} }])).toBe("C");
    expect(defaultExercise([])).toBeUndefined();
  });
});
