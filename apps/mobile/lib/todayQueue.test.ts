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

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildTodayQueue, OVERDUE_CAP, type TodayRow } from './todayQueue.ts';

const NOW = new Date('2026-09-12T14:00:00');

function row(over: Partial<TodayRow> & { id: string }): TodayRow {
  return {
    title: `action ${over.id}`,
    status: 'open',
    due_at: null,
    do_now_url: null,
    area_name: null,
    entity_name: null,
    is_overdue: false,
    ...over,
  };
}

/** Local-time ISO so "due today" is tested against the device clock, as shipped. */
const localIso = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().replace('Z', '');

const daysAgo = (n: number) => localIso(new Date(NOW.getTime() - n * 86_400_000));
const laterToday = localIso(new Date(NOW.getTime() + 4 * 3_600_000));
const tomorrow = localIso(new Date(NOW.getTime() + 26 * 3_600_000));

describe('consequence-first ordering (§5.4)', () => {
  test('overdue leads, then due today', () => {
    const q = buildTodayQueue(
      [
        row({ id: 'today', due_at: laterToday }),
        row({ id: 'overdue', due_at: daysAgo(2), is_overdue: true }),
      ],
      { now: NOW },
    );
    assert.deepEqual(
      q.cards.map((c) => c.id),
      ['overdue', 'today'],
      'overdue must come first regardless of input order',
    );
  });

  test('within overdue, the oldest leads', () => {
    const q = buildTodayQueue(
      [
        row({ id: 'recent', due_at: daysAgo(1), is_overdue: true }),
        row({ id: 'ancient', due_at: daysAgo(30), is_overdue: true }),
        row({ id: 'middling', due_at: daysAgo(7), is_overdue: true }),
      ],
      { cap: 10, now: NOW },
    );
    assert.deepEqual(
      q.cards.map((c) => c.id),
      ['ancient', 'middling', 'recent'],
    );
  });

  test('is_overdue comes from the view and is never second-guessed', () => {
    // A past due date NOT flagged overdue by the view stays out of the overdue
    // group — recomputing the rule here would be the duplicated formula.
    const q = buildTodayQueue(
      [row({ id: 'trusted', due_at: daysAgo(5), is_overdue: false })],
      { now: NOW },
    );
    assert.equal(q.overdueShown, 0);
    assert.equal(q.cards.length, 0, 'a past date on another day is not due today');
  });
});

describe('the overdue cap (§5.4 — an unbounded list is a guilt list)', () => {
  const sixOverdue = Array.from({ length: 6 }, (_, i) =>
    row({ id: `o${i}`, due_at: daysAgo(10 - i), is_overdue: true }),
  );

  test('caps the overdue group and reports what is held back', () => {
    const q = buildTodayQueue(sixOverdue, { cap: 3, now: NOW });
    assert.equal(q.overdueShown, 3);
    assert.equal(q.overdueHeldBack, 3, 'the "+N more" count');
    assert.equal(q.cards.length, 3);
  });

  test('holds back the LEAST overdue, keeping the oldest', () => {
    const q = buildTodayQueue(sixOverdue, { cap: 2, now: NOW });
    assert.deepEqual(q.cards.map((c) => c.id), ['o0', 'o1']);
  });

  test('the cap never truncates due-today work', () => {
    // THREE due-today items against a cap of one: a single item would survive
    // any slice, so it cannot tell a capped group from an uncapped one.
    const q = buildTodayQueue(
      [
        ...sixOverdue,
        row({ id: 't1', due_at: laterToday }),
        row({ id: 't2', due_at: laterToday }),
        row({ id: 't3', due_at: laterToday }),
      ],
      { cap: 1, now: NOW },
    );
    assert.equal(q.overdueShown, 1);
    assert.equal(q.dueTodayShown, 3, 'every due-today item survives the cap');
    assert.deepEqual(q.cards.map((c) => c.id), ['o0', 't1', 't2', 't3']);
  });

  test('nothing is held back when the queue fits', () => {
    const q = buildTodayQueue(sixOverdue.slice(0, 2), { cap: 3, now: NOW });
    assert.equal(q.overdueHeldBack, 0);
  });

  test('a nonsense cap shows everything rather than emptying the queue', () => {
    for (const cap of [0, -1, Number.NaN]) {
      const q = buildTodayQueue(sixOverdue, { cap, now: NOW });
      assert.equal(q.overdueShown, 6, `cap ${cap} must not hide overdue work`);
      assert.equal(q.overdueHeldBack, 0);
    }
  });

  test('the shipped default is a positive number', () => {
    assert.ok(OVERDUE_CAP > 0 && Number.isInteger(OVERDUE_CAP));
  });
});

describe('what does not belong in Today', () => {
  test('completed work is not a decision to make again', () => {
    // Both done rows would otherwise qualify — one overdue, one due today — so
    // the status filter is what excludes them, not the date bucketing.
    const q = buildTodayQueue(
      [
        row({ id: 'done-overdue', due_at: daysAgo(3), is_overdue: true, status: 'done' }),
        row({ id: 'done-today', due_at: laterToday, status: 'done' }),
        row({ id: 'doing', due_at: laterToday, status: 'doing' }),
        row({ id: 'open-overdue', due_at: daysAgo(1), is_overdue: true }),
      ],
      { now: NOW },
    );
    assert.deepEqual(
      q.cards.map((c) => c.id),
      ['open-overdue', 'doing'],
      'in-progress and open stay; done goes even when overdue or due today',
    );
    assert.equal(q.overdueShown, 1, 'a completed overdue item is not overdue work');
  });

  test('tomorrow is not today', () => {
    const q = buildTodayQueue([row({ id: 'later', due_at: tomorrow })], { now: NOW });
    assert.equal(q.cards.length, 0);
  });

  test('an action with no due date is not due today', () => {
    const q = buildTodayQueue([row({ id: 'someday' })], { now: NOW });
    assert.equal(q.cards.length, 0, 'a someday capture must not appear in Today');
  });

  test('an empty queue is the cleared state, not an error', () => {
    const q = buildTodayQueue([], { now: NOW });
    assert.deepEqual(q.cards, []);
    assert.equal(q.overdueHeldBack, 0);
  });
});

describe('purity', () => {
  test('does not mutate or reorder the caller’s array', () => {
    const input = [
      row({ id: 'b', due_at: daysAgo(1), is_overdue: true }),
      row({ id: 'a', due_at: daysAgo(9), is_overdue: true }),
    ];
    const order = input.map((r) => r.id);
    buildTodayQueue(input, { now: NOW });
    assert.deepEqual(input.map((r) => r.id), order);
  });
});
