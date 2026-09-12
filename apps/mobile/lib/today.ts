import * as Linking from 'expo-linking';

import { supabase } from './supabase.ts';
import { buildTodayQueue, type TodayQueue, type TodayRow } from './todayQueue.ts';

/**
 * Today's work, read from the `actions_today` VIEW rather than the table.
 *
 * The view carries `security_invoker = true`, so it evaluates RLS as the caller
 * — FC-1 test 5 exists to catch the day someone turns that off. It also joins
 * area and entity names and computes `is_overdue`, which is why the app reads
 * a view instead of assembling the same thing from three queries.
 */
export async function listToday(now: Date = new Date()): Promise<TodayQueue> {
  const { data, error } = await supabase
    .from('actions_today')
    .select('id, title, status, due_at, do_now_url, area_name, entity_name, is_overdue');

  if (error) throw error;
  return buildTodayQueue((data ?? []) as TodayRow[], { now });
}

/**
 * `Do now` — the app's core action-first mechanic (4.1 §7).
 *
 * Opens the deep link where the Action actually gets completed. With no link
 * there is nowhere to go, so the honest fallback is to mark it in progress
 * rather than pretend something happened.
 *
 * Returns what it did, so the screen can say so rather than guess.
 */
export async function doNow(action: {
  id: string;
  do_now_url: string | null;
}): Promise<'opened' | 'marked-doing'> {
  if (action.do_now_url !== null && action.do_now_url !== '') {
    const supported = await Linking.canOpenURL(action.do_now_url);
    // A dead link is announced as unavailable, never a silent no-op (4.8 §7.1).
    if (!supported) throw new Error('That link cannot be opened on this device.');
    await Linking.openURL(action.do_now_url);
    return 'opened';
  }
  await setStatus(action.id, 'doing');
  return 'marked-doing';
}

/** `Drop` — the user says this will not happen. Not a delete; the row survives. */
export async function dropAction(id: string): Promise<void> {
  await setStatus(id, 'dropped');
}

async function setStatus(id: string, status: 'doing' | 'dropped'): Promise<void> {
  // No updated_at here: a trigger sets it. Writing it from the client would put
  // a second author on a value Postgres already owns.
  const { error } = await supabase.from('actions').update({ status }).eq('id', id);
  if (error) throw error;
}
