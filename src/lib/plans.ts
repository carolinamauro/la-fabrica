import { normalizeEmail, type Athlete } from "./athletes";
import { getCrossfitSpreadsheetId, readSharing, type Sharing } from "./sheets";

export type PlanType = Athlete["planType"];

/** Whether the sharing list gives this email access (directly, by domain or by public link). */
export function isSharedWith(sharing: Sharing[], email: string): boolean {
  const normalized = normalizeEmail(email);
  const domain = normalized.split("@")[1];
  return sharing.some(
    (p) =>
      p.type === "anyone" ||
      (p.type === "user" && p.emailAddress && normalizeEmail(p.emailAddress) === normalized) ||
      (p.type === "domain" && p.domain?.toLowerCase() === domain),
  );
}

/**
 * The athlete's plans, primary first: the one from the master ATLETAS tab, plus the CrossFit
 * plan when its sheet is shared with the athlete's email.
 */
export async function getAvailablePlans(athlete: Athlete): Promise<PlanType[]> {
  if (athlete.planType === "CROSSFIT") return ["CROSSFIT"];
  try {
    const sharing = await readSharing(getCrossfitSpreadsheetId());
    return isSharedWith(sharing, athlete.email) ? ["PERSONALIZED", "CROSSFIT"] : ["PERSONALIZED"];
  } catch (error) {
    // The extra plan is optional: if Drive can't be read, show the main plan only.
    console.warn("Could not read CrossFit sharing", error);
    return ["PERSONALIZED"];
  }
}
