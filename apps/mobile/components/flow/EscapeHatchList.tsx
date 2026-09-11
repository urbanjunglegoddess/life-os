import { Pressable, ScrollView, Text, View } from 'react-native';
import { TARGET } from '@life-os/tokens';

import type { FlowAnswer, StepId } from './flowMachine.ts';

export interface EscapeHatchItem {
  readonly id: StepId;
  readonly title: string;
}

export interface EscapeHatchListProps {
  readonly items: readonly EscapeHatchItem[];
  readonly answers: Readonly<Record<StepId, FlowAnswer>>;
  readonly onSelect: (index: number) => void;
  readonly onClose: () => void;
}

/**
 * The escape hatch — BUILD-SPEC §5.1.
 *
 * "Neurodivergent is not one set of needs. Reducing visible structure helps
 * executive-function load and HURTS people who need to see whole structure to
 * feel oriented." This is the whole flow as one scannable list, reachable from
 * the same position on every screen.
 *
 * Status is a WORD, never a colour alone (4.8 §7, §4.8) — a screen reader gets
 * nothing from marigold, and neither does anyone who cannot separate these hues.
 */
function statusLabel(answer: FlowAnswer | undefined): string {
  if (answer === undefined) return 'Not answered';
  return answer.kind === 'skipped' ? 'Skipped' : 'Answered';
}

export function EscapeHatchList({
  items,
  answers,
  onSelect,
  onClose,
}: EscapeHatchListProps) {
  return (
    <View className="flex-1 bg-base">
      <View className="flex-row items-center justify-between gap-2 px-4 py-3">
        <Text
          accessibilityRole="header"
          className="text-xl font-semibold text-primary"
        >
          All questions
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close the list"
          accessibilityHint="Returns to the question you were on"
          hitSlop={TARGET['hit-slop-default']}
          style={{ minHeight: TARGET['tap-target-min'] }}
          className="justify-center rounded-md border-thin border-meaningful px-4"
        >
          <Text className="text-base font-semibold text-primary">Close</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="gap-2 px-4 pb-8">
        {items.map((item, index) => {
          const status = statusLabel(answers[item.id]);
          return (
            <Pressable
              key={item.id}
              onPress={() => onSelect(index)}
              accessibilityRole="button"
              /* One composed label, not fragments to swipe through (4.8 §7). */
              accessibilityLabel={`${index + 1} of ${items.length}. ${item.title}. ${status}`}
              accessibilityHint="Jumps to this question"
              style={{ minHeight: TARGET['tap-target-min'] }}
              className="justify-center gap-1 rounded-lg border-thin border-decorative bg-surface p-4"
            >
              <Text className="text-base text-primary">{item.title}</Text>
              <Text className="text-sm text-muted">{status}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
