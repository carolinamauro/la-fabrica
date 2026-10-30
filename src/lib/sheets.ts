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

/** Drops every cached read, so the next ones come straight from the sheets (pull to refresh). */
export function clearSheetCache() {
  cache.clear();
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

let googleAuth: InstanceType<typeof auth.GoogleAuth> | undefined;

function getAuth() {
  googleAuth ??= new auth.GoogleAuth({
    credentials: {
      client_email: requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      // Vercel and .env files store the key on one line with literal "\n".
      private_key: requireEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
    },
    scopes: [
      // Write access is only used to append results to REGISTRO_PLANIFICACION and to fill the
      // Carga/Reps cells of MI_PLANIFICACION.
      "https://www.googleapis.com/auth/spreadsheets",
      // Who a file is shared with (to offer the CrossFit plan to athletes who have it).
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ],
  });
  return googleAuth;
}

function getClient(): sheets_v4.Sheets {
  client ??= sheets({ version: "v4", auth: getAuth() });
  return client;
}

/**
 * Reads a range as displayed in the sheet (formatted text), cached for CACHE_TTL_MS.
 * `fresh` skips the cached copy (for reads that decide where to write).
 */
export function readRange(spreadsheetId: string, range: string, { fresh = false } = {}): Promise<Rows> {
  if (fresh) cache.delete(`values:${spreadsheetId}:${range}`);
  return cached(`values:${spreadsheetId}:${range}`, () =>
    getClient()
      .spreadsheets.values.get({ spreadsheetId, range, valueRenderOption: "FORMATTED_VALUE" })
      .then((res) => (res.data.values ?? []).map((row) => row.map((cell) => String(cell ?? "")))),
  );
}

/**
 * Adds rows after the last row of `range`, typed as if entered by hand (dates and numbers are
 * parsed), and drops the cached copy so the next read sees them.
 */
export async function appendRows(spreadsheetId: string, range: string, rows: (string | number)[][]): Promise<void> {
  await getClient().spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
  cache.delete(`values:${spreadsheetId}:${range}`);
}

/**
 * Writes values into cells (A1 ranges such as "MI_PLANIFICACION!I9:J9"), typed as if entered by
 * hand, and drops the cached copy of `cachedRange` so the next read sees them.
 */
export async function writeCells(
  spreadsheetId: string,
  data: { range: string; values: (string | number)[][] }[],
  cachedRange: string,
): Promise<void> {
  if (!data.length) return;
  await getClient().spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
  cache.delete(`values:${spreadsheetId}:${cachedRange}`);
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

export type Sharing = { type: string; emailAddress?: string; domain?: string };

/** Who a Drive file is shared with (Drive API v3 permissions), cached for CACHE_TTL_MS. */
export function readSharing(fileId: string): Promise<Sharing[]> {
  return cached(`sharing:${fileId}`, async () => {
    const result: Sharing[] = [];
    let pageToken: string | undefined;
    do {
      const res = await getAuth().request<{ permissions?: Sharing[]; nextPageToken?: string }>({
        url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions`,
        params: { fields: "nextPageToken,permissions(type,emailAddress,domain)", pageSize: 100, supportsAllDrives: true, pageToken },
      });
      result.push(...(res.data.permissions ?? []));
      pageToken = res.data.nextPageToken;
    } while (pageToken);
    return result;
  });
}

export function getMasterSpreadsheetId(): string {
  return requireEnv("MASTER_SPREADSHEET_ID");
}

export function getCrossfitSpreadsheetId(): string {
  return requireEnv("CROSSFIT_SPREADSHEET_ID");
}
