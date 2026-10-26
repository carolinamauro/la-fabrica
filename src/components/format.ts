/** "SEMANA 2" → "Semana 2", "DIA 1" → "Día 1". Other labels are kept as written. */
export function prettyLabel(value: string): string {
  return value
    .replace(/^SEMANA\b/i, "Semana")
    .replace(/^D[IÍ]A\b/i, "Día");
}

/** Link to the home page with the given query params (empty values are left out). */
export function homeHref(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const text = query.toString();
  return text ? `/?${text}` : "/";
}
