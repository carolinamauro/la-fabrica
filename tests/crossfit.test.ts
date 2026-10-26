import { describe, expect, it } from "vitest";
import { findSideColumns, formatPercent, parseAnexo, parseCrossfitDays } from "../src/lib/crossfit";
import fixture from "./fixtures/crossfit.json";

// Fixture: the CrossFit file exported as the Sheets API returns it (formatted values + hidden columns).
const days = parseCrossfitDays(fixture.plan, fixture.hiddenColumns);
const day = (name: string) => days.find((d) => d.day === name)!;

describe("parseCrossfitDays", () => {
  it("finds every day and the week of the visible column group", () => {
    expect(days.map((d) => d.day)).toEqual(["DIA 1", "DIA 2", "DIA 3", "DIA 4", "DIA 5"]);
    expect(days.every((d) => d.week === "SEMANA 2")).toBe(true);
  });

  it("splits a day into labelled blocks and drops empty ones", () => {
    expect(day("DIA 1").blocks.map((b) => b.title)).toEqual(["ENTRADA EN CALOR", "BLOQUE 1", "BLOQUE 2", "BLOQUE 3"]);
    expect(day("DIA 1").blocks[3].exercises.map((e) => e.name)).toEqual([
      "D. 4 MIN ON X 1'30 MIN OFF X 5 RONDAS:",
      "10 SHUTTLE RUN (2X7,5M)",
      "8 2DB DEVIL PRESS (2X22,5/2X15KG)",
      "16 WB (9/6KG)",
      "AMRAP CAL/MTS/SEG REMO",
    ]);
  });

  it("keeps repeated block labels as separate blocks", () => {
    expect(day("DIA 4").blocks.map((b) => b.title)).toEqual(["ENTRADA EN CALOR", "BLOQUE 1", "BLOQUE 1", "BLOQUE 1"]);
  });

  it("attaches the visible SERIES/REPS/RPE/% values to their line, ignoring hidden columns", () => {
    const backSquat = day("DIA 1").blocks[1].exercises.find((e) => e.name === "4 BACK SQUAT");
    // Hidden column H has 70% on the same row; the athlete sees 75% in column O.
    expect(backSquat).toEqual({ name: "4 BACK SQUAT", sets: undefined, reps: undefined, target: "75%" });

    const clean = day("DIA 2").blocks[2].exercises[1];
    expect(clean).toMatchObject({ name: "1 POWER CLEAN + 2 FRONT SQUAT + 1 JERK", target: "65-70%" });
  });

  it("does not put a section that follows the warm-up inside the warm-up", () => {
    const [warmUp, untitled] = day("DIA 5").blocks;
    expect(warmUp.exercises).toHaveLength(1);
    expect(untitled.title).toBe("");
    expect(untitled.exercises.map((e) => e.name)).toEqual([
      "A. 3 RONDAS:",
      "8 STRICT T2B",
      "12 ROLL OUT ABS",
      '30" SQUAT HOLD EN PARED',
    ]);
  });

  it("uses whichever group the coach leaves visible", () => {
    // Unhide the last group (AQ…AU) and hide K…Q: values now come from that group.
    const hidden = fixture.hiddenColumns.map((_, i) => i < 42);
    const firstDay = parseCrossfitDays(fixture.plan, hidden)[0];
    expect(firstDay.week).toBe("SEMANA 1");
    expect(firstDay.blocks[1].exercises.find((e) => e.name === "4 BACK SQUAT")?.target).toBeUndefined();
  });
});

describe("findSideColumns", () => {
  it("returns null when every group is hidden", () => {
    expect(findSideColumns(["", "", "", "SERIES", "REPS"], [false, false, false, true, true])).toBeNull();
  });
});

describe("parseAnexo", () => {
  const anexo = parseAnexo(fixture.anexo);

  it("reads the intro and both plans", () => {
    expect(anexo.intro).toHaveLength(3);
    expect(anexo.plans.map((p) => p.title)).toEqual(["PLAN DE FUERZA", "PLAN DE GIMNASTICOS"]);
  });

  it("builds one block per day for each week, skipping empty weeks", () => {
    const fuerza = anexo.plans[0];
    expect(fuerza.weeks.map((w) => w.week)).toEqual(["SEMANA 1", "SEMANA 2", "SEMANA 3"]);
    expect(fuerza.weeks[1].blocks).toEqual([
      {
        title: "DIA 1",
        lines: [],
        exercises: [
          { name: "BANCO PLANO TOMA CERRADA", sets: "3", reps: "8", target: "RPE 8" },
          { name: "REMO A 90 AGARRE SUPINO", sets: "3", reps: "8", target: "RPE 8" },
        ],
      },
      {
        title: "DIA 2",
        lines: [],
        exercises: [
          { name: "BUENOS DIAS CON BARRA", sets: "3", reps: "10", target: "RPE 7" },
          { name: "SENTADILLA CICLISTAS CON BARRA", sets: "3", reps: "10", target: "RPE 7" },
        ],
      },
    ]);
  });

  it("keeps free-text prescriptions as written", () => {
    const gym = anexo.plans[1].weeks[0].blocks;
    expect(gym[0].exercises[1]).toEqual({ name: "T2B O PULL/C2B/BMU", sets: "6", reps: "6", target: "EN EMOM" });
    expect(gym[1].exercises[0]).toEqual({ name: "DU O DU CROSSOVER", sets: undefined, reps: "12 MIN", target: undefined });
  });
});

describe("formatPercent", () => {
  it("formats decimals and keeps text", () => {
    expect(formatPercent("0.75")).toBe("75%");
    expect(formatPercent("75%")).toBe("75%");
    expect(formatPercent("65-70%")).toBe("65-70%");
    expect(formatPercent("EN EMOM")).toBe("EN EMOM");
    expect(formatPercent("")).toBeUndefined();
  });
});
