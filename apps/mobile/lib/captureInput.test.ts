import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  CaptureInputSchema,
  resolveWhen,
  type WhenChoice,
} from './captureInput.ts';

describe('a capture needs only a title (§5.5)', () => {
  test('title alone is a valid, complete capture', () => {
    const parsed = CaptureInputSchema.parse({ title: 'Call the accountant' });
    assert.equal(parsed.title, 'Call the accountant');
    assert.equal(parsed.areaId, null, 'an unfiled capture is not an invalid one');
    assert.equal(parsed.dueAt, null);
  });

  test('trims, matching the DB check on btrim(title) > 0', () => {
    assert.equal(CaptureInputSchema.parse({ title: '  spaced  ' }).title, 'spaced');
  });

  test('rejects a whitespace-only title with no write', () => {
    const r = CaptureInputSchema.safeParse({ title: '   ' });
    assert.equal(r.success, false);
  });

  test('rejects an over-long title rather than letting Postgres truncate', () => {
    assert.equal(
      CaptureInputSchema.safeParse({ title: 'x'.repeat(501) }).success,
      false,
    );
    assert.equal(
      CaptureInputSchema.safeParse({ title: 'x'.repeat(500) }).success,
      true,
    );
  });

  test('rejects an areaId that is not a uuid', () => {
    assert.equal(
      CaptureInputSchema.safeParse({ title: 'ok', areaId: 'self' }).success,
      false,
    );
  });
});

describe('resolveWhen', () => {
  // Mid-afternoon, so an end-of-day answer cannot silently land on the wrong date.
  const now = new Date('2026-09-11T15:30:00');

  test('someday is a real answer, not a missing one', () => {
    assert.equal(resolveWhen('someday', now), null);
  });

  test('today is the END of today, so a capture is not instantly overdue', () => {
    const due = new Date(resolveWhen('today', now) as string);
    assert.equal(due.getDate(), now.getDate());
    assert.equal(due.getHours(), 23);
    assert.equal(due.getMinutes(), 59);
    assert.ok(due.getTime() > now.getTime(), 'must be in the future');
  });

  test('tomorrow is the end of the next day', () => {
    const due = new Date(resolveWhen('tomorrow', now) as string);
    const expected = new Date(now);
    expected.setDate(expected.getDate() + 1);
    assert.equal(due.getDate(), expected.getDate());
    assert.equal(due.getMonth(), expected.getMonth());
  });

  test('rolls over month and year boundaries', () => {
    const nye = new Date('2026-12-31T15:30:00');
    const due = new Date(resolveWhen('tomorrow', nye) as string);
    assert.equal(due.getFullYear(), 2027);
    assert.equal(due.getMonth(), 0);
    assert.equal(due.getDate(), 1);
  });

  test('does not mutate the clock it was handed', () => {
    const before = new Date('2026-09-11T15:30:00');
    const snapshot = before.getTime();
    (['today', 'tomorrow', 'someday'] as WhenChoice[]).forEach((c) =>
      resolveWhen(c, before),
    );
    assert.equal(before.getTime(), snapshot);
  });

  test('every choice produces a value the schema accepts', () => {
    for (const choice of ['today', 'tomorrow', 'someday'] as WhenChoice[]) {
      const r = CaptureInputSchema.safeParse({
        title: 'ok',
        dueAt: resolveWhen(choice, now),
      });
      assert.equal(r.success, true, `${choice} must round-trip through the schema`);
    }
  });
});
