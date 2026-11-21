/** The athlete's own goals and badges (stored in Firestore, see firestore.ts). Safe for the browser. */

export type LiftGoal = { exercise: string; targetKg: number };
export type Goals = { weeklyDays: number; lifts: LiftGoal[] };
/** `badges`: badge id → day it was earned ("2026-11-21"). */
export type Profile = { goals: Goals; badges: Record<string, string> };

export const DEFAULT_GOALS: Goals = { weeklyDays: 3, lifts: [] };
export const MAX_LIFT_GOALS = 6;
