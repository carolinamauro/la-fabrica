import { getMasterSpreadsheetId, readRange } from "./sheets";

export type PlanType = "PERSONALIZED" | "CROSSFIT";

export type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  planType: PlanType;
  /** Personal spreadsheet (from the `Archivo` column). Only personalized athletes have one. */
  spreadsheetId?: string;
};

const ATHLETES_RANGE = "ATLETAS!A:Z";

const PLAN_TYPES: Record<string, PlanType> = {
  FUERZA: "PERSONALIZED",
  CROSSFIT: "CROSSFIT",
};

const normalize = (value: string | undefined) => (value ?? "").trim().toUpperCase();

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function spreadsheetIdFromUrl(url: string): string | undefined {
  return url.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1];
}

/**
 * Turns the master `ATLETAS` tab into active athletes.
 * Columns are located by header name so the coach can add or reorder columns.
 */
export function parseAthletes(rows: string[][]): Athlete[] {
  const [header = [], ...data] = rows;
  const col = (name: string) => header.findIndex((h) => normalize(h) === name);
  const idx = {
    id: col("ID"),
    firstName: col("NOMBRE"),
    lastName: col("APELLIDO"),
    email: col("MAIL"),
    type: col("TIPO"),
    status: col("ESTADO"),
    file: col("ARCHIVO"),
  };
  if (idx.id < 0 || idx.email < 0 || idx.type < 0 || idx.status < 0) {
    throw new Error("ATLETAS tab is missing one of the columns ID, Mail, Tipo, Estado");
  }

  return data.flatMap((row) => {
    const id = row[idx.id]?.trim();
    const email = row[idx.email]?.trim();
    const planType = PLAN_TYPES[normalize(row[idx.type])];
    if (!id || !email || !planType || normalize(row[idx.status]) !== "ACTIVO") return [];

    return [
      {
        id,
        firstName: row[idx.firstName]?.trim() ?? "",
        lastName: row[idx.lastName]?.trim() ?? "",
        email: normalizeEmail(email),
        planType,
        spreadsheetId: spreadsheetIdFromUrl(row[idx.file] ?? ""),
      },
    ];
  });
}

/** Active athlete for a login email, or null if the coach hasn't enabled that email. */
export async function findAthleteByEmail(email: string): Promise<Athlete | null> {
  const rows = await readRange(getMasterSpreadsheetId(), ATHLETES_RANGE);
  const target = normalizeEmail(email);
  return parseAthletes(rows).find((athlete) => athlete.email === target) ?? null;
}
