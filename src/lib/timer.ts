// Workout timer: the modes of a CrossFit box clock, as a list of timed segments.

/**
 * A group of the "Series" mode: `sets` series with `setRest` between them; each series is
 * `blocks` blocks of `work` with `rest` between blocks. `restAfter` comes before the next group
 * (for a workout whose series change shape). All times in seconds.
 * E.g. 10 series (1:00 between them) of 5 blocks of 4:00 work / 0:30 rest.
 */
export type SeriesGroup = { sets: number; setRest: number; blocks: number; work: number; rest: number; restAfter: number };

/** All times in seconds; a For Time `cap` of 0 means no cap. */
export type TimerConfig =
  | { mode: "amrap"; time: number }
  | { mode: "emom"; every: number; rounds: number }
  | { mode: "fortime"; cap: number }
  | { mode: "tabata"; work: number; rest: number; rounds: number }
  | { mode: "series"; groups: SeriesGroup[] };

export type TimerMode = TimerConfig["mode"];
/** `setRest` is the rest between two series, `groupRest` between two groups. */
export type Phase = "prepare" | "work" | "rest" | "setRest" | "groupRest";
/**
 * `round` of `rounds`: the block (or round) within its series, 0 outside of work/rest.
 * `serie`/`series` and `group`/`groups` are only set in the "Series" mode.
 * `seconds` is Infinity for a For Time without cap.
 */
export type Segment = {
  phase: Phase;
  seconds: number;
  round: number;
  rounds: number;
  serie?: number;
  series?: number;
  group?: number;
  groups?: number;
};

export const PREPARE_SECONDS = 10;
export const MAX_GROUPS = 10;

export const DEFAULTS: { [M in TimerMode]: Extract<TimerConfig, { mode: M }> } = {
  amrap: { mode: "amrap", time: 12 * 60 },
  emom: { mode: "emom", every: 60, rounds: 10 },
  fortime: { mode: "fortime", cap: 0 },
  tabata: { mode: "tabata", work: 20, rest: 10, rounds: 8 },
  series: { mode: "series", groups: [{ sets: 4, setRest: 60, blocks: 5, work: 40, rest: 20, restAfter: 60 }] },
};

type Position = Pick<Segment, "serie" | "series" | "group" | "groups">;

/** Work/rest repetitions; no rest after the last one (the series or workout is over). */
function repetitions(work: number, rest: number, rounds: number, position: Position = {}): Segment[] {
  const list: Segment[] = [];
  for (let round = 1; round <= rounds; round++) {
    list.push({ phase: "work", seconds: work, round, rounds, ...position });
    if (round < rounds && rest > 0) list.push({ phase: "rest", seconds: rest, round, rounds, ...position });
  }
  return list;
}

function seriesSegments(groups: SeriesGroup[]): Segment[] {
  const list: Segment[] = [];
  groups.forEach((g, gi) => {
    const group = { group: gi + 1, groups: groups.length };
    for (let serie = 1; serie <= g.sets; serie++) {
      const position = { ...group, serie, series: g.sets };
      list.push(...repetitions(g.work, g.rest, g.blocks, position));
      if (serie < g.sets && g.setRest > 0) list.push({ phase: "setRest", seconds: g.setRest, round: 0, rounds: 0, ...position });
    }
    if (gi < groups.length - 1 && g.restAfter > 0) {
      list.push({ phase: "groupRest", seconds: g.restAfter, round: 0, rounds: 0, ...group });
    }
  });
  return list;
}

export function segments(config: TimerConfig): Segment[] {
  const list: Segment[] = [{ phase: "prepare", seconds: PREPARE_SECONDS, round: 0, rounds: 0 }];
  switch (config.mode) {
    case "amrap":
      list.push({ phase: "work", seconds: config.time, round: 1, rounds: 1 });
      break;
    case "fortime":
      list.push({ phase: "work", seconds: config.cap > 0 ? config.cap : Infinity, round: 1, rounds: 1 });
      break;
    case "emom":
      for (let round = 1; round <= config.rounds; round++) {
        list.push({ phase: "work", seconds: config.every, round, rounds: config.rounds });
      }
      break;
    case "tabata":
      list.push(...repetitions(config.work, config.rest, config.rounds));
      break;
    case "series":
      list.push(...seriesSegments(config.groups));
      break;
  }
  return list;
}

export type TimerState = {
  done: boolean;
  index: number;
  segment: Segment;
  /** Seconds into the current segment. */
  elapsed: number;
  /** Seconds left in the current segment (Infinity when open-ended). */
  remaining: number;
};

/** Where the workout is after `seconds` of running time. */
export function stateAt(list: Segment[], seconds: number): TimerState {
  let start = 0;
  for (const [index, segment] of list.entries()) {
    if (seconds < start + segment.seconds) {
      const elapsed = seconds - start;
      return { done: false, index, segment, elapsed, remaining: segment.seconds - elapsed };
    }
    start += segment.seconds;
  }
  const last = list.length - 1;
  return { done: true, index: last, segment: list[last], elapsed: list[last].seconds, remaining: 0 };
}

/** Running time at which segment `index` starts (the end of the workout for list.length). */
export function segmentStart(list: Segment[], index: number): number {
  return list.slice(0, index).reduce((sum, s) => sum + s.seconds, 0);
}

/**
 * Where "previous" jumps from segment `index`: the start of the last work block before it
 * (so from a block or the rest after it, you redo the block before), or the first segment.
 */
export function previousWorkIndex(list: Segment[], index: number): number {
  for (let i = index - 1; i >= 0; i--) {
    if (list[i].phase === "work") return i;
  }
  return 0;
}

/** "m:ss", or "h:mm:ss" past an hour. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** 1'30 → 90, 2 → 120 (minutes with optional seconds, as coaches write them). */
function minutesText(minutes: string, seconds?: string) {
  return Number(minutes) * 60 + (seconds ? Number(seconds) : 0);
}

/**
 * A timer for a line of programming, if it names one: "C. EMOM X 15 MIN", "E2MOM X 10",
 * "AMRAP 12 MIN", "TABATA", "FOR TIME (CAP 10)", "4 MIN ON X 1'30 MIN OFF X 5 RONDAS".
 */
export function timerFromText(text: string): TimerConfig | null {
  const t = text.toUpperCase();

  const onOff = t.match(/(\d+)(?:['’:](\d+))?\s*(?:MIN|')?\s*ON\s*X?\s*(\d+)(?:['’:](\d+))?\s*(?:MIN|')?\s*OFF\s*X\s*(\d+)/);
  if (onOff) {
    return {
      mode: "tabata",
      work: minutesText(onOff[1], onOff[2]),
      rest: minutesText(onOff[3], onOff[4]),
      rounds: Number(onOff[5]),
    };
  }

  const emom = t.match(/\bE(\d*)MOM\s*X?\s*(\d+)/);
  if (emom) {
    const every = Number(emom[1] || 1);
    return { mode: "emom", every: every * 60, rounds: Math.max(1, Math.round(Number(emom[2]) / every)) };
  }

  const amrap = t.match(/\bAMRAP\s*X?\s*(\d+)/);
  if (amrap) return { mode: "amrap", time: Number(amrap[1]) * 60 };

  if (/\bTABATA\b/.test(t)) return DEFAULTS.tabata;

  if (/\bFOR TIME\b|\bPOR TIEMPO\b/.test(t)) {
    const cap = t.match(/\bCAP\s*:?\s*(\d+)/);
    return { mode: "fortime", cap: cap ? Number(cap[1]) * 60 : 0 };
  }

  return null;
}
