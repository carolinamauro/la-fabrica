import { describe, expect, it } from "vitest";
import {
  buildResultRows,
  epley,
  findSheetRow,
  formatRecordedAt,
  buildRmRow,
  mergeSheetLoads,
  mergeSheetNotes,
  parseBestLoads,
  parseE1rmExercises,
  parseNotes,
  parseResults,
  parseSheetLoads,
  setCount,
  sheetLoadCells,
} from "../src/lib/results";

// Same header as the real REGISTRO_PLANIFICACION tab.
const HEADER = [
  "FECHA", "ID_ATLETA", "SEMANA", "DIA", "EJERCICIO", "SERIE", "REPS_PRESCRIPTAS", "CARGA",
  "REPS_REALES", "RESULTADO", "UNIDAD", "NOTA", "OBJETIVO", "PESO_CORPORAL", "E1RM", "RATIO_BW",
];
const row = (id: string, week: string, day: string, name: string, set: string, load: string, reps: string, note = "") =>
  ["2026-09-01 10:00:00", id, week, day, name, set, "8", load, reps, "", "", note];

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
    note: "",
    previousNote: "",
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

  it("puts the note on every row, as text so it never becomes a formula", () => {
    const rows = buildResultRows({
      ...base,
      withE1rm: false,
      previous: [],
      note: "=agarre cerrado",
      sets: [{ set: 1, load: 100, reps: 8 }, { set: 2, load: 100, reps: 8 }],
    });
    expect(rows.map((r) => r[11])).toEqual(["'=agarre cerrado", "'=agarre cerrado"]);
  });

  it("writes a changed note alone as a row without series or results", () => {
    const rows = buildResultRows({ ...base, withE1rm: false, sets: [{ set: 1, load: 100, reps: 8 }], note: "usar cinturón" });
    expect(rows).toEqual([["2026-10-26 08:30:00", "ATL_A", "SEMANA 1", "DIA 2", "HIP THRUST", "", "", "", "", "", "", "'usar cinturón", "", "", "", ""]]);
    // Nothing changed: nothing to write.
    expect(buildResultRows({ ...base, withE1rm: false, sets: [], note: "x", previousNote: "x" })).toEqual([]);
    // A cleared note is a change too.
    expect(buildResultRows({ ...base, withE1rm: false, sets: [], previousNote: "x" })).toHaveLength(1);
  });
});

describe("parseNotes", () => {
  it("takes the day's note from its last row, and the latest note of another day", () => {
    const rows = [
      HEADER,
      row("ATL_A", "SEMANA 1", "DIA 1", "HIP THRUST", "1", "100", "8", "subir despacio"),
      row("ATL_A", "SEMANA 1", "DIA 2", "HIP THRUST", "1", "100", "8", "primera"),
      row("ATL_A", "SEMANA 1", "DIA 2", "HIP THRUST", "", "", "", "pies más abiertos"),
      row("ATL_A", "SEMANA 1", "DIA 2", "PULL UP", "1", "", "12", "con banda"),
      row("ATL_A", "SEMANA 1", "DIA 2", "PULL UP", "", "", "", ""), // cleared
      row("ATL_B", "SEMANA 1", "DIA 2", "HIP THRUST", "1", "50", "8", "de otro atleta"),
    ];
    expect(parseNotes(rows, "ATL_A", selection)).toEqual({
      "HIP THRUST": { note: "pies más abiertos", previous: { week: "SEMANA 1", day: "DIA 1", note: "subir despacio" } },
      "PULL UP": { note: "" },
    });
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

describe("MI_PLANIFICACION loads", () => {
  // As read from MI_PLANIFICACION!A3:T (row 3 is the week/day selector, row 5 the header).
  const sheetRows = [
    ["SEMANA :", "SEMANA 1", "DIA :", "DIA 2"],
    ["", "", "", "", "", "", "", "", "SERIE 1", "", "SERIE 2"],
    ["ORDEN", "EJERCICIO", "SERIES", "REPETICIONES", "OBJETIVO", "DESCANSO", "INTERVALO", "NOTAS", "CARGA", "REPS", "CARGA", "REPS"],
    ["A1", "HIP THRUST", "3", "8", "", "", "", "", "97,50 KG", "8", "100,00 KG", "8"],
    ["", "PULL UP", "3", "12"],
    ["B1", "PULL UP", "3", "10", "", "", "", "", "", "10"],
  ];
  const sheet = parseSheetLoads(sheetRows)!;

  it("reads the open day, the Carga/Reps columns and each row's sheet row number", () => {
    expect(sheet.selection).toEqual(selection);
    expect(sheet.loadColumns).toEqual([8, 10]);
    expect(sheet.rows).toEqual([
      { row: 6, order: "A1", name: "HIP THRUST", sets: [{ set: 1, load: 97.5, reps: 8 }, { set: 2, load: 100, reps: 8 }], note: "" },
      { row: 7, order: "A1", name: "PULL UP", sets: [], note: "" },
      { row: 8, order: "B1", name: "PULL UP", sets: [{ set: 1, load: undefined, reps: 10 }], note: "" },
    ]);
  });

  it("finds an exercise's row by name and ORDEN", () => {
    expect(findSheetRow(sheet, { name: "Pull up", order: "B1" })?.row).toBe(8);
    expect(findSheetRow(sheet, { name: "HIP THRUST", order: "Z9" })?.row).toBe(6); // only one with that name
    expect(findSheetRow(sheet, { name: "PULL UP", order: "Z9" })).toBeUndefined(); // ambiguous
  });

  it("takes an exercise's loads from the sheet as is, so cleared cells stay cleared", () => {
    const empty = parseSheetLoads(sheetRows.slice(0, 4).concat([["A2", "SQUAT"]]))!;
    expect(mergeSheetLoads({ SQUAT: [{ set: 1, load: 95, reps: 3 }] }, empty).SQUAT).toBeUndefined();

    const saved = {
      "HIP THRUST": [{ set: 1, load: 90, reps: 8 }, { set: 3, load: 90, reps: 8 }],
      "BENCH PRESS": [{ set: 1, load: 50, reps: 5 }],
    };
    const merged = mergeSheetLoads(saved, sheet);
    expect(merged["HIP THRUST"]).toEqual([
      { set: 1, load: 97.5, reps: 8 },
      { set: 2, load: 100, reps: 8 },
    ]);
    expect(merged["BENCH PRESS"]).toEqual([{ set: 1, load: 50, reps: 5 }]); // not loaded in the sheet
  });

  it("writes each series into its Carga/Reps pair, clearing empty values", () => {
    const sets = [{ set: 1, load: 100, reps: 8 }, { set: 2, reps: 6 }, { set: 3, load: 50, reps: 5 }];
    expect(sheetLoadCells(sheet, 6, sets)).toEqual([
      { range: "MI_PLANIFICACION!I6:J6", values: [[100, 8]] },
      { range: "MI_PLANIFICACION!K6:L6", values: [["", 6]] },
    ]);
  });

  it("reads and writes NOTAS ALUMNO, whose header is on the SERIE row", () => {
    const withNotes = parseSheetLoads([
      ["SEMANA :", "SEMANA 1", "DIA :", "DIA 2"],
      ["", "", "", "", "", "", "", "", "SERIE 1", "", "NOTAS ALUMNO"],
      ["ORDEN", "EJERCICIO", "SERIES", "REPETICIONES", "OBJETIVO", "DESCANSO", "LINKS", "NOTAS", "CARGA", "REPS"],
      ["A1", "HIP THRUST", "3", "8", "", "", "", "", "100", "8", "pies abiertos"],
    ])!;
    expect(withNotes.noteColumn).toBe(10);
    expect(withNotes.rows[0].note).toBe("pies abiertos");
    expect(mergeSheetNotes({ "HIP THRUST": { note: "vieja" } }, withNotes)["HIP THRUST"].note).toBe("pies abiertos");
    // An empty cell (left from another day) doesn't erase the saved note.
    expect(mergeSheetNotes({ "HIP THRUST": { note: "vieja" } }, { ...withNotes, rows: [{ ...withNotes.rows[0], note: "" }] })).toEqual({
      "HIP THRUST": { note: "vieja" },
    });
    expect(sheetLoadCells(withNotes, 6, [], "nueva")).toEqual([{ range: "MI_PLANIFICACION!K6", values: [["'nueva"]] }]);
    expect(sheet.noteColumn).toBe(-1);
  });

  it("returns null when the tab has no header", () => {
    expect(parseSheetLoads([["SEMANA :", "SEMANA 1"]])).toBeNull();
  });
});

describe("RM from the load calculator", () => {
  it("is a one-rep row without week, day or series, so HISTORIAL takes it as the best load", () => {
    const row = buildRmRow({
      header: HEADER,
      athlete: { id: "ATL_A", bodyWeightKg: 80 },
      name: "BENCH PRESS",
      rm: 70,
      withE1rm: true,
      recordedAt: "2026-10-30 09:00:00",
    });
    expect(row).toEqual(["2026-10-30 09:00:00", "ATL_A", "", "", "BENCH PRESS", "", "", 70, 1, 70, "KG", "", "RM", 80, 72.3, 0.9]);
    // Not a series of any day, nor a note.
    // As the sheet returns it: every cell as text.
    const rows = [HEADER, row.map(String)];
    expect(parseResults(rows, "ATL_A", selection)).toEqual({});
    expect(parseNotes(rows, "ATL_A", selection)["BENCH PRESS"]).toEqual({ note: "" });
  });

  it("best loads are the heaviest CARGA of each exercise on any day", () => {
    const rows = [
      HEADER,
      row("ATL_A", "SEMANA 1", "DIA 2", "HIP THRUST", "1", "100", "8"),
      row("ATL_A", "SEMANA 3", "DIA 1", "Hip Thrust", "2", "97,50 KG", "8"),
      row("ATL_A", "SEMANA 2", "DIA 1", "HIP THRUST", "1", "110", "5"),
      row("ATL_A", "SEMANA 1", "DIA 2", "PULL UP", "1", "", "12"),
      row("ATL_B", "SEMANA 1", "DIA 2", "HIP THRUST", "1", "200", "1"),
    ];
    expect(parseBestLoads(rows, "ATL_A")).toEqual({ "HIP THRUST": 110 });
  });
});
