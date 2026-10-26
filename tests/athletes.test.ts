import { describe, expect, it } from "vitest";
import { parseAthletes, spreadsheetIdFromUrl } from "../src/lib/athletes";

// Same shape as the master ATLETAS tab, with fake people.
const HEADER = ["ID", "Nombre", "Apellido", "Edad", "Peso", "Altura", "Día pago", "Sexo", "Instagram", "Mail", "Tipo", "Estado", "Archivo"];
const row = (id: string, email: string, type: string, status: string, file = "") =>
  [id, "Ana", "Test", "30", "60", "165", "1", "M", "ana", email, type, status, file];

describe("parseAthletes", () => {
  it("maps active athletes and normalizes email and type", () => {
    const [athlete] = parseAthletes([
      HEADER,
      row("ATL001", "  Ana.Test@Gmail.com ", "Fuerza", "ACTIVO", "https://docs.google.com/spreadsheets/d/abc_DEF-123/edit?gid=1#gid=1"),
    ]);

    expect(athlete).toEqual({
      id: "ATL001",
      firstName: "Ana",
      lastName: "Test",
      email: "ana.test@gmail.com",
      planType: "PERSONALIZED",
      spreadsheetId: "abc_DEF-123",
    });
  });

  it("recognizes CrossFit athletes without a personal file", () => {
    const [athlete] = parseAthletes([HEADER, row("ATL002", "cf@test.com", "CROSSFIT", "ACTIVO")]);
    expect(athlete.planType).toBe("CROSSFIT");
    expect(athlete.spreadsheetId).toBeUndefined();
  });

  it("skips inactive, incomplete and unknown-type rows", () => {
    const athletes = parseAthletes([
      HEADER,
      row("ATL003", "pending@test.com", "FUERZA", "PENDIENTE"),
      row("", "noid@test.com", "FUERZA", "ACTIVO"),
      row("ATL004", "", "FUERZA", "ACTIVO"),
      row("ATL005", "other@test.com", "YOGA", "ACTIVO"),
      [],
    ]);
    expect(athletes).toEqual([]);
  });

  it("finds columns by header name, not position", () => {
    const [athlete] = parseAthletes([
      ["Estado", "Mail", "ID", "Tipo"],
      ["ACTIVO", "a@test.com", "ATL009", "FUERZA"],
    ]);
    expect(athlete).toMatchObject({ id: "ATL009", email: "a@test.com", firstName: "" });
  });

  it("fails loudly when a required column is missing", () => {
    expect(() => parseAthletes([["ID", "Nombre"]])).toThrow(/missing/);
  });
});

describe("spreadsheetIdFromUrl", () => {
  it("returns undefined for empty or non-sheet URLs", () => {
    expect(spreadsheetIdFromUrl("")).toBeUndefined();
    expect(spreadsheetIdFromUrl("https://example.com")).toBeUndefined();
  });
});
