import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  OVERDUE_CAP,
  TodayRowSchema,
  buildTodayQueue,
  cardContext,
  dueLabel,
  type TodayRow,
} from './todayQueue.ts';

const NOW = new Date('2026-09-10T09:00:00.000-04:00');

let seq = 0;
function row(over: Partial<TodayRow> = {}): TodayRow {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    title: `Action ${seq}`,
    status: 'open',
    due_at: null,
    do_now_url: null,
    area_name: 'Money',
    entity_name: null,
    is_overdue: false,
    ...over,
  };
}

/** Local end-of-day, the boundary `captureInput.resolveWhen` writes against. */
function dueOn(day: number, hour = 23): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + day);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

describe('the overdue block is capped (ADR-0009 required mitigation)', () => {
  test('only the cap greets the user, and the rest is counted, not dropped', () => {
    const rows = Array.from({ length: 7 }, (_, i) =>
      row({ is_overdue: true, due_at: dueOn(-(i + 1)) }),
    );
    const q = buildTodayQueue(rows, NOW);

    assert.equal(q.visibleOverdueCount, OVERDUE_CAP);
    assert.equal(q.overdueHidden, 7 - OVERDUE_CAP);
    // Reachable, not deleted: "+N more" has to be able to lead somewhere.
    assert.equal(q.cards.length, 7);
  });

  test('a short overdue block is shown whole, with nothing behind "+N more"', () => {
    const q = buildTodayQueue([row({ is_overdue: true, due_at: dueOn(-1) })], NOW);
    assert.equal(q.visibleOverdueCount, 1);
    assert.equal(q.overdueHidden, 0);
  });
});

describe('consequence-first ordering (ADR-0009)', () => {
  test('overdue leads, oldest first — cost of missing rises with time owed', () => {
    const recent = row({ is_overdue: true, due_at: dueOn(-1) });
    const ancient = row({ is_overdue: true, due_at: dueOn(-9) });
    const q = buildTodayQueue([recent, ancient], NOW);

    assert.deepEqual(
      q.cards.map((c) => c.id),
      [ancient.id, recent.id],
    );
  });

  test('the whole overdue block precedes anything due today', () => {
    const today = row({ due_at: dueOn(0) });
    const overdue = row({ is_overdue: true, due_at: dueOn(-1) });
    const q = buildTodayQueue([today, overdue], NOW);

    assert.deepEqual(
      q.cards.map((c) => c.block),
      ['overdue', 'due-today'],
    );
    assert.equal(q.firstDueTodayIndex, 1);
  });

  test('ties break on id, so the morning order does not shuffle between loads', () => {
    const a = row({ is_overdue: true, due_at: dueOn(-2) });
    const b = row({ is_overdue: true, due_at: dueOn(-2) });
    const forward = buildTodayQueue([a, b], NOW).cards.map((c) => c.id);
    const reversed = buildTodayQueue([b, a], NOW).cards.map((c) => c.id);
    assert.deepEqual(forward, reversed);
  });
});

describe('what Today is not', () => {
  test('an action with no due date is not today\'s problem', () => {
    assert.equal(buildTodayQueue([row({ due_at: null })], NOW).cards.length, 0);
  });

  test('tomorrow stays tomorrow', () => {
    assert.equal(buildTodayQueue([row({ due_at: dueOn(1) })], NOW).cards.length, 0);
  });

  test('due later tonight still counts as today', () => {
    const q = buildTodayQueue([row({ due_at: dueOn(0, 23) })], NOW);
    assert.equal(q.cards.length, 1);
    assert.equal(q.cards[0]?.block, 'due-today');
  });

  test('done work does not come back round', () => {
    const q = buildTodayQueue(
      [row({ status: 'done', is_overdue: false, due_at: dueOn(0) })],
      NOW,
    );
    assert.equal(q.cards.length, 0);
  });

  test('an action already in progress stays in the queue', () => {
    const q = buildTodayQueue([row({ status: 'doing', due_at: dueOn(0) })], NOW);
    assert.equal(q.cards[0]?.status, 'doing');
  });

  test('a cleared day is an empty queue, which the screen states in words', () => {
    const q = buildTodayQueue([], NOW);
    assert.deepEqual(q.cards, []);
    assert.equal(q.overdueHidden, 0);
    assert.equal(q.firstDueTodayIndex, 0);
  });
});

describe('copy carries no guilt (§5.3)', () => {
  const overdue = (days: number) =>
    buildTodayQueue([row({ is_overdue: true, due_at: dueOn(-days) })], NOW)
      .cards[0]!;

  test('overdue is stated flatly, in days', () => {
    assert.equal(dueLabel(overdue(1), NOW), 'was due yesterday');
    assert.equal(dueLabel(overdue(4), NOW), 'was due 4 days ago');
  });

  test('something that fell overdue this morning is not called a day late', () => {
    const q = buildTodayQueue(
      [row({ is_overdue: true, due_at: dueOn(0, 6) })],
      NOW,
    );
    assert.equal(dueLabel(q.cards[0]!, NOW), 'was due earlier today');
  });

  test('an unfiled action still gets a context line rather than a blank', () => {
    const q = buildTodayQueue([row({ area_name: null, due_at: dueOn(0) })], NOW);
    assert.equal(cardContext(q.cards[0]!, NOW), 'Unfiled · due today');
  });
});

describe('the view boundary is validated, not trusted', () => {
  test('accepts a row as PostgREST sends it, offset and all', () => {
    const parsed = TodayRowSchema.parse({
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Call the accountant',
      status: 'open',
      due_at: '2026-09-10T23:59:59.999+00:00',
      do_now_url: null,
      area_name: 'Money',
      entity_name: null,
      is_overdue: false,
    });
    assert.equal(parsed.title, 'Call the accountant');
  });

  test('a missing is_overdue fails loudly instead of rendering as not-overdue', () => {
    const result = TodayRowSchema.safeParse({
      id: '00000000-0000-4000-8000-000000000001',
      title: 'x',
      status: 'open',
      due_at: null,
      do_now_url: null,
      area_name: null,
      entity_name: null,
    });
    assert.equal(result.success, false);
  });
});
