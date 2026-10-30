// Load calculator: the weight to use from the athlete's RM and the effort the plan asks for.

/** Percent of the RM, as a range ("70-80%") or a single value (min = max). */
export type Effort = { min: number; max: number };

const number = (value: string) => Number(value.replace(",", "."));
const RANGE = String.raw`(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?`;
const PERCENT = new RegExp(`${RANGE}\\s*%`);
const RPE = new RegExp(`RPE\\s*${RANGE}`, "i");

/**
 * Percent of the RM for `reps` at an RPE: RPE 8 leaves 2 reps in the tank, so 6 reps at RPE 8 is
 * a set of 8 to failure, and Epley (the formula of the E1RM in HISTORIAL) turned around.
 */
export const rpePercent = (rpe: number, reps: number) => 100 / (1 + (reps + 10 - rpe) / 30);

/**
 * The effort in a target: "70 %", "75-85%", or "RPE 8" / "RPE 6-7" for numeric `reps` ("6").
 * A percent wins when the target has both. Undefined when it has neither (e.g. "82,5 KG").
 */
export function effortFromTarget(target: string | undefined, reps?: string): Effort | undefined {
  if (!target) return undefined;
  const percent = target.match(PERCENT);
  if (percent) return toEffort(percent[1], percent[2], (value) => value);
  const rpe = target.match(RPE);
  const count = Number(reps?.trim());
  if (rpe && Number.isInteger(count) && count > 0) {
    return toEffort(rpe[1], rpe[2], (value) => Math.min(rpePercent(value, count), 100));
  }
  return undefined;
}

function toEffort(from: string, to: string | undefined, toPercent: (value: number) => number): Effort | undefined {
  const [a, b] = [toPercent(number(from)), toPercent(number(to ?? from))];
  if (!(a > 0 && b > 0 && a <= 150 && b <= 150)) return undefined;
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

/** "75" or "70-80" as typed in the calculator. */
export function parseEffort(text: string): Effort | undefined {
  const match = text.trim().match(new RegExp(`^${RANGE}\\s*%?$`));
  return match ? toEffort(match[1], match[2], (value) => value) : undefined;
}

/** The effort as the calculator shows it: "79" or "70-80" (whole percents). */
export const formatEffort = ({ min, max }: Effort) =>
  Math.round(min) === Math.round(max) ? String(Math.round(min)) : `${Math.round(min)}-${Math.round(max)}`;

// Plates: the smallest jump on a barbell.
const STEP_KG = 2.5;

/** The weight for `percent` of `rm`, to the nearest 2,5 kg. */
export const loadFor = (rm: number, percent: number) => Math.round((rm * percent) / 100 / STEP_KG) * STEP_KG;

/** "45" or "45,5" kg as the app writes numbers. */
export const formatKg = (kg: number) => String(kg).replace(".", ",");
