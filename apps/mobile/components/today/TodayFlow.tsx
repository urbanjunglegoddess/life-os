import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TARGET } from '@life-os/tokens';

import {
  completeAction,
  dropAction,
  listTodayRows,
  restoreAction,
  startAction,
} from '../../lib/today.ts';
import {
  buildTodayQueue,
  cardContext,
  dueLabel,
  type TodayCard,
  type TodayQueue,
} from '../../lib/todayQueue.ts';
import { EscapeHatchList } from '../flow/EscapeHatchList.tsx';
import { Flow } from '../flow/Flow.tsx';
import { FlowScreen } from '../flow/FlowScreen.tsx';
import { UndoToast } from '../flow/UndoToast.tsx';
import { useFlow } from '../flow/useFlow.ts';

/**
 * The Today flow — BUILD-SPEC §5.4, build order step 6.
 *
 * The screen the kill criterion measures. It answers one question at 6am —
 * what breaks if I skip today — and serves the answer one card at a time
 * (ADR-0009 ranks the queue, ADR-0010 delivers it one item at a time).
 */

/** What a card was answered with. Recorded by the flow machine as its answer. */
type Answer = 'do-now' | 'done' | 'later' | 'drop';

export function TodayFlow({ onDone }: { onDone: () => void }) {
  const [queue, setQueue] = useState<TodayQueue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setQueue(null);
    setError(null);

    listTodayRows()
      // `now` is read once, here, so every card in one sitting is measured
      // against the same moment — a queue that re-ranked itself mid-sequence
      // would move things under the user's thumb.
      .then((rows) => active && setQueue(buildTodayQueue(rows, new Date())))
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Could not load today.');
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  /* Loading and error reuse the primitive's own screens rather than growing a
     second pair that drift apart (§7 step 4 — every flow is that component). */
  if (error !== null) {
    return (
      <Flow
        steps={[]}
        status="error"
        errorMessage={error}
        onRetry={() => setAttempt((n) => n + 1)}
        cleared={{ title: 'Nothing needs you today.' }}
      />
    );
  }

  if (queue === null) {
    return <Flow steps={[]} status="loading" cleared={{ title: 'Loading' }} />;
  }

  /* Keyed on the attempt so a retry mounts a fresh flow: the machine takes its
     steps at creation, and a reload with different cards must not land on the
     old sequence's index. */
  return <TodayQueueFlow key={attempt} queue={queue} onDone={onDone} />;
}

function TodayQueueFlow({
  queue,
  onDone,
}: {
  readonly queue: TodayQueue;
  readonly onDone: () => void;
}) {
  const flow = useFlow(queue.cards.map((c) => c.id));
  const [showingAll, setShowingAll] = useState(false);
  /** "+N more" — the hidden overdue block, until the user asks for it (§5.4). */
  const [expanded, setExpanded] = useState(queue.overdueHidden === 0);
  const [writing, setWriting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    readonly card: TodayCard;
    readonly kind: Answer;
  } | null>(null);
  /**
   * The last drop, held so it can be taken back (ADR-0011, artboard 1d).
   * `previousStatus` rather than a bare id: restoring has to put the row back
   * as it was, not flatten an in-progress action to 'open'.
   */
  const [dropped, setDropped] = useState<{
    readonly card: TodayCard;
    readonly previousStatus: 'open' | 'doing';
  } | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);

  const answer = useCallback(
    async (card: TodayCard, kind: Answer) => {
      // "Later" WRITES NOTHING, deliberately. Deferral is never punished
      // (§5.3), and pushing the due date would be the app quietly rewriting a
      // commitment because the user was not ready at 6am. The card comes round
      // again tomorrow, unchanged.
      if (kind === 'later') {
        // A new answer supersedes the undo offer: the toast is about the thing
        // you just did, and one card on it is no longer the thing you just did.
        setDropped(null);
        setUndoError(null);
        flow.skip();
        return;
      }

      setWriting(true);
      setFailure(null);
      setUndoError(null);
      try {
        if (kind === 'do-now') {
          await startAction(card.id);
          if (card.doNowUrl !== null) await Linking.openURL(card.doNowUrl);
          setDropped(null);
        } else if (kind === 'done') {
          await completeAction(card.id);
          setDropped(null);
        } else {
          await dropAction(card.id);
          // Offered only after the write landed. A toast promising undo for a
          // drop that never reached the database would be undoing nothing.
          setDropped({ card, previousStatus: card.status });
        }
        setPending(null);
        flow.respond(kind);
      } catch (e: unknown) {
        // Online-only (ADR-0012): a clear message and a retry, with the answer
        // held so retrying costs one tap. Every write here is idempotent, so a
        // retry after a half-failed "do now" is safe.
        setPending({ card, kind });
        setFailure(e instanceof Error ? e.message : 'Could not save that.');
      } finally {
        setWriting(false);
      }
    },
    [flow],
  );

  /**
   * Take back the drop. Restores the row first and only then clears the
   * answer — if the write fails, the flow's record must still agree with the
   * database, or the escape-hatch list will say "Not answered" about an action
   * that is still dropped.
   */
  const undoDrop = useCallback(async () => {
    if (dropped === null) return;
    setUndoError(null);
    try {
      await restoreAction(dropped.card.id, dropped.previousStatus);
      flow.clearAnswer(dropped.card.id);
      setDropped(null);
    } catch (e: unknown) {
      setUndoError(
        e instanceof Error ? e.message : 'Could not undo that. Still dropped.',
      );
    }
  }, [dropped, flow]);

  /* ---------- WRITING ---------- */
  if (writing) {
    return (
      <View
        className="flex-1 items-center justify-center bg-base p-4"
        accessibilityRole="progressbar"
        accessibilityLabel="Saving"
        accessibilityState={{ busy: true }}
      >
        <Text className="text-base text-muted">Saving…</Text>
      </View>
    );
  }

  /* ---------- A WRITE FAILED ---------- */
  if (failure !== null && pending !== null) {
    return (
      <View className="flex-1 justify-center gap-4 bg-base p-4">
        <Text
          accessibilityRole="header"
          className="text-xl font-semibold text-state-error"
        >
          Could not save that
        </Text>
        <Text className="text-base leading-relaxed text-muted">{failure}</Text>
        <StandaloneButton
          label="Try again"
          hint="Attempts the same change again"
          emphasis="primary"
          onPress={() => void answer(pending.card, pending.kind)}
        />
        <StandaloneButton
          label="Leave it for later"
          hint="Moves on without changing this action"
          onPress={() => {
            setFailure(null);
            setPending(null);
            flow.skip();
          }}
        />
      </View>
    );
  }

  /* ---------- ESCAPE HATCH ---------- */
  if (showingAll) {
    return (
      <EscapeHatchList
        items={queue.cards.map((c) => ({
          id: c.id,
          title: c.title,
          // `?? undefined` rather than `?? ''`: an action with no due date has
          // nothing to say here, and the separator logic drops the slot
          // entirely rather than leaving a stranded middle dot.
          meta: dueLabel(c, new Date()) ?? undefined,
        }))}
        answers={flow.answers}
        onSelect={(index) => {
          // Choosing a hidden overdue card from the list IS asking for it, so
          // the "+N more" gate has done its job and stops standing in the way.
          if (
            index >= queue.visibleOverdueCount &&
            index < queue.firstDueTodayIndex
          ) {
            setExpanded(true);
          }
          flow.goTo(index);
          setShowingAll(false);
        }}
        onClose={() => setShowingAll(false)}
      />
    );
  }

  /* ---------- CLEARED — a real screen, not an empty list (§5.4) ---------- */
  if (flow.isComplete) {
    const untouched = flow.total - flow.answeredCount;
    return (
      <View className="flex-1 justify-center gap-2 bg-base p-4">
        <Text
          accessibilityRole="header"
          className="text-2xl font-semibold leading-snug text-state-success-text"
        >
          {queue.cards.length === 0 ? 'Nothing needs you today.' : 'You are clear.'}
        </Text>
        {/*
          Honest about what was left, and flat about it — no count climbing in
          red, no invitation to feel behind. Nothing is backfilled to keep the
          sequence going: the flow ends, which is the point of it ending.
        */}
        <Text className="text-base leading-relaxed text-muted">
          {queue.cards.length === 0
            ? 'Nothing overdue and nothing due. Capture something if it helps.'
            : untouched > 0
              ? 'What you passed over will be here tomorrow, unchanged.'
              : 'That is everything that was due. The rest of the day is yours.'}
        </Text>
        {/*
          Two ways on, both of them real. "Capture something" is the design's
          answer to what a cleared day is FOR; "Show all" keeps the escape
          hatch reachable from the last screen of the sequence as well as from
          every screen inside it (§5.1).
        */}
        <View className="flex-row gap-2 pt-6">
          {/* Wrapped rather than giving the button `flex-1` itself: the same
              component is used in a COLUMN on the failure screen, where that
              would stretch it down the page. */}
          <View className="flex-1">
            <StandaloneButton
              label="Capture something"
              hint="Opens the capture flow to add something new"
              emphasis="primary"
              onPress={onDone}
            />
          </View>
          <View className="flex-1">
            <StandaloneButton
              label="Show all"
              hint="Shows every action from today as a list you can scan"
              onPress={() => setShowingAll(true)}
            />
          </View>
        </View>
      </View>
    );
  }

  const index = flow.position - 1;

  /* ---------- "+N MORE" — the cap's affordance (ADR-0009 mitigation 1) ------ */
  const gated =
    !expanded &&
    index >= queue.visibleOverdueCount &&
    index < queue.firstDueTodayIndex;

  if (gated) {
    return (
      <FlowScreen
        position={flow.position}
        total={flow.total}
        canGoBack={queue.visibleOverdueCount > 0}
        // Back jumps the whole hidden block rather than reversing into it one
        // card at a time — the block is one screen forwards, so it is one
        // screen backwards.
        onBack={() => flow.goTo(queue.visibleOverdueCount - 1)}
        onShowAll={() => setShowingAll(true)}
        title={`${queue.overdueHidden} more overdue`}
        context="They are here whenever you want them. They do not have to be today."
        primary={{
          label: 'Show them',
          hint: 'Continues through the remaining overdue actions',
          onPress: () => setExpanded(true),
        }}
        secondary={{
          label: 'Not now',
          hint: 'Skips the rest of the overdue list and moves on to what is due today',
          onPress: () => flow.goTo(queue.firstDueTodayIndex),
        }}
      />
    );
  }

  /* ---------- THE CARD ---------- */
  const card = queue.cards[index];
  if (card === undefined) return null;

  const started = card.status === 'doing';

  return (
    <View className="flex-1">
      <FlowScreen
        position={flow.position}
        total={flow.total}
        canGoBack={flow.canGoBack}
        onBack={flow.back}
        onShowAll={() => setShowingAll(true)}
        title={card.title}
        context={cardContext(card, new Date())}
        /*
          Three slots, always the same three, in the same order — a person
          should be able to hit "later" without reading, three mornings in
          (§5.2). Only the primary's WORD changes: once an action is in
          progress, the thing you do with it is finish it.
        */
        primary={{
          label: started ? 'Done' : 'Do now',
          hint: started
            ? 'Marks this action complete'
            : card.doNowUrl !== null
              ? 'Opens the link for this action and marks it in progress'
              : 'Marks this action in progress',
          onPress: () => void answer(card, started ? 'done' : 'do-now'),
        }}
        secondary={{
          label: 'Later',
          hint: 'Moves on without changing anything. It will be here tomorrow',
          onPress: () => void answer(card, 'later'),
        }}
        tertiary={{
          label: 'Drop',
          hint: 'Decides this will not happen and removes it from today',
          onPress: () => void answer(card, 'drop'),
        }}
      />

      {/*
        Drop is the only destructive answer in the flow, and it is one tap away
        from "Later" in a fixed row built for muscle memory. That combination
        is exactly why it needs taking back (ADR-0011).
      */}
      {dropped !== null && (
        <UndoToast
          message={
            undoError ?? `Dropped “${dropped.card.title}” from today.`
          }
          actionLabel={undoError !== null ? 'Try again' : 'Undo'}
          actionHint={
            undoError !== null
              ? 'Attempts to restore this action again'
              : 'Puts this action back on today, exactly as it was'
          }
          onAction={() => void undoDrop()}
        />
      )}
    </View>
  );
}

/** An action outside the fixed row — same 48pt floor, same labelling rules. */
function StandaloneButton({
  label,
  hint,
  onPress,
  emphasis = 'secondary',
}: {
  readonly label: string;
  readonly hint: string;
  readonly onPress: () => void;
  readonly emphasis?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      hitSlop={TARGET['hit-slop-default']}
      style={{ minHeight: TARGET['tap-target-min'] }}
      className={[
        'justify-center rounded-md px-4',
        emphasis === 'primary'
          ? 'bg-accent-primary'
          : 'border-thin border-meaningful bg-surface',
      ].join(' ')}
    >
      <Text
        className={[
          'text-center text-base font-semibold',
          emphasis === 'primary' ? 'text-on-warm' : 'text-primary',
        ].join(' ')}
      >
        {label}
      </Text>
    </Pressable>
  );
}
