import { File, Paths } from 'expo-file-system';

import {
  MAX_ENTRIES,
  buildWriteLogEntry,
  parseWriteLog,
  serializeWriteLogEntry,
  trimWriteLog,
  type WriteLogEntry,
  type WriteOp,
} from './writeLogEntry.ts';

/**
 * The local failed-write log — ADR-0012's required mitigation, build order
 * step 9. HARD REQUIREMENT: every failed write is recorded here with a
 * timestamp, and a slice that writes to the database is not done until its
 * failure path logs (6.2 §6, §8).
 *
 * IT IS NOT A SUPABASE TABLE, on purpose. A write failure is precisely the
 * moment Supabase is unreachable, so a remote log would drop the records it
 * exists to keep — and would drop them non-randomly, losing exactly the
 * connectivity failures that have to be told apart from design failures.
 *
 * The document directory rather than the cache directory: the cache is the one
 * the OS empties under storage pressure, and an instrument that the phone may
 * silently clear before the review is not an instrument.
 *
 * This is NOT an offline write queue (ADR-0012 deferred that). Nothing here is
 * ever replayed. It records that a write was lost; it does not pretend to have
 * kept it.
 */

const FILE_NAME = 'failed-writes.jsonl';

/**
 * Above this the file is trimmed to the last `MAX_ENTRIES` lines. Checked on
 * size rather than by counting entries so the common path stays one append —
 * reading and re-parsing the whole log on every failure would make a bad
 * connection progressively more expensive, at 6am, on the slowest device.
 */
const TRIM_ABOVE_BYTES = 128 * 1024;

function logFile(): File {
  return new File(Paths.document, FILE_NAME);
}

/**
 * Append one failure. NEVER THROWS, and never rejects.
 *
 * The caller is already handling a failed write and showing the user a retry.
 * If the log itself then threw, one lost write would become two errors and the
 * screen's own error path would be replaced by this one — the measurement
 * breaking the thing it measures. A log that cannot be written is reported to
 * the console and dropped.
 */
export function logFailedWrite(op: WriteOp, error: unknown, now: Date = new Date()): void {
  try {
    const file = logFile();
    if (!file.exists) file.create({ intermediates: true });
    file.write(serializeWriteLogEntry(buildWriteLogEntry(op, error, now)), {
      append: true,
    });

    if (file.size > TRIM_ABOVE_BYTES) {
      const trimmed = trimWriteLog(file.textSync(), MAX_ENTRIES);
      if (trimmed !== null) file.write(trimmed);
    }
  } catch (e) {
    console.warn('[writeLog] could not record a failed write', e);
  }
}

/**
 * Run a write, logging its failure before re-throwing.
 *
 * The wrapper lives in the data-access layer rather than in the screens so that
 * a new flow CANNOT forget it: every path to Postgres already goes through a
 * function in `lib/`, and wiring the requirement in at that chokepoint is the
 * difference between a rule and a habit.
 *
 * It re-throws, always. The screen still owns the message and the retry — a
 * failure that was logged but swallowed would be a silent failure, which 6.2 §6
 * forbids in the same breath as it requires the log. And a retry that later
 * succeeds still leaves this record behind: the friction happened.
 */
export async function loggedWrite<T>(op: WriteOp, write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    logFailedWrite(op, error);
    throw error;
  }
}

/**
 * The log, NEWEST FIRST — reading order for a person, at the gate or in
 * Settings. Returns empty when nothing has ever failed, which is the state
 * this app hopes to be in.
 */
export async function readFailedWrites(): Promise<readonly WriteLogEntry[]> {
  try {
    const file = logFile();
    if (!file.exists) return [];
    return [...parseWriteLog(await file.text())].reverse();
  } catch (e) {
    console.warn('[writeLog] could not read the failed-write log', e);
    return [];
  }
}
