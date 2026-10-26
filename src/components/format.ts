/** "SEMANA 2" → "Semana 2", "DIA 1" → "Día 1". Other labels are kept as written. */
export function prettyLabel(value: string): string {
  return value
    .replace(/^SEMANA\b/i, "Semana")
    .replace(/^D[IÍ]A\b/i, "Día");
}

/** Page search params with only the single-value ones kept. */
export function singleParams(params: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, typeof value === "string" ? value : undefined]));
}

/** Link to a plan page ("/" or "/crossfit") with the given query params (empty values are left out). */
export function homeHref(params: Record<string, string | undefined>, path = "/"): string {
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
