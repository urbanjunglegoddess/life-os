import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { doNow, dropAction, listToday } from '../../lib/today.ts';
import type { TodayQueue, TodayRow } from '../../lib/todayQueue.ts';
import { Flow, type FlowStep } from '../flow/Flow.tsx';

/**
 * The Today flow — BUILD-SPEC §5.4, and the flow primitive's first full use:
 * three fixed responses, a real cleared state, and the escape-hatch list.
 *
 * Ordering and the overdue cap live in `lib/todayQueue.ts`, tested directly.
 * This component renders the queue and performs the writes.
 */
export function TodayFlow() {
  const [queue, setQueue] = useState<TodayQueue | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setQueue(null);
    listToday()
      .then(setQueue)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Could not load today.'),
      );
  }, []);

  useEffect(load, [load]);

  const byId = new Map<string, TodayRow>(
    (queue?.cards ?? []).map((c) => [c.id, c]),
  );

  /**
   * `Later` writes NOTHING. Deferral is never punished (§5.3): the row keeps
   * its due date, gains no counter and carries no mark. It comes back tomorrow
   * unchanged, which is the whole promise of the word.
   */
  async function respond(stepId: string, value: string) {
    const card = byId.get(stepId);
    if (card === undefined) return;
    if (value === 'do-now') await doNow(card);
    if (value === 'drop') await dropAction(card.id);
  }

  const steps: FlowStep[] = (queue?.cards ?? []).map((card) => ({
    id: card.id,
    title: card.title,
    context: describe(card),
    primary: {
      label: 'Do now',
      value: 'do-now',
      hint:
        card.do_now_url !== null && card.do_now_url !== ''
          ? `Opens where "${card.title}" gets done`
          : `Marks "${card.title}" as in progress`,
    },
    secondary: {
      label: 'Later',
      value: 'later',
      hint: 'Leaves this exactly as it is and moves on',
    },
    tertiary: {
      label: 'Drop',
      value: 'drop',
      hint: `Drops "${card.title}". It stops appearing in Today`,
    },
  }));

  return (
    <>
      <Flow
        steps={steps}
        status={error !== null ? 'error' : queue === null ? 'loading' : 'ready'}
        errorMessage={error ?? undefined}
        onRetry={load}
        onRespond={respond}
        cleared={{
          title: clearedTitle(queue),
          body: clearedBody(queue),
        }}
      />
      {/*
        "+N more" — overdue work the cap is holding back. §5.4 caps the list so
        it does not become a guilt list, but held-back work is NAMED rather than
        hidden: a count you cannot see is the same silence the cap is meant to
        replace.
      */}
      {queue !== null && queue.overdueHeldBack > 0 && (
        <View className="border-t-hairline border-decorative bg-base px-4 pb-4 pt-2">
          <Text className="text-sm text-muted">
            +{queue.overdueHeldBack} more overdue, held back for now.
          </Text>
        </View>
      )}
    </>
  );
}

/** Why this card is here — the context region of §5.2. */
function describe(card: TodayRow): string {
  const where = [card.area_name, card.entity_name].filter(Boolean).join(' · ');
  /* State is spoken in words; marigold is not audible (4.8 §7). */
  const when = card.is_overdue ? 'Overdue' : 'Due today';
  return where === '' ? when : `${when} · ${where}`;
}

function clearedTitle(queue: TodayQueue | null): string {
  if (queue === null) return 'Nothing to do';
  // A worked queue is a WIN state; an empty account is an explanation. 4.5 §6.1
  // is explicit that collapsing the two into one message is the failure mode.
  return queue.cards.length === 0 ? 'Nothing due today' : 'Today is clear';
}

function clearedBody(queue: TodayQueue | null): string {
  if (queue !== null && queue.overdueHeldBack > 0) {
    return `You worked the day. ${queue.overdueHeldBack} overdue ${
      queue.overdueHeldBack === 1 ? 'item is' : 'items are'
    } still waiting whenever you want them.`;
  }
  return 'Nothing is waiting on you. Capture something if it comes up.';
}
