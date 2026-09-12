import assert from 'node:assert/strict';
import { test } from 'node:test';

import { localDay } from './localDay.ts';

/**
 * `localDay` decides which day an entry files under, and getting it wrong is
 * silent: the entry saves, the unique constraint holds, and the line lands on
 * the wrong date. These cases pin the behaviour that makes it right.
 */

test('localDay formats the local calendar date, zero-padded', () => {
  assert.equal(localDay(new Date(2026, 8, 12, 6, 4)), '2026-09-12');
  assert.equal(localDay(new Date(2026, 0, 1, 0, 0)), '2026-01-01');
  assert.equal(localDay(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
});

test('localDay reads the local day, not the UTC day', () => {
  // The bug this helper exists to avoid: `toISOString().slice(0, 10)` converts
  // to UTC first, so a 6am entry anywhere west of Greenwich can file under the
  // previous date. Constructed in LOCAL time, whatever the runner's zone, so
  // the assertion is about the function rather than about the machine.
  const morning = new Date(2026, 8, 12, 6, 4);
  assert.equal(localDay(morning), '2026-09-12');

  // Late enough that UTC has already rolled over for any negative offset.
  const lateEvening = new Date(2026, 8, 12, 23, 30);
  assert.equal(localDay(lateEvening), '2026-09-12');
});

test('localDay pads single-digit months and days', () => {
  assert.equal(localDay(new Date(2026, 2, 5, 12, 0)), '2026-03-05');
});
