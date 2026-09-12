import { supabase } from './supabase.ts';
import { TodayRowSchema, type TodayRow } from './todayQueue.ts';

/**
 * The Today data path — BUILD-SPEC §5.4, build order step 6.
 *
 * Reads go through `actions_today`, never through `actions` directly: the view
 * is where `is_overdue` is computed and where dropped work is already filtered
 * out. Reaching past it would mean recomputing both in app code.
 *
 * Every write here sets `status` and nothing else. `updated_at`, `completed_at`
 * and `is_done` all follow from it in Postgres (rule 2).
 */

/** Ordering is deliberately absent — `buildTodayQueue` owns it, and it is tested. */
export async function listTodayRows(): Promise<readonly TodayRow[]> {
  const { data, error } = await supabase
    .from('actions_today')
    .select('id, title, status, due_at, do_now_url, area_name, entity_name, is_overdue');

  if (error) throw error;
  // Zod at every boundary: a view that changed shape fails here, in words,
  // rather than rendering a blank card.
  return TodayRowSchema.array().parse(data ?? []);
}

async function setStatus(id: string, status: 'doing' | 'done' | 'open' | 'dropped') {
  // No tenant filter in the statement, on purpose. `actions_all` restricts both
  // the rows this can see and the rows it may write; adding a client-side
  // tenant check here would imply the wall needs help, and invite someone to
  // later "optimise" it away.
  const { error } = await supabase.from('actions').update({ status }).eq('id', id);
  if (error) throw error;
}

/**
 * Do now. Marks the Action in progress — the card's primary slot then reads
 * "Done" the next time it comes round, which is how completion reaches the
 * fixed three-action row without a fourth button (§5.2, decided 2026-09-10).
 *
 * §5.4 words this as "opens do_now_url if present, else marks doing". The
 * status is set in BOTH cases: a deep link that opens is still work started,
 * and leaving those Actions in 'open' would mean the ones with a link could
 * never be completed from Today.
 */
export async function startAction(id: string): Promise<void> {
  await setStatus(id, 'doing');
}

export async function completeAction(id: string): Promise<void> {
  await setStatus(id, 'done');
}

/**
 * Drop. Not a delete — the row stays, and `actions_today` stops returning it
 * because the view filters 'dropped'. Deciding something will not happen is an
 * answer, and destroying the record of it would lose that.
 */
export async function dropAction(id: string): Promise<void> {
  await setStatus(id, 'dropped');
}

/**
 * Undo a drop (ADR-0011). Puts the Action back exactly where it was rather
 * than assuming 'open' — an action already in progress when it was dropped
 * must come back in progress, or undo silently loses the fact that work had
 * started and the card's primary slot reverts from "Done" to "Do now".
 *
 * Idempotent, like every other write here, so retrying after a failed undo is
 * safe.
 */
export async function restoreAction(
  id: string,
  previousStatus: 'open' | 'doing',
): Promise<void> {
  await setStatus(id, previousStatus);
}
