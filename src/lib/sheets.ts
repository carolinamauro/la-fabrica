import { auth, sheets, type sheets_v4 } from "@googleapis/sheets";

// Coach edits show up in the app within this window.
const CACHE_TTL_MS = 60_000;

type Rows = string[][];

const cache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();
let client: sheets_v4.Sheets | undefined;

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as Promise<T>;

  const value = load();
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  // Don't keep failures cached: the next request retries.
  value.catch(() => cache.delete(key));
  return value;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function getClient(): sheets_v4.Sheets {
  client ??= sheets({
    version: "v4",
    auth: new auth.GoogleAuth({
      credentials: {
        client_email: requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
        // Vercel and .env files store the key on one line with literal "\n".
        private_key: requireEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    }),
  });
  return client;
}

/** Reads a range as displayed in the sheet (formatted text), cached for CACHE_TTL_MS. */
export function readRange(spreadsheetId: string, range: string): Promise<Rows> {
  return cached(`values:${spreadsheetId}:${range}`, () =>
    getClient()
      .spreadsheets.values.get({ spreadsheetId, range, valueRenderOption: "FORMATTED_VALUE" })
      .then((res) => (res.data.values ?? []).map((row) => row.map((cell) => String(cell ?? "")))),
  );
}

/** For each column of a tab (A, B, C…), whether the coach has hidden it. */
export function readHiddenColumns(spreadsheetId: string, sheetName: string): Promise<boolean[]> {
  return cached(`hidden:${spreadsheetId}:${sheetName}`, () =>
    getClient()
      .spreadsheets.get({
        spreadsheetId,
        ranges: [`'${sheetName}'!1:1`],
        fields: "sheets.data.columnMetadata.hiddenByUser",
      })
      .then((res) => (res.data.sheets?.[0]?.data?.[0]?.columnMetadata ?? []).map((c) => Boolean(c.hiddenByUser))),
  );
}

export function getMasterSpreadsheetId(): string {
  return requireEnv("MASTER_SPREADSHEET_ID");
}

export function getCrossfitSpreadsheetId(): string {
  return requireEnv("CROSSFIT_SPREADSHEET_ID");
}
