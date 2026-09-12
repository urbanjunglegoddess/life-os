/**
 * Today's queue — BUILD-SPEC §5.4. Pure, so the ordering rules are testable
 * without a Supabase client or a React tree.
 *
 * Order is CONSEQUENCE-FIRST: what breaks if skipped, ranked by cost of
 * missing — not by time of day.
 */

export interface TodayRow {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly due_at: string | null;
  readonly do_now_url: string | null;
  readonly area_name: string | null;
  readonly entity_name: string | null;
  /**
   * Computed by the `actions_today` view, NOT here. Recomputing it in app code
   * is the duplicated-formula failure the app exists to escape (rule 2).
   */
  readonly is_overdue: boolean;
}

/**
 * THIS NUMBER IS AN OPEN QUESTION — BUILD-SPEC §11 item 1, decided by Omegea
 * from the first week's real data. It is a placeholder, not a decision: the
 * first week has not happened, so nobody can answer it yet.
 *
 * It lives here alone so settling it is a one-line change. The rule it serves
 * is not open: an unbounded overdue list is a guilt list and people stop
 * opening those, so a cap of SOME size has to exist before the flow can ship.
 */
export const OVERDUE_CAP = 3;

export interface TodayQueue {
  readonly cards: readonly TodayRow[];
  /** The "+N more" — overdue work held back by the cap, never hidden silently. */
  readonly overdueHeldBack: number;
  readonly overdueShown: number;
  readonly dueTodayShown: number;
}

/** Same calendar day in the DEVICE's zone — see `buildTodayQueue`. */
function isSameLocalDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** Oldest due first. Rows with no due date sort last among their group. */
function byDueAtAscending(a: TodayRow, b: TodayRow): number {
  if (a.due_at === null && b.due_at === null) return 0;
  if (a.due_at === null) return 1;
  if (b.due_at === null) return -1;
  return Date.parse(a.due_at) - Date.parse(b.due_at);
}

/**
 * Build the sequence Today walks through.
 *
 * OVERDUE FIRST, then due today. Within each group, oldest due date leads. The
 * spec says "most consequential first", and `actions` carries no priority
 * column — so how long something has been overdue is the only consequence
 * signal in the data. That is a proxy, and it is worth naming as one: when a
 * priority column exists, this comparator is where it belongs.
 *
 * "Due today" is bucketed against the DEVICE's clock rather than in the view,
 * which is the one place local computation is the correct answer. `now()` in
 * Postgres is UTC; an item due at 8pm in Georgia would read as tomorrow to the
 * server and today to the person holding the phone. The person is right.
 */
export function buildTodayQueue(
  rows: readonly TodayRow[],
  options: { readonly cap?: number; readonly now: Date },
): TodayQueue {
  const cap = options.cap ?? OVERDUE_CAP;

  // The view already drops 'dropped'. Completed work is not a decision to make
  // again, and showing it would pad the sequence — which §5.4 forbids.
  const live = rows.filter((r) => r.status === 'open' || r.status === 'doing');

  const overdue = live.filter((r) => r.is_overdue).sort(byDueAtAscending);

  const dueToday = live
    .filter(
      (r) => !r.is_overdue && r.due_at !== null && isSameLocalDay(r.due_at, options.now),
    )
    .sort(byDueAtAscending);

  // A negative or zero cap would silently empty the queue while overdue work
  // exists — the exact failure the "+N more" affordance is there to prevent.
  const safeCap = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : overdue.length;
  const shownOverdue = overdue.slice(0, safeCap);

  return {
    cards: [...shownOverdue, ...dueToday],
    overdueHeldBack: overdue.length - shownOverdue.length,
    overdueShown: shownOverdue.length,
    dueTodayShown: dueToday.length,
  };
}
