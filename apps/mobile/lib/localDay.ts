/**
 * The device's LOCAL calendar day as `YYYY-MM-DD`.
 *
 * Deliberately not `toISOString().slice(0, 10)`, which converts to UTC first
 * and therefore files a 6am entry in Georgia under the previous day for part
 * of the year. The journal asks "what held TODAY up" — today means the user's
 * day, and `journal_entries` is unique on (tenant_id, entry_date), so getting
 * this wrong does not error. It quietly writes onto the wrong date.
 *
 * Its own module, with no imports, so it can be unit-tested directly — every
 * other file in `lib/` that would host it pulls in the Supabase client, and a
 * test of pure date arithmetic should not need an environment to run.
 */
export function localDay(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
