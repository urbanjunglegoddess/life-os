import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  answerFor,
  answeredCount,
  createFlowState,
  currentAnswer,
  currentStepId,
  flowReducer,
  isComplete,
  position,
  total,
  type FlowEvent,
  type FlowState,
} from './flowMachine.ts';

/**
 * One test per non-negotiable in BUILD-SPEC §5.3. These are product rules, not
 * implementation details — they are the reason the primitive exists, and a
 * regression in any of them is a regression in the product rather than a bug in
 * a component.
 */

const run = (state: FlowState, ...events: FlowEvent[]): FlowState =>
  events.reduce(flowReducer, state);

const threeSteps = () => createFlowState(['overdue-1', 'overdue-2', 'due-1']);

describe('progress is always visible', () => {
  test('reports position and total from the start', () => {
    const s = threeSteps();
    assert.equal(position(s), 1);
    assert.equal(total(s), 3);
  });

  test('position advances with each answer and never exceeds total', () => {
    const s = run(threeSteps(), { type: 'respond', value: 'later' }, { type: 'skip' });
    assert.equal(position(s), 3);

    const done = run(s, { type: 'skip' });
    assert.equal(position(done), 3, 'position must not read 4 of 3 once complete');
    assert.equal(isComplete(done), true);
  });
});

describe('back always works', () => {
  test('is a no-op at the first step rather than an error or an exit', () => {
    const s = threeSteps();
    const back = flowReducer(s, { type: 'back' });
    assert.deepEqual(back, s);
    assert.equal(back.exited, false);
  });

  test('restores the previous answer', () => {
    const s = run(threeSteps(), { type: 'respond', value: 'do-now' }, { type: 'back' });
    assert.equal(currentStepId(s), 'overdue-1');
    assert.deepEqual(currentAnswer(s), { kind: 'responded', value: 'do-now' });
  });

  test('re-answering after back overwrites rather than duplicating', () => {
    const s = run(
      threeSteps(),
      { type: 'respond', value: 'do-now' },
      { type: 'back' },
      { type: 'respond', value: 'later' },
    );
    assert.deepEqual(answerFor(s, 'overdue-1'), { kind: 'responded', value: 'later' });
    assert.equal(answeredCount(s), 1);
  });

  test('works from the cleared state back into the last step', () => {
    const done = run(
      threeSteps(),
      { type: 'skip' },
      { type: 'skip' },
      { type: 'respond', value: 'drop' },
    );
    assert.equal(isComplete(done), true);

    const back = flowReducer(done, { type: 'back' });
    assert.equal(isComplete(back), false);
    assert.equal(currentStepId(back), 'due-1');
    assert.deepEqual(currentAnswer(back), { kind: 'responded', value: 'drop' });
  });
});

describe('deferral is never punished', () => {
  test('a skip is recorded as a real answer, not as an absence', () => {
    const s = flowReducer(threeSteps(), { type: 'skip' });
    assert.deepEqual(answerFor(s, 'overdue-1'), { kind: 'skipped' });
    assert.equal(answeredCount(s), 1, 'a skipped step counts as handled');
  });

  test('skipping every step still completes the flow', () => {
    const s = run(threeSteps(), { type: 'skip' }, { type: 'skip' }, { type: 'skip' });
    assert.equal(isComplete(s), true);
    assert.equal(answeredCount(s), 3);
  });
});

describe('exit loses nothing', () => {
  test('preserves answers and position', () => {
    const before = run(threeSteps(), { type: 'respond', value: 'do-now' });
    const exited = flowReducer(before, { type: 'exit' });

    assert.equal(exited.exited, true);
    assert.equal(exited.index, before.index, 'position survives the exit');
    assert.deepEqual(exited.answers, before.answers);

    const resumed = flowReducer(exited, { type: 'resume' });
    assert.equal(resumed.exited, false);
    assert.equal(currentStepId(resumed), 'overdue-2');
  });
});

describe('the escape hatch can jump anywhere', () => {
  test('goes straight to a step chosen from the list', () => {
    const s = flowReducer(threeSteps(), { type: 'goTo', index: 2 });
    assert.equal(currentStepId(s), 'due-1');
  });

  test('clamps out-of-range indices instead of rendering nothing', () => {
    const high = flowReducer(threeSteps(), { type: 'goTo', index: 99 });
    assert.equal(high.index, 3, 'clamps to the cleared state, not past it');
    assert.equal(isComplete(high), true);

    const low = flowReducer(threeSteps(), { type: 'goTo', index: -5 });
    assert.equal(low.index, 0);
  });
});

describe('the cleared state', () => {
  test('a flow with no steps is complete on arrival', () => {
    const s = createFlowState([]);
    assert.equal(isComplete(s), true);
    assert.equal(total(s), 0);
    assert.equal(currentStepId(s), null);
  });

  test('answering past the end records nothing and does not drift', () => {
    const done = run(createFlowState(['only']), { type: 'skip' });
    const after = run(done, { type: 'respond', value: 'x' }, { type: 'skip' });

    assert.equal(after.index, done.index, 'index must not run away past the end');
    assert.deepEqual(Object.keys(after.answers), ['only']);
  });
});

describe('undo (ADR-0011)', () => {
  test('clearing an answer returns the step to unanswered', () => {
    const dropped = run(threeSteps(), { type: 'respond', value: 'drop' });
    assert.equal(answeredCount(dropped), 1);

    const undone = run(dropped, { type: 'clearAnswer', stepId: 'overdue-1' });
    assert.equal(answerFor(undone, 'overdue-1'), null);
    assert.equal(answeredCount(undone), 0);
  });

  test('undo does not move the sequence backwards', () => {
    // The user corrected a mistake; they did not ask to be returned to a card
    // they have already passed. Yanking the index would be a second surprise.
    const dropped = run(threeSteps(), { type: 'respond', value: 'drop' });
    const undone = run(dropped, { type: 'clearAnswer', stepId: 'overdue-1' });

    assert.equal(undone.index, dropped.index);
    assert.equal(position(undone), position(dropped));
  });

  test('undo leaves every other answer alone', () => {
    const two = run(
      threeSteps(),
      { type: 'respond', value: 'do-now' },
      { type: 'respond', value: 'drop' },
    );
    const undone = run(two, { type: 'clearAnswer', stepId: 'overdue-2' });

    assert.deepEqual(answerFor(undone, 'overdue-1'), {
      kind: 'responded',
      value: 'do-now',
    });
    assert.equal(answerFor(undone, 'overdue-2'), null);
  });

  test('clearing an unanswered step is a no-op, not a crash', () => {
    // Reachable by a double-tap on the toast: the first undo clears the
    // answer, the second arrives against a step that no longer has one.
    const s = threeSteps();
    assert.equal(run(s, { type: 'clearAnswer', stepId: 'due-1' }), s);
    assert.equal(run(s, { type: 'clearAnswer', stepId: 'no-such-step' }), s);
  });
});

describe('state is never mutated in place', () => {
  test('the previous state is untouched by a transition', () => {
    const before = threeSteps();
    const snapshot = JSON.stringify(before);
    flowReducer(before, { type: 'respond', value: 'do-now' });
    assert.equal(JSON.stringify(before), snapshot);
  });
});
