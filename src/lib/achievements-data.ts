import { buildAchievements, newBadges, type Achievements, type Badge } from "./achievements";
import type { Athlete } from "./athletes";
import { addBadges, getProfile } from "./firestore";
import { DEFAULT_GOALS, type Goals } from "./goals";
import type { ExerciseHistory } from "./history";
import { getTraining } from "./history-data";
import { formatRecordedAt } from "./results";

export type AchievementsData = Achievements & {
  goals: Goals;
  /** False when Firestore can't be reached: goals can't be saved and badges aren't remembered. */
  stored: boolean;
  /** Badges earned since the last visit (celebrated once, then stored). */
  fresh: Badge[];
  /** Exercises that can get a load goal (measured with a load, from the catalog). */
  strengthExercises: Pick<ExerciseHistory, "key" | "name" | "category">[];
};

/** Today in Argentina, "2026-11-21". */
export const todayInArgentina = () => formatRecordedAt(new Date()).slice(0, 10);

/**
 * The athlete's achievements from everything they logged (their file's REGISTRO_PLANIFICACION and
 * their CrossFit log, see getTraining) and their goals and badges in Firestore.
 */
export async function getAchievements(athlete: Athlete, { remember = true } = {}): Promise<AchievementsData | null> {
  const [{ records, history }, profile] = await Promise.all([getTraining(athlete), getProfile(athlete.id)]);
  const goals = profile?.goals ?? DEFAULT_GOALS;
  const today = todayInArgentina();
  const achievements = buildAchievements({ records, history, goals, today });

  // A badge stays earned once stored (even if, say, the goal that earned it is deleted later).
  const storedBadges = profile?.badges ?? {};
  const badges = achievements.badges.map((b) => (storedBadges[b.id] ? { ...b, earned: true, current: b.target } : b));
  const fresh = profile ? newBadges(badges, storedBadges) : [];
  if (remember && fresh.length) {
    try {
      await addBadges(athlete.id, storedBadges, Object.fromEntries(fresh.map((b) => [b.id, today])));
    } catch (error) {
      console.error("getAchievements: could not store new badges", { athleteId: athlete.id, error });
    }
  }

  return {
    ...achievements,
    badges,
    goals,
    stored: profile !== null,
    fresh,
    strengthExercises: history.filter((e) => e.measurement === "LOAD_REPS" || e.measurement === "LOAD").map(({ key, name, category }) => ({ key, name, category })),
  };
}
