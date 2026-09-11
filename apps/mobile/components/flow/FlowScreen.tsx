import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { TARGET } from '@life-os/tokens';

import { FlowAction, type FlowActionSpec } from './FlowAction.tsx';

export interface FlowScreenProps {
  readonly position: number;
  readonly total: number;
  readonly onShowAll: () => void;
  readonly onBack: () => void;
  readonly canGoBack: boolean;
  /** THE SUBJECT — the one thing being decided. */
  readonly title: string;
  /** Why it is here. */
  readonly context?: string;
  /**
   * What the subject is answered WITH, when a fixed response set cannot carry
   * it — a text field, or a list too long for three slots. It sits inside
   * region 2 so the anatomy is unchanged: the subject is still one thing, and
   * the response row below still never moves.
   */
  readonly children?: ReactNode;
  /**
   * Responses in FIXED SLOTS rather than an array. §5.2 says position is
   * load-bearing and actions never reorder between screens, and an array would
   * make reordering a one-line accident in a caller nobody re-reads. A person
   * should be able to hit "later" without reading, three mornings in.
   */
  readonly primary: FlowActionSpec;
  readonly secondary?: FlowActionSpec;
  readonly tertiary?: FlowActionSpec;
}

/**
 * The four-region screen anatomy — BUILD-SPEC §5.2. Every flow screen in the
 * app is this component with different content.
 *
 * ┌──────────────────────────────┐
 * │ ‹ back   progress   show all │  where am I · escape hatch
 * ├──────────────────────────────┤
 * │  THE SUBJECT                 │  one thing
 * │  its context                 │  why it is here
 * ├──────────────────────────────┤
 * │  [ primary ] [ alt ] [ alt ] │  fixed positions, motor memory
 * └──────────────────────────────┘
 */
export function FlowScreen({
  position,
  total,
  onShowAll,
  onBack,
  canGoBack,
  title,
  context,
  children,
  primary,
  secondary,
  tertiary,
}: FlowScreenProps) {
  return (
    <View className="flex-1 bg-base">
      {/* REGION 1 — where am I, and the way out. Same place on every screen. */}
      <View className="flex-row items-center justify-between gap-2 px-4 py-3">
        {/*
          Back is rendered even when it cannot act, disabled rather than absent.
          Removing it would shift progress sideways between the first screen and
          the rest, and §5.2 makes position load-bearing.
        */}
        <FlowAction
          label="Back"
          hint="Returns to the previous question and restores your answer"
          onPress={onBack}
          disabled={!canGoBack}
        />

        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`Question ${position} of ${total}`}
          accessibilityValue={{ min: 1, max: total, now: position }}
          className="flex-1"
        >
          <Text className="text-center text-sm text-muted">
            {position} of {total}
          </Text>
        </View>

        {/*
          The escape hatch is NOT optional (§5.1). Reducing visible structure
          helps executive-function load and hurts people who need to see whole
          structure to feel oriented; this drops the flow to a scannable list.
        */}
        <FlowAction
          label="Show all"
          hint="Shows every question in this flow as a list you can scan"
          onPress={onShowAll}
        />
      </View>

      {/* REGION 2 — one thing, and why it is here. */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow justify-center gap-2 px-4 py-8"
      >
        {/*
          No numberOfLines anywhere in this region. Truncating text that carries
          a decision is banned (4.8 §6) — the subject IS the decision.
        */}
        <Text
          accessibilityRole="header"
          className="text-2xl font-semibold leading-snug text-primary"
        >
          {title}
        </Text>
        {context !== undefined && (
          <Text className="text-base leading-relaxed text-muted">{context}</Text>
        )}
        {children !== undefined && <View className="gap-2 pt-4">{children}</View>}
      </ScrollView>

      {/*
        REGION 3 — the response set, in the thumb arc (4.5 §5 EASY zone).
        `minHeight` on the row, never a fixed height: at the largest OS text
        scale these labels grow, and the primary action may never be the thing
        that collapses (4.8 §6).
      */}
      <View
        className="flex-row gap-2 px-4 pb-8 pt-4"
        style={{ minHeight: TARGET['tap-target-min'] }}
      >
        <FlowAction {...primary} emphasis="primary" />
        {secondary !== undefined && <FlowAction {...secondary} />}
        {tertiary !== undefined && <FlowAction {...tertiary} />}
      </View>
    </View>
  );
}
