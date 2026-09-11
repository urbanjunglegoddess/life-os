import { useCallback, useMemo, useReducer } from 'react';

import {
  answeredCount,
  createFlowState,
  currentAnswer,
  currentStepId,
  flowReducer,
  isComplete,
  position,
  total,
  type FlowAnswer,
  type StepId,
} from './flowMachine.ts';

/**
 * React binding for the flow machine. All behaviour lives in the reducer, which
 * is tested directly; this only wires it to a component tree.
 */
export interface Flow {
  readonly position: number;
  readonly total: number;
  readonly isComplete: boolean;
  readonly currentStepId: StepId | null;
  readonly currentAnswer: FlowAnswer | null;
  readonly answers: Readonly<Record<StepId, FlowAnswer>>;
  readonly answeredCount: number;
  readonly canGoBack: boolean;
  readonly exited: boolean;
  readonly respond: (value: string) => void;
  readonly skip: () => void;
  readonly back: () => void;
  readonly goTo: (index: number) => void;
  readonly exit: () => void;
  readonly resume: () => void;
}

export function useFlow(stepIds: readonly StepId[]): Flow {
  const [state, dispatch] = useReducer(
    flowReducer,
    stepIds,
    createFlowState,
  );

  const respond = useCallback(
    (value: string) => dispatch({ type: 'respond', value }),
    [],
  );
  const skip = useCallback(() => dispatch({ type: 'skip' }), []);
  const back = useCallback(() => dispatch({ type: 'back' }), []);
  const goTo = useCallback(
    (index: number) => dispatch({ type: 'goTo', index }),
    [],
  );
  const exit = useCallback(() => dispatch({ type: 'exit' }), []);
  const resume = useCallback(() => dispatch({ type: 'resume' }), []);

  return useMemo(
    () => ({
      position: position(state),
      total: total(state),
      isComplete: isComplete(state),
      currentStepId: currentStepId(state),
      currentAnswer: currentAnswer(state),
      answers: state.answers,
      answeredCount: answeredCount(state),
      canGoBack: state.index > 0,
      exited: state.exited,
      respond,
      skip,
      back,
      goTo,
      exit,
      resume,
    }),
    [state, respond, skip, back, goTo, exit, resume],
  );
}
