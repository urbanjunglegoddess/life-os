import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { TARGET } from '@life-os/tokens';

import { EscapeHatchList } from './EscapeHatchList.tsx';
import { FlowScreen } from './FlowScreen.tsx';
import type { FlowAnswer, StepId } from './flowMachine.ts';
import { useFlow } from './useFlow.ts';

export interface FlowResponse {
  readonly label: string;
  /** Recorded as the step's answer. */
  readonly value: string;
  /** What it will do, for a screen reader (4.8 §7.1). */
  readonly hint?: string;
}

export interface FlowStep {
  readonly id: StepId;
  readonly title: string;
  readonly context?: string;
  readonly primary: FlowResponse;
  readonly secondary?: FlowResponse;
  readonly tertiary?: FlowResponse;
}

export interface FlowProps {
  readonly steps: readonly FlowStep[];
  readonly status?: 'loading' | 'error' | 'ready';
  /** Plain language. No codes, no stack traces (4.5 §6.1). */
  readonly errorMessage?: string;
  readonly onRetry?: () => void;
  /**
   * The cleared state is a REAL SCREEN, not an empty list (§5.4). The caller
   * supplies the words because the three kinds of empty mean different things —
   * a worked queue is a win, an empty account is an explanation (4.5 §6.1) —
   * and collapsing them into one generic message is the failure mode.
   */
  readonly cleared: { readonly title: string; readonly body?: string };
  readonly onComplete?: (answers: Readonly<Record<StepId, FlowAnswer>>) => void;
}

/**
 * The reusable flow primitive — BUILD-SPEC §5.2 and §5.3.
 *
 * Every flow in the app is this component with different content. Getting it
 * right once is the difference between a coherent product and four things that
 * resemble each other.
 *
 * There are no timers anywhere in this file, deliberately (§5.3).
 */
export function Flow({
  steps,
  status = 'ready',
  errorMessage,
  onRetry,
  cleared,
  onComplete,
}: FlowProps) {
  const flow = useFlow(steps.map((s) => s.id));
  const [showingAll, setShowingAll] = useState(false);

  useEffect(() => {
    if (status === 'ready' && flow.isComplete) onComplete?.(flow.answers);
  }, [status, flow.isComplete, flow.answers, onComplete]);

  /* ---------- LOADING ---------- */
  if (status === 'loading') {
    return (
      <View
        className="flex-1 gap-4 bg-base p-4"
        accessibilityRole="progressbar"
        /* Announced busy ONCE, not on every frame (4.5 §6.1). */
        accessibilityLabel="Loading"
        accessibilityState={{ busy: true }}
      >
        {/*
          Skeletons at the real height so the layout does not jump when content
          lands, and carrying NO text — a greyed-out placeholder value reads as
          real data for the half-second before it is replaced.
        */}
        <View className="h-12 rounded-lg bg-surface" />
        <View className="grow rounded-lg bg-surface" />
        <View
          className="rounded-lg bg-surface"
          style={{ height: TARGET['tap-target-min'] }}
        />
      </View>
    );
  }

  /* ---------- ERROR ---------- */
  if (status === 'error') {
    return (
      <View className="flex-1 justify-center gap-4 bg-base p-4">
        <Text
          accessibilityRole="header"
          className="text-xl font-semibold text-state-error"
        >
          {/* The state is spoken in words; ember is not audible (4.8 §7). */}
          Could not load this flow
        </Text>
        <Text className="text-base leading-relaxed text-muted">
          {errorMessage ?? 'Something went wrong. Your answers are safe.'}
        </Text>
        {onRetry !== undefined && (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            hitSlop={TARGET['hit-slop-default']}
            style={{ minHeight: TARGET['tap-target-min'] }}
            className="justify-center rounded-md bg-accent-primary px-4"
          >
            <Text className="text-center text-base font-semibold text-on-warm">
              Try again
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  /* ---------- ESCAPE HATCH ---------- */
  if (showingAll) {
    return (
      <EscapeHatchList
        items={steps.map(({ id, title }) => ({ id, title }))}
        answers={flow.answers}
        onSelect={(index) => {
          flow.goTo(index);
          setShowingAll(false);
        }}
        onClose={() => setShowingAll(false)}
      />
    );
  }

  /* ---------- CLEARED ---------- */
  if (flow.isComplete) {
    return (
      <ScrollView
        className="flex-1 bg-base"
        contentContainerClassName="grow justify-center gap-2 p-4"
      >
        {/*
          Say so plainly and STOP. Do not backfill with optional work to keep the
          sequence going — that teaches people the flow never ends (§5.4). There
          is deliberately no action on this screen.
        */}
        <Text
          accessibilityRole="header"
          className="text-2xl font-semibold leading-snug text-state-success-text"
        >
          {cleared.title}
        </Text>
        {cleared.body !== undefined && (
          <Text className="text-base leading-relaxed text-muted">
            {cleared.body}
          </Text>
        )}
      </ScrollView>
    );
  }

  /* ---------- THE STEP ---------- */
  const step = steps[flow.position - 1];
  if (step === undefined) return null;

  const respond = (r: FlowResponse) => ({
    label: r.label,
    hint: r.hint,
    onPress: () => flow.respond(r.value),
  });

  return (
    <FlowScreen
      position={flow.position}
      total={flow.total}
      canGoBack={flow.canGoBack}
      onBack={flow.back}
      onShowAll={() => setShowingAll(true)}
      title={step.title}
      context={step.context}
      primary={respond(step.primary)}
      secondary={step.secondary && respond(step.secondary)}
      tertiary={step.tertiary && respond(step.tertiary)}
    />
  );
}
