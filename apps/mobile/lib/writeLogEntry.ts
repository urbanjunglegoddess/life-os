import { z } from 'zod';

/**
 * The shape of a failed-write record — ADR-0012's required mitigation, build
 * order step 9.
 *
 * This is MEASUREMENT INFRASTRUCTURE, not error-handling politeness. The kill
 * criterion measures daily friction, and in an online-only beta a write lost to
 * bad wifi and a write abandoned because the app is annoying look identical in
 * drop-off data. These records are the instrument that separates them, so the
 * fields are chosen for what has to be answered at the beta gate: WHEN it
 * failed, WHAT was being attempted, and WHETHER the network or the app said no.
 *
 * Kept free of imports beyond Zod — no file system, no Supabase client — so the
 * rules can be tested without an environment. `writeLog.ts` does the IO.
 */

/**
 * A CLOSED vocabulary of write paths, deliberately. At the gate these get
 * counted and cross-referenced against skipped days, and a free-form string
 * would make "how many journal writes failed that week" a grep with a judgement
 * call in it. A new write path adds a member here.
 */
export type WriteOp =
  | 'action.create'
  | 'action.start'
  | 'action.complete'
  | 'action.drop'
  | 'action.restore'
  | 'journal.respond'
  | 'auth.otp_send'
  | 'auth.otp_verify'
  | 'auth.sign_out';

/**
 * Why the write failed, at the only granularity the kill criterion needs.
 *
 * `offline` is the whole reason the log exists: the train went into the tunnel,
 * and that day's missing entry says nothing about the design. `rejected` is the
 * server answering — a policy denial or a constraint — which IS the app's
 * problem and reads as a defect rather than as friction.
 */
export const WRITE_FAILURE_KINDS = ['offline', 'rejected', 'unknown'] as const;
export type WriteFailureKind = (typeof WRITE_FAILURE_KINDS)[number];

/** Enough for a beta week of a bad-connectivity phone, bounded so the file cannot grow without limit. */
export const MAX_ENTRIES = 500;

/**
 * Long enough to identify a failure, short enough that no error can turn the
 * log into a transcript. See the redaction note on `buildWriteLogEntry`.
 */
const MAX_MESSAGE_LENGTH = 200;

export const WriteLogEntrySchema = z.object({
  /** ISO 8601, with the offset. "Logged locally WITH A TIMESTAMP" is the literal requirement. */
  at: z.iso.datetime(),
  op: z.string().min(1),
  kind: z.enum(WRITE_FAILURE_KINDS),
  message: z.string(),
  /** PostgREST `code` or an HTTP status, when the server gave one. */
  code: z.string().optional(),
});
export type WriteLogEntry = z.infer<typeof WriteLogEntrySchema>;

/**
 * A connection failure, as every layer of the stack spells it.
 *
 * React Native's fetch rejects with `TypeError: Network request failed`;
 * supabase-js wraps its own retryable fetch failures; and a request that dies
 * mid-flight surfaces as an abort or a timeout. Matching on the text is
 * unlovely, but the alternative is classifying the most common failure of an
 * online-only app as `unknown` — which would blind the instrument in exactly
 * the case it was built for.
 */
const OFFLINE_SIGNATURES =
  /network request failed|failed to fetch|networkerror|network error|econnrefused|enotfound|etimedout|timed? ?out|aborted|offline/i;

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

/**
 * Classify the failure. Network signature first, server answer second.
 *
 * Order matters: supabase-js gives a fetch failure an HTTP-shaped status of 0
 * or 504, so checking the status first would file half the tunnel failures as
 * the server rejecting the write — the exact confusion this log exists to
 * prevent.
 */
export function classifyWriteFailure(error: unknown): WriteFailureKind {
  const message = error instanceof Error ? error.message : String(error ?? '');
  // Matched on the message alone, never on `error instanceof TypeError`. React
  // Native's fetch failure IS a TypeError, but so is every ordinary bug in a
  // write path — and filing a bug as "no connection" would excuse the app's own
  // failures as friction, which is the one direction this classification must
  // not be allowed to slip.
  if (OFFLINE_SIGNATURES.test(message)) return 'offline';

  if (typeof error === 'object' && error !== null) {
    const source = error as Record<string, unknown>;
    if (readString(source, 'code') !== undefined) return 'rejected';
    const status = source['status'];
    if (typeof status === 'number' && status >= 400) return 'rejected';
  }
  return 'unknown';
}

/**
 * Build the record for one failed write.
 *
 * REDACTION IS THE POINT OF THIS FUNCTION. The log is an unencrypted file on
 * the device, and the app holds journals, finances and children's records —
 * so only the error's own `message` is kept, never `details` or `hint`, which
 * is where Postgres puts the failing row ("Failing row contains (…)"). A
 * journal line must not end up on disk in plaintext because the write that
 * carried it failed. The message is truncated for the same reason: a bound on
 * length is a bound on how much can leak through a message nobody predicted.
 *
 * `now` is passed in rather than read, so the timestamp is testable.
 */
export function buildWriteLogEntry(
  op: WriteOp,
  error: unknown,
  now: Date,
): WriteLogEntry {
  const raw = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  const source = typeof error === 'object' && error !== null
    ? (error as Record<string, unknown>)
    : {};
  const code = readString(source, 'code') ?? readString(source, 'status');

  return {
    at: now.toISOString(),
    op,
    kind: classifyWriteFailure(error),
    message: raw.slice(0, MAX_MESSAGE_LENGTH),
    ...(code === undefined ? {} : { code: code.slice(0, 40) }),
  };
}

/** One JSON object per line. Append-only: a crash mid-write loses that line, not the file. */
export function serializeWriteLogEntry(entry: WriteLogEntry): string {
  return `${JSON.stringify(entry)}\n`;
}

/**
 * Parse the log, oldest first, SKIPPING anything that does not read back.
 *
 * A torn append leaves a half-written last line. Throwing on it would lose the
 * whole week's log to the final failure of the week, which is both the worst
 * moment and the most likely one — the app was being killed or the device was
 * dying. One unreadable line is a lost record; a throw here is a lost log.
 */
export function parseWriteLog(text: string): readonly WriteLogEntry[] {
  const entries: WriteLogEntry[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    try {
      const parsed = WriteLogEntrySchema.safeParse(JSON.parse(line));
      if (parsed.success) entries.push(parsed.data);
    } catch {
      // Unreadable line. Keep going — see above.
    }
  }
  return entries;
}

/**
 * The log capped to its most recent `MAX_ENTRIES` lines, or null when it is
 * already short enough and nothing needs rewriting.
 *
 * Trims by LINE rather than by parsed entry so an unreadable line still counts
 * against the cap — otherwise a file full of corruption could never be trimmed
 * back down, which is the one way an append-only log becomes a disk problem.
 */
export function trimWriteLog(text: string, cap: number = MAX_ENTRIES): string | null {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  if (lines.length <= cap) return null;
  return `${lines.slice(lines.length - cap).join('\n')}\n`;
}

/* ---------- READING IT BACK, IN WORDS ---------- */

/**
 * Plain names for the write paths.
 *
 * The log is read by a person — in Settings during the week, and at the gate
 * afterwards — so the vocabulary above is deliberately not what gets shown.
 * `journal.respond` is a slug for counting; "Journal answer" is what tells
 * somebody at 6am which tap did not land.
 */
const OP_LABELS: Readonly<Record<WriteOp, string>> = {
  'action.create': 'Capture',
  'action.start': 'Do now',
  'action.complete': 'Complete',
  'action.drop': 'Drop',
  'action.restore': 'Undo a drop',
  'journal.respond': 'Journal answer',
  'auth.otp_send': 'Sign-in code',
  'auth.otp_verify': 'Sign-in',
  'auth.sign_out': 'Sign out',
};

/** Falls back to the slug: an unlabelled op is still a record, and dropping it would be worse. */
export function writeOpLabel(op: string): string {
  return OP_LABELS[op as WriteOp] ?? op;
}

/**
 * Why it failed, said in words rather than in a colour or a code (4.8 §7).
 * "No connection" is the sentence that stops a person reading a lost capture
 * as the app losing their thought.
 */
export function writeFailureKindLabel(kind: WriteFailureKind): string {
  switch (kind) {
    case 'offline':
      return 'No connection';
    case 'rejected':
      return 'The server refused it';
    default:
      return 'Unexplained';
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * When it happened, in the device's own zone and in the app's own words —
 * matching `dueLabel` in `todayQueue.ts` rather than reaching for `Intl`, which
 * is a locale-dependent surface on Hermes and would make the one screen whose
 * whole job is legible timestamps depend on the runtime's ICU build.
 *
 * The TIME is always shown. A date alone cannot answer the question the log is
 * kept for — whether the failures cluster in the 6am loop or land whenever.
 */
export function failedWriteWhen(at: string, now: Date): string {
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return at;

  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(when.getHours())}:${pad(when.getMinutes())}`;

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(when)) / 86_400_000);

  if (days === 0) return `today at ${clock}`;
  if (days === 1) return `yesterday at ${clock}`;
  return `${when.getDate()} ${MONTHS[when.getMonth()]} at ${clock}`;
}
