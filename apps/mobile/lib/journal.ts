import { z } from 'zod';

import { supabase } from './supabase.ts';
import { loggedWrite } from './writeLog.ts';

/**
 * The journal data path — BUILD-SPEC §5.6, build order step 8.
 *
 * The biometric gate in `components/journal/BiometricGate.tsx` is a CLIENT
 * control and protects the screen, not the row. Everything here is still
 * subject to RLS at `tenant_id` exactly like the rest of the app — FC-1 cases
 * 13 to 19 are the proof, and they run with no client in the picture at all.
 */

export const JournalPromptSchema = z.object({
  id: z.string(),
  /** Stable key. `responses` is keyed by this, never by `id` or the wording. */
  slug: z.string(),
  prompt: z.string(),
  sort_order: z.number(),
});
export type JournalPrompt = z.infer<typeof JournalPromptSchema>;

const JournalEntrySchema = z.object({
  entry_date: z.string(),
  responses: z.record(z.string(), z.string()),
  answered_count: z.number(),
  is_complete: z.boolean(),
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

/** The tenant's prompt set, in the order the signup trigger seeded it. */
export async function listJournalPrompts(): Promise<readonly JournalPrompt[]> {
  const { data, error } = await supabase
    .from('journal_prompts')
    .select('id, slug, prompt, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  // Zod at every boundary: a prompt set that changed shape fails here, in
  // words, rather than rendering a flow of blank questions.
  return JournalPromptSchema.array().parse(data ?? []);
}

/**
 * The day's entry, or null if nothing has been written yet.
 *
 * `maybeSingle` rather than `single`: no entry yet is the normal case at 6am,
 * not an error.
 */
export async function getEntryForDay(day: string): Promise<JournalEntry | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('entry_date, responses, answered_count, is_complete')
    .eq('entry_date', day)
    .maybeSingle();

  if (error) throw error;
  return data === null ? null : JournalEntrySchema.parse(data);
}

/**
 * Write one prompt's answer into the day's entry.
 *
 * Goes through the `record_journal_response` function rather than an upsert
 * from here, because merging one answer into a day that may already hold others
 * is a computation and rule 2 puts those in Postgres. The function is SECURITY
 * INVOKER, so it is bound by the same policy a direct write would be.
 *
 * The failure is logged (ADR-0012) WITHOUT the line that was being written. The
 * log is an unencrypted file and this is the one write in the app whose payload
 * is the private thing the biometric gate exists for — `writeLogEntry.ts` keeps
 * the error's own message and nothing else, and that boundary is the reason
 * journal text never reaches disk in plaintext on the failure path.
 */
export async function recordJournalResponse(
  day: string,
  slug: string,
  text: string,
): Promise<void> {
  return loggedWrite('journal.respond', async () => {
    const { error } = await supabase.rpc('record_journal_response', {
      p_entry_date: day,
      p_slug: slug,
      p_text: text,
    });
    if (error) throw error;
  });
}
