import { auth } from "@googleapis/sheets";
import type { CrossfitLog, WodEntry } from "./crossfit-log";
import { DEFAULT_GOALS, MAX_LIFT_GOALS, type Goals, type Profile } from "./goals";

/**
 * The athlete's own progress data that the sheets don't have (their goals, and when each badge was
 * earned), in Firestore. Only the server reads and writes it, with the same service account as the
 * sheets, through Firestore's REST API: the security rules can deny every browser.
 *
 * One document per athlete: athletes/{ID from the master ATLETAS tab}.
 */

// --- Firestore's typed values <-> plain JSON ---

type Value =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: Value[] } }
  | { mapValue: { fields?: Record<string, Value> } };

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export function toValue(value: Json): Value {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toValue(v)])) } };
}

export function fromValue(value: Value): Json {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(fromValue);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([k, v]) => [k, fromValue(v)]));
  return null;
}

/** Whatever is stored, as a valid profile (missing or malformed parts fall back to the defaults). */
export function parseProfile(data: Record<string, Json> | undefined): Profile {
  const goals = (data?.goals ?? {}) as Record<string, Json>;
  const weeklyDays = Number(goals.weeklyDays);
  const lifts = Array.isArray(goals.lifts) ? goals.lifts : [];
  const badges = data?.badges && typeof data.badges === "object" && !Array.isArray(data.badges) ? data.badges : {};
  return {
    goals: {
      weeklyDays: Number.isInteger(weeklyDays) && weeklyDays >= 1 && weeklyDays <= 7 ? weeklyDays : DEFAULT_GOALS.weeklyDays,
      lifts: lifts
        .map((lift) => lift as Record<string, Json>)
        .filter((lift) => typeof lift?.exercise === "string" && Number(lift.targetKg) > 0)
        .map((lift) => ({ exercise: String(lift.exercise), targetKg: Number(lift.targetKg) }))
        .slice(0, MAX_LIFT_GOALS),
    },
    badges: Object.fromEntries(Object.entries(badges).filter(([, at]) => typeof at === "string")) as Record<string, string>,
  };
}

// --- REST ---

let googleAuth: InstanceType<typeof auth.GoogleAuth> | undefined;

function client() {
  const projectId = process.env.FIRESTORE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!projectId || !email || !key) throw new FirestoreUnavailable("Firestore is not configured");
  googleAuth ??= new auth.GoogleAuth({
    credentials: { client_email: email, private_key: key.replace(/\\n/g, "\n") },
    scopes: ["https://www.googleapis.com/auth/datastore"],
  });
  return { auth: googleAuth, base: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents` };
}

/** Firestore can't be reached (not enabled, no access, not configured): the app works without it. */
export class FirestoreUnavailable extends Error {}

const docPath = (athleteId: string) => `athletes/${encodeURIComponent(athleteId.trim())}`;

async function request<T>(method: "GET" | "PATCH", path: string, body?: unknown, params?: URLSearchParams): Promise<T | undefined> {
  const { auth: googleAuth, base } = client();
  try {
    const authClient = await googleAuth.getClient();
    const response = await authClient.request<T>({
      url: `${base}/${path}${params ? `?${params}` : ""}`,
      method,
      data: body,
      // The home page waits for it: a slow Firestore shouldn't hold the day's plan back for long.
      timeout: 3000,
    });
    return response.data;
  } catch (error) {
    const response = (error as { response?: { status?: number; data?: { error?: { message?: string } } } }).response;
    const status = response?.status;
    // A document not created yet ("Document \"…/databases/(default)/documents/…\" not found") is
    // fine; a database not created yet ("The database (default) does not exist…") means Firestore
    // isn't set up.
    const missingDatabase = /database \S+ does not exist/i.test(response?.data?.error?.message ?? "");
    if (method === "GET" && status === 404 && !missingDatabase) return undefined;
    throw new FirestoreUnavailable(`Firestore ${method} failed${status ? ` (${status})` : ""}`);
  }
}

/** The athlete's goals and badges; null when Firestore can't be reached. */
export async function getProfile(athleteId: string): Promise<Profile | null> {
  try {
    const doc = await request<{ fields?: Record<string, Value> }>("GET", docPath(athleteId));
    const data = doc?.fields ? (fromValue({ mapValue: { fields: doc.fields } }) as Record<string, Json>) : undefined;
    return parseProfile(data);
  } catch (error) {
    if (error instanceof FirestoreUnavailable) {
      console.error("getProfile:", error.message);
      return null;
    }
    throw error;
  }
}

/** Writes only the given top-level fields (the rest of the document stays as it is). */
async function patch(athleteId: string, fields: Record<string, Json>) {
  const params = new URLSearchParams();
  for (const name of Object.keys(fields)) params.append("updateMask.fieldPaths", name);
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toValue(v)])) };
  await request("PATCH", docPath(athleteId), body, params);
}

export async function saveGoals(athleteId: string, goals: Goals) {
  await patch(athleteId, { goals: { weeklyDays: goals.weeklyDays, lifts: goals.lifts }, updatedAt: new Date().toISOString() });
}

/** Adds badges just earned (id → ISO date) to the ones already stored. */
export async function addBadges(athleteId: string, current: Record<string, string>, earned: Record<string, string>) {
  await patch(athleteId, { badges: { ...current, ...earned } });
}

// --- CrossFit logs: athletes/{id}/crossfit/{week__day__content} ---

const crossfitPath = (athleteId: string, key?: string) => `${docPath(athleteId)}/crossfit${key ? `/${encodeURIComponent(key)}` : ""}`;

const num = (value: Json | undefined) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const str = (value: Json | undefined) => (typeof value === "string" ? value : undefined);
const obj = (value: Json | undefined) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

/** A stored log as it should be (anything malformed is left out). */
export function parseCrossfitLog(key: string, data: Record<string, Json>): CrossfitLog {
  const entries: CrossfitLog["entries"] = {};
  for (const [id, raw] of Object.entries(obj(data.entries))) {
    const entry = obj(raw);
    if (entry.kind === "lift" && str(entry.exercise)) {
      const sets = Object.entries(obj(entry.sets))
        .map(([name, value]) => {
          const set = obj(value);
          return { set: Number(name.slice(1)), load: num(set.load), reps: num(set.reps), at: str(set.at) ?? "" };
        })
        .filter((s) => Number.isInteger(s.set) && s.set >= 1 && s.at && (s.load !== undefined || s.reps !== undefined))
        .sort((a, b) => a.set - b.set);
      entries[id] = { kind: "lift", exercise: str(entry.exercise)!, line: str(entry.line) ?? "", sets, note: str(entry.note) || undefined };
    } else if (entry.kind === "wod" && str(entry.name) && str(entry.at)) {
      const score = obj(entry.score);
      const type = score.type === "time" || score.type === "rounds" || score.type === "reps" ? score.type : undefined;
      if (!type) continue;
      entries[id] = {
        kind: "wod",
        name: str(entry.name)!,
        score: { type, seconds: num(score.seconds), rounds: num(score.rounds), reps: num(score.reps) },
        rx: entry.rx === true,
        note: str(entry.note) || undefined,
        at: str(entry.at)!,
      };
    }
  }
  return { key, week: str(data.week) ?? "", day: str(data.day) ?? "", entries };
}

type Document = { name?: string; fields?: Record<string, Value> };
const fieldsOf = (doc: Document) => (fromValue({ mapValue: { fields: doc.fields ?? {} } }) as Record<string, Json>);

/** One day's log; undefined when nothing was logged yet; null when Firestore can't be reached. */
export async function getCrossfitLog(athleteId: string, key: string): Promise<CrossfitLog | undefined | null> {
  try {
    const doc = await request<Document>("GET", crossfitPath(athleteId, key));
    return doc ? parseCrossfitLog(key, fieldsOf(doc)) : undefined;
  } catch (error) {
    if (error instanceof FirestoreUnavailable) {
      console.error("getCrossfitLog:", error.message);
      return null;
    }
    throw error;
  }
}

/** Every CrossFit log of the athlete; null when Firestore can't be reached. */
export async function listCrossfitLogs(athleteId: string): Promise<CrossfitLog[] | null> {
  const logs: CrossfitLog[] = [];
  try {
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ pageSize: "300" });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await request<{ documents?: Document[]; nextPageToken?: string }>("GET", crossfitPath(athleteId), undefined, params);
      for (const doc of page?.documents ?? []) {
        const key = decodeURIComponent(doc.name?.split("/").pop() ?? "");
        if (key) logs.push(parseCrossfitLog(key, fieldsOf(doc)));
      }
      pageToken = page?.nextPageToken;
    } while (pageToken);
  } catch (error) {
    if (!(error instanceof FirestoreUnavailable)) throw error;
    console.error("listCrossfitLogs:", error.message);
    return null;
  }
  return logs;
}

/**
 * Writes only the given field paths of a log ("entries.l7.sets.s2"); a path given as undefined is
 * deleted. Each series is its own field, so two series checked one right after the other never
 * overwrite each other.
 */
async function patchCrossfitLog(athleteId: string, key: string, day: { week: string; day: string }, fields: Record<string, Json | undefined>) {
  const all: Record<string, Json | undefined> = { week: day.week, day: day.day, updatedAt: new Date().toISOString(), ...fields };
  const params = new URLSearchParams();
  const body: Record<string, Json> = {};
  for (const [path, value] of Object.entries(all)) {
    params.append("updateMask.fieldPaths", path);
    if (value === undefined) continue;
    // "entries.l7.sets.s2" → { entries: { l7: { sets: { s2: value } } } }
    const parts = path.split(".");
    let node = body;
    for (const part of parts.slice(0, -1)) node = (node[part] ??= {}) as Record<string, Json>;
    node[parts[parts.length - 1]] = value;
  }
  await request("PATCH", crossfitPath(athleteId, key), { fields: Object.fromEntries(Object.entries(body).map(([k, v]) => [k, toValue(v)])) }, params);
}

/** Saves (or, without load and reps, deletes) series of one lift, and its note when given. */
export async function saveCrossfitSets(
  athleteId: string,
  key: string,
  day: { week: string; day: string },
  entry: { id: string; exercise: string; line: string },
  sets: { set: number; load?: number; reps?: number; at: string }[],
  note?: string,
) {
  const base = `entries.${entry.id}`;
  const fields: Record<string, Json | undefined> = { [`${base}.kind`]: "lift", [`${base}.exercise`]: entry.exercise, [`${base}.line`]: entry.line };
  for (const { set, load, reps, at } of sets) {
    const empty = load === undefined && reps === undefined;
    fields[`${base}.sets.s${set}`] = empty ? undefined : { at, ...(load !== undefined && { load }), ...(reps !== undefined && { reps }) };
  }
  if (note !== undefined) fields[`${base}.note`] = note || undefined;
  await patchCrossfitLog(athleteId, key, day, fields);
}

/** Saves a WOD's result, or deletes it (null). */
export async function saveCrossfitWod(
  athleteId: string,
  key: string,
  day: { week: string; day: string },
  id: string,
  wod: Omit<WodEntry, "kind"> | null,
) {
  const value = wod && {
    kind: "wod",
    name: wod.name,
    at: wod.at,
    rx: wod.rx,
    score: Object.fromEntries(Object.entries(wod.score).filter(([, v]) => v !== undefined)) as Record<string, Json>,
    ...(wod.note && { note: wod.note }),
  };
  await patchCrossfitLog(athleteId, key, day, { [`entries.${id}`]: value ?? undefined });
}
