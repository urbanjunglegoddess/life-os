import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_ENTRIES,
  buildWriteLogEntry,
  classifyWriteFailure,
  failedWriteWhen,
  parseWriteLog,
  serializeWriteLogEntry,
  trimWriteLog,
  writeFailureKindLabel,
  writeOpLabel,
} from './writeLogEntry.ts';

/**
 * ADR-0012's required mitigation is the instrument the beta week is read with,
 * and an instrument nobody checks is worse than none — at the gate a wrong
 * classification does not look wrong, it looks like a conclusion. These cases
 * pin the two things that would corrupt the reading silently: a tunnel failure
 * filed as the app being rejected, and user content reaching the log file.
 */

const NOW = new Date(2026, 8, 12, 6, 4, 30);

/* ---------- CLASSIFICATION ---------- */

test('a React Native fetch failure classifies as offline', () => {
  // What the platform actually throws when the connection drops.
  assert.equal(
    classifyWriteFailure(new TypeError('Network request failed')),
    'offline',
  );
  assert.equal(classifyWriteFailure(new Error('Failed to fetch')), 'offline');
  assert.equal(classifyWriteFailure(new Error('The request timed out.')), 'offline');
});

test('a network failure carrying an HTTP-shaped status still classifies as offline', () => {
  // supabase-js gives its retryable fetch errors a status of 0 or 504. Reading
  // the status first would file half the tunnel failures as the server
  // rejecting the write — the exact confusion the log exists to prevent.
  const wrapped = Object.assign(new Error('Network request failed'), { status: 504 });
  assert.equal(classifyWriteFailure(wrapped), 'offline');
});

test('a PostgREST denial classifies as rejected', () => {
  // 42501 is an RLS refusal. It is the app's problem, not the network's, and
  // must not be excused as friction at the gate.
  const denied = { code: '42501', message: 'new row violates row-level security policy' };
  assert.equal(classifyWriteFailure(denied), 'rejected');
  assert.equal(classifyWriteFailure(Object.assign(new Error('Bad request'), { status: 400 })), 'rejected');
});

test('an unrecognised failure classifies as unknown rather than as either story', () => {
  assert.equal(classifyWriteFailure(new Error('Something odd')), 'unknown');
  assert.equal(classifyWriteFailure('a string'), 'unknown');
  assert.equal(classifyWriteFailure(null), 'unknown');
});

test('an ordinary bug is NOT excused as a connection failure', () => {
  // RN's fetch failure is a TypeError, but so is `undefined.slice()` in a write
  // path. Classifying on the type rather than the message would let the app's
  // own defects count as friction at the gate.
  assert.equal(
    classifyWriteFailure(new TypeError("Cannot read property 'id' of undefined")),
    'unknown',
  );
});

/* ---------- THE RECORD ---------- */

test('an entry carries the timestamp, the op and the classification', () => {
  const entry = buildWriteLogEntry('journal.respond', new TypeError('Network request failed'), NOW);
  assert.equal(entry.at, NOW.toISOString());
  assert.equal(entry.op, 'journal.respond');
  assert.equal(entry.kind, 'offline');
  assert.equal(entry.message, 'Network request failed');
});

test('an entry keeps the error message and NOTHING else from the error', () => {
  // Postgres puts the failing row in `details` ("Failing row contains (…)"),
  // and the log is an unencrypted file on a device holding journals, finances
  // and children's records. A journal line must not reach disk in plaintext
  // because the write carrying it failed.
  const withRow = {
    code: '23514',
    message: 'new row for relation "journal_entries" violates check constraint',
    details: 'Failing row contains (uuid, 2026-09-12, {"grateful": "the private thing"}).',
    hint: 'the private thing again',
  };
  const serialized = serializeWriteLogEntry(buildWriteLogEntry('journal.respond', withRow, NOW));
  assert.ok(!serialized.includes('the private thing'));
  assert.ok(!serialized.includes('Failing row contains'));
  assert.ok(serialized.includes('23514'));
});

test('a very long message is truncated, so no error can turn the log into a transcript', () => {
  const entry = buildWriteLogEntry('action.create', new Error('x'.repeat(5000)), NOW);
  assert.ok(entry.message.length <= 200);
});

test('an error with no code omits the field rather than inventing one', () => {
  const entry = buildWriteLogEntry('action.drop', new Error('plain'), NOW);
  assert.equal(entry.code, undefined);
  assert.ok(!serializeWriteLogEntry(entry).includes('"code"'));
});

/* ---------- THE FILE ---------- */

test('entries round-trip through the file format, oldest first', () => {
  const a = buildWriteLogEntry('action.create', new Error('one'), NOW);
  const b = buildWriteLogEntry('action.drop', new Error('two'), NOW);
  const parsed = parseWriteLog(serializeWriteLogEntry(a) + serializeWriteLogEntry(b));
  assert.deepEqual([...parsed], [a, b]);
});

test('a torn last line loses that record, never the log', () => {
  // The likeliest moment for a half-written append is the app being killed or
  // the device dying — which is also the worst moment to lose the week's log.
  const good = serializeWriteLogEntry(buildWriteLogEntry('action.create', new Error('kept'), NOW));
  const parsed = parseWriteLog(`${good}{"at":"2026-09-12T`);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.message, 'kept');
});

test('a line that parses but is not an entry is skipped', () => {
  const good = serializeWriteLogEntry(buildWriteLogEntry('action.start', new Error('kept'), NOW));
  const parsed = parseWriteLog(`{"at":"not-a-date","op":"x"}\n${good}\n[]\n`);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.message, 'kept');
});

test('an empty or blank log reads as no failures, not as an error', () => {
  assert.deepEqual([...parseWriteLog('')], []);
  assert.deepEqual([...parseWriteLog('\n\n')], []);
});

/* ---------- THE CAP ---------- */

test('a log under the cap is left alone rather than rewritten', () => {
  const line = serializeWriteLogEntry(buildWriteLogEntry('action.create', new Error('e'), NOW));
  assert.equal(trimWriteLog(line.repeat(3), 10), null);
  assert.equal(trimWriteLog(line.repeat(10), 10), null);
});

test('trimming keeps the MOST RECENT entries', () => {
  const lines = Array.from({ length: 5 }, (_, i) =>
    serializeWriteLogEntry(buildWriteLogEntry('action.create', new Error(`e${i}`), NOW)),
  ).join('');

  const trimmed = trimWriteLog(lines, 2);
  assert.notEqual(trimmed, null);
  const parsed = parseWriteLog(trimmed as string);
  assert.deepEqual(parsed.map((e) => e.message), ['e3', 'e4']);
});

test('unreadable lines still count against the cap', () => {
  // Otherwise a file full of corruption could never be trimmed back down, which
  // is the one way an append-only log becomes a disk problem.
  const trimmed = trimWriteLog('garbage\n'.repeat(6), 2);
  assert.equal(trimmed, 'garbage\ngarbage\n');
});

test('the cap is bounded and the default is the one the module publishes', () => {
  assert.equal(MAX_ENTRIES, 500);
  const line = 'x\n';
  assert.equal(trimWriteLog(line.repeat(MAX_ENTRIES + 1))?.split('\n').filter(Boolean).length, MAX_ENTRIES);
});

/* ---------- READING IT BACK ---------- */

test('every op in the closed vocabulary has a plain-language label', () => {
  // A new write path adds a member to WriteOp. If it does not also add a label,
  // the log starts showing slugs to a person at 6am.
  const ops = [
    'action.create',
    'action.start',
    'action.complete',
    'action.drop',
    'action.restore',
    'journal.respond',
    'auth.otp_send',
    'auth.otp_verify',
    'auth.sign_out',
  ] as const;
  for (const op of ops) {
    assert.notEqual(writeOpLabel(op), op, `${op} has no label`);
  }
});

test('an unknown op falls back to the slug rather than vanishing', () => {
  assert.equal(writeOpLabel('finance.log'), 'finance.log');
});

test('the failure kinds are spoken in words, not in a colour or a code', () => {
  assert.equal(writeFailureKindLabel('offline'), 'No connection');
  assert.equal(writeFailureKindLabel('rejected'), 'The server refused it');
  assert.equal(writeFailureKindLabel('unknown'), 'Unexplained');
});

test('timestamps read in the device zone, and always carry the clock time', () => {
  const now = new Date(2026, 8, 12, 9, 0);
  assert.equal(failedWriteWhen(new Date(2026, 8, 12, 6, 4).toISOString(), now), 'today at 06:04');
  assert.equal(
    failedWriteWhen(new Date(2026, 8, 11, 22, 10).toISOString(), now),
    'yesterday at 22:10',
  );
  assert.equal(failedWriteWhen(new Date(2026, 7, 30, 6, 4).toISOString(), now), '30 Aug at 06:04');
});

test('an unreadable timestamp shows itself rather than "Invalid Date"', () => {
  assert.equal(failedWriteWhen('not-a-date', new Date()), 'not-a-date');
});
