import { z } from 'zod';

/**
 * The Today queue — BUILD-SPEC §5.4, ADR-0009.
 *
 * Kept PURE — no Supabase client, no React — so the ranking rule and the cap can
 * be tested directly. ADR-0009's known failure mode is an unbounded overdue list
 * becoming a guilt list, and its required mitigation ships with the screen. A
 * mitigation that lives only inside a rendered component is one nobody can
 * assert on.
 */

/**
 * BUILD-SPEC §11 question 1, decided by Omegea on 2026-09-10: three.
 *
 * Three overdue cards greet you; the rest stays reachable behind "+N more".
 * It is the smallest number that still reads as a queue rather than as the
 * single card ADR-0009 rejected, and the cheapest to raise once the first
 * week's real data says whether it is right.
 */
export const OVERDUE_CAP = 3;

const MS_PER_DAY = 86_400_000;

/**
 * A row of `actions_today` exactly as PostgREST returns it. Zod at every
 * boundary (CLAUDE.md): a shape change in the view surfaces here as a readable
 * failure rather than as `undefined` rendered into a card at 6am.
 *
 * `status` admits 'dropped' even though the view filters it out. The schema
 * describes the column, not the filter — encoding the filter twice is the
 * duplicated-rule problem in miniature.
 */
export const TodayRowSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  status: z.enum(['open', 'doing', 'done', 'dropped']),
  due_at: z.iso.datetime({ offset: true }).nullable(),
  do_now_url: z.string().nullable(),
  area_name: z.string().nullable(),
  entity_name: z.string().nullable(),
  /**
   * Computed by the view, never recomputed here. Rule 2: computation lives in
   * Postgres. `due_at < now()` in app code would be the same formula in two
   * places, which is the exact Notion failure this app exists to escape.
   */
  is_overdue: z.boolean(),
});

export type TodayRow = z.output<typeof TodayRowSchema>;

export type TodayBlock = 'overdue' | 'due-today';

export interface TodayCard {
  readonly id: string;
  readonly title: string;
  readonly status: 'open' | 'doing';
  readonly dueAt: string | null;
  readonly doNowUrl: string | null;
  readonly areaName: string | null;
  readonly block: TodayBlock;
}

export interface TodayQueue {
  /** Overdue first, then due today. Hidden overdue sit between the two blocks. */
  readonly cards: readonly TodayCard[];
  /** How many overdue cards greet the user — `OVERDUE_CAP` or fewer. */
  readonly visibleOverdueCount: number;
  /** The N in "+N more". Zero means the whole overdue block is shown. */
  readonly overdueHidden: number;
  /** Where "not now" jumps to. Equals `cards.length` when nothing is due today. */
  readonly firstDueTodayIndex: number;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

/** Whole calendar days between two instants in the DEVICE's zone (see below). */
function dayDiff(later: Date, earlier: Date): number {
  return Math.round(
    (startOfDay(later).getTime() - startOfDay(earlier).getTime()) / MS_PER_DAY,
  );
}

function toCard(row: TodayRow, block: TodayBlock): TodayCard {
  return {
    id: row.id,
    title: row.title,
    status: row.status === 'doing' ? 'doing' : 'open',
    dueAt: row.due_at,
    doNowUrl: row.do_now_url,
    areaName: row.area_name,
    block,
  };
}

/**
 * Ranked by cost of missing (ADR-0009). With no priority column in the schema,
 * the only signal available is how long something has been owed, so the oldest
 * due date leads — the longer a thing has been missed, the more it has usually
 * cost. Due-today sorts the same way, which puts the tightest deadline first.
 *
 * This is a heuristic standing in for a priority the data does not carry yet.
 * `id` breaks ties so the morning order is stable rather than whatever Postgres
 * returned.
 */
function byConsequence(a: TodayRow, b: TodayRow): number {
  const at = a.due_at === null ? Number.POSITIVE_INFINITY : Date.parse(a.due_at);
  const bt = b.due_at === null ? Number.POSITIVE_INFINITY : Date.parse(b.due_at);
  return at === bt ? a.id.localeCompare(b.id) : at - bt;
}

/**
 * Build the morning's queue.
 *
 * `now` is passed in rather than read, so the boundary cases — a thing due at
 * 23:59 tonight, a thing that fell overdue an hour ago — are testable instead
 * of being whatever the clock said when the suite ran.
 *
 * The DEVICE's zone decides what "today" means. This is a personal tool and the
 * day that matters is the one the user is standing in; `lib/captureInput.ts`
 * writes due dates against the same boundary, so the two agree.
 */
export function buildTodayQueue(
  rows: readonly TodayRow[],
  now: Date,
  cap: number = OVERDUE_CAP,
): TodayQueue {
  // Done work is not today's work. The view only filters 'dropped', because a
  // completed action still matters to the rollups that read the same view.
  const live = rows.filter((r) => r.status === 'open' || r.status === 'doing');

  const overdue = live.filter((r) => r.is_overdue).sort(byConsequence);

  const todayEnd = endOfDay(now).getTime();
  const dueToday = live
    .filter(
      (r) =>
        !r.is_overdue && r.due_at !== null && Date.parse(r.due_at) <= todayEnd,
    )
    .sort(byConsequence);

  const cards = [
    ...overdue.map((r) => toCard(r, 'overdue')),
    ...dueToday.map((r) => toCard(r, 'due-today')),
  ];

  const visibleOverdueCount = Math.min(Math.max(cap, 0), overdue.length);

  return {
    cards,
    visibleOverdueCount,
    overdueHidden: overdue.length - visibleOverdueCount,
    firstDueTodayIndex: overdue.length,
  };
}

/**
 * When the card was owed, in words.
 *
 * Deliberately flat: "was due" rather than "you missed", no counts climbing, no
 * exclamation. §5.3 — deferral is never punished, and the copy is where that
 * rule is most easily broken by accident.
 */
export function dueLabel(card: TodayCard, now: Date): string | null {
  if (card.dueAt === null) return null;
  if (card.block === 'due-today') return 'due today';

  const days = dayDiff(now, new Date(card.dueAt));
  if (days <= 0) return 'was due earlier today';
  if (days === 1) return 'was due yesterday';
  return `was due ${days} days ago`;
}

/** Area and timing, joined for the context line under the subject (§5.2). */
export function cardContext(card: TodayCard, now: Date): string {
  return [card.areaName ?? 'Unfiled', dueLabel(card, now)]
    .filter((part): part is string => part !== null)
    .join(' · ');
}
