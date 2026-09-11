/**
 * The flow state machine — BUILD-SPEC §5.3.
 *
 * Kept as a PURE REDUCER with no React and no imports, so the non-negotiables
 * can be tested directly rather than inferred from a rendered screen. Every rule
 * in §5.3 that is expressible as state is enforced here, once, instead of being
 * re-implemented correctly-or-not by each flow.
 */

export type StepId = string;

/**
 * A step's outcome. `skipped` is a FIRST-CLASS answer, not an absence: §5.3 says
 * deferral is never punished, and a model that recorded a skip as "no answer"
 * would make it indistinguishable from "not reached yet" — which is how guilt
 * counters get built by accident.
 */
export type FlowAnswer =
  | { readonly kind: 'responded'; readonly value: string }
  | { readonly kind: 'skipped' };

export interface FlowState {
  readonly stepIds: readonly StepId[];
  readonly index: number;
  readonly answers: Readonly<Record<StepId, FlowAnswer>>;
  /** Set by `exit`. Answers are deliberately preserved alongside it. */
  readonly exited: boolean;
}

export type FlowEvent =
  | { readonly type: 'respond'; readonly value: string }
  | { readonly type: 'skip' }
  | { readonly type: 'back' }
  | { readonly type: 'goTo'; readonly index: number }
  | { readonly type: 'exit' }
  | { readonly type: 'resume' };

export function createFlowState(stepIds: readonly StepId[]): FlowState {
  return { stepIds, index: 0, answers: {}, exited: false };
}

function record(state: FlowState, answer: FlowAnswer): FlowState {
  const stepId = state.stepIds[state.index];
  // Past the end there is no step to answer. Recording under `undefined` would
  // create a junk key that the cleared-state check then counts.
  if (stepId === undefined) return state;

  return {
    ...state,
    answers: { ...state.answers, [stepId]: answer },
    index: state.index + 1,
  };
}

export function flowReducer(state: FlowState, event: FlowEvent): FlowState {
  switch (event.type) {
    case 'respond':
      return record(state, { kind: 'responded', value: event.value });

    case 'skip':
      return record(state, { kind: 'skipped' });

    case 'back':
      // "Back always works" (§5.3). At the first step there is nowhere to go,
      // and back must still not throw or exit the flow — it is a no-op. The
      // previous answer is not cleared, which is what makes back RESTORE it.
      return state.index === 0 ? state : { ...state, index: state.index - 1 };

    case 'goTo': {
      // The escape hatch jumps straight to a step from the "show all" list.
      // Clamped rather than trusted: an out-of-range index would render a blank
      // screen with no way back.
      const max = state.stepIds.length;
      const clamped = Math.min(Math.max(event.index, 0), max);
      return { ...state, index: clamped };
    }

    case 'exit':
      // "Every flow is exitable at any point WITHOUT LOSING what was already
      // answered" (§5.3). Answers and position both survive.
      return { ...state, exited: true };

    case 'resume':
      return { ...state, exited: false };
  }
}

/* ---------- selectors ---------- */

/** 1-based, for display. §5.3 requires position AND total to be visible. */
export function position(state: FlowState): number {
  return Math.min(state.index + 1, state.stepIds.length);
}

export function total(state: FlowState): number {
  return state.stepIds.length;
}

/**
 * True when every step has been passed. A flow with no steps is complete on
 * arrival — that is the cleared state in §5.4, which is a real screen rather
 * than an empty list.
 */
export function isComplete(state: FlowState): boolean {
  return state.index >= state.stepIds.length;
}

export function currentStepId(state: FlowState): StepId | null {
  return state.stepIds[state.index] ?? null;
}

/** The answer for the step in view, so going back restores what was chosen. */
export function currentAnswer(state: FlowState): FlowAnswer | null {
  const id = currentStepId(state);
  return id === null ? null : (state.answers[id] ?? null);
}

export function answerFor(state: FlowState, stepId: StepId): FlowAnswer | null {
  return state.answers[stepId] ?? null;
}

export function answeredCount(state: FlowState): number {
  return state.stepIds.filter((id) => state.answers[id] !== undefined).length;
}
