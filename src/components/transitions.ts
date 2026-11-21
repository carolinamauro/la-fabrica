/** View transition types for moving to a later or earlier day, week or section (see globals.css). */
export const FORWARD = ["nav-forward"];
export const BACK = ["nav-back"];

/** `transitionTypes` for a link at `index` in a row whose current item is at `active`. */
export const direction = (index: number, active: number) => (index > active ? FORWARD : index < active ? BACK : undefined);
