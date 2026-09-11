import { z } from 'zod';

/**
 * The capture boundary — CLAUDE.md, Zod at every boundary. Invalid input rejects
 * with NO WRITE rather than being coerced on the way to Postgres.
 *
 * Kept free of imports beyond Zod so the rules are testable without a Supabase
 * client or a React tree.
 */

/**
 * `actions.title` carries `check (length(btrim(title)) > 0)`. Trimming and
 * rejecting here means a whitespace-only capture fails as a readable message on
 * the device instead of a constraint violation from the database — the DB check
 * stays as the backstop it is meant to be, not the primary validator.
 */
export const CaptureInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'A capture needs a title.')
    .max(500, 'That title is too long — keep it under 500 characters.'),
  /** Skippable (§5.5). Absent means unfiled, not invalid. */
  areaId: z.uuid().nullable().default(null),
  /** Skippable. Absent means no due date, which is a legitimate answer. */
  dueAt: z.iso.datetime().nullable().default(null),
});

export type CaptureInput = z.input<typeof CaptureInputSchema>;
export type ParsedCapture = z.output<typeof CaptureInputSchema>;

/** `when` answers, resolved to a timestamp at write time rather than stored. */
export type WhenChoice = 'today' | 'tomorrow' | 'someday';

/**
 * End of the chosen day in the device's own zone.
 *
 * "Due today" means "before today is over" to a person, and anchoring to the
 * start of the day would mark a capture overdue the moment it was made. The
 * device's zone is the right one: this is a personal tool, and the day that
 * matters is the one the user is standing in.
 */
export function resolveWhen(choice: WhenChoice, now: Date): string | null {
  if (choice === 'someday') return null;

  const due = new Date(now);
  if (choice === 'tomorrow') due.setDate(due.getDate() + 1);
  due.setHours(23, 59, 59, 999);
  return due.toISOString();
}
