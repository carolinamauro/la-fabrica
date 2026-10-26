import { auth, sheets, type sheets_v4 } from "@googleapis/sheets";

// Coach edits show up in the app within this window.
const CACHE_TTL_MS = 60_000;

type Rows = string[][];

const cache = new Map<string, { expiresAt: number; rows: Promise<Rows> }>();
let client: sheets_v4.Sheets | undefined;

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
  const key = `${spreadsheetId}:${range}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.rows;

  const rows = getClient()
    .spreadsheets.values.get({ spreadsheetId, range, valueRenderOption: "FORMATTED_VALUE" })
    .then((res) => (res.data.values ?? []).map((row) => row.map((cell) => String(cell ?? ""))));

  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, rows });
  // Don't keep failures cached: the next request retries.
  rows.catch(() => cache.delete(key));
  return rows;
}

export function getMasterSpreadsheetId(): string {
  return requireEnv("MASTER_SPREADSHEET_ID");
}
