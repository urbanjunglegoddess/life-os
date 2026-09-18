import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { COLOR, RADIUS, SPACE, TARGET } from '@life-os/tokens';

import {
  getEntryForDay,
  listJournalPrompts,
  recordJournalResponse,
  type JournalPrompt,
} from '../../lib/journal.ts';
import { localDay } from '../../lib/localDay.ts';
import { EscapeHatchList } from '../flow/EscapeHatchList.tsx';
import { Flow } from '../flow/Flow.tsx';
import { FlowAction } from '../flow/FlowAction.tsx';
import { FlowScreen } from '../flow/FlowScreen.tsx';
import { useFlow } from '../flow/useFlow.ts';

/**
 * The journal flow — BUILD-SPEC §5.6, build order step 8.
 *
 * One prompt per screen, all skippable, and AN ENTRY WITH ONE ANSWERED PROMPT
 * IS A COMPLETE ENTRY. That last rule is why nothing here counts unanswered
 * prompts at the user, and why the cleared screen congratulates a single line
 * as readily as three.
 *
 * Each answer is written as it is saved rather than batched at the end. A
 * journal that loses two prompts because the third failed would teach people
 * not to trust it, and the merge is one round trip either way (rule 2 puts it
 * in `record_journal_response`).
 */
const inputStyle = {
  minHeight: TARGET['tap-target-min'] * 2.5,
  borderWidth: 1,
  borderColor: COLOR['border-meaningful'],
  borderRadius: RADIUS['radius-md'],
  paddingHorizontal: SPACE['space-4'],
  paddingVertical: SPACE['space-3'],
  color: COLOR['text-primary'],
  fontSize: 16,
  textAlignVertical: 'top',
} as const;

interface Loaded {
  readonly prompts: readonly JournalPrompt[];
  readonly drafts: Readonly<Record<string, string>>;
}

export function JournalFlow({ onDone }: { onDone: () => void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Read once per mount so every prompt in one sitting files under the same
  // day, even for someone still writing at midnight.
  const day = useMemo(() => localDay(new Date()), [attempt]);

  useEffect(() => {
    let active = true;
    setLoaded(null);
    setError(null);

    Promise.all([listJournalPrompts(), getEntryForDay(day)])
      .then(([prompts, entry]) => {
        if (!active) return;
        // Today's entry may already hold answers — coming back to add a second
        // line must show the first, not silently overwrite it.
        setLoaded({ prompts, drafts: entry?.responses ?? {} });
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Could not open the journal.');
      });

    return () => {
      active = false;
    };
  }, [day, attempt]);

  if (error !== null) {
    return (
      <Flow
        steps={[]}
        status="error"
        errorMessage={error}
        onRetry={() => setAttempt((n) => n + 1)}
        cleared={{ title: 'Nothing to write today.' }}
      />
    );
  }

  if (loaded === null) {
    return <Flow steps={[]} status="loading" cleared={{ title: 'Loading' }} />;
  }

  /* Keyed on the attempt so a retry mounts a fresh flow rather than landing on
     the previous sequence's index (same reason as TodayFlow). */
  return (
    <JournalPromptFlow
      key={attempt}
      day={day}
      prompts={loaded.prompts}
      initialDrafts={loaded.drafts}
      onDone={onDone}
    />
  );
}

function JournalPromptFlow({
  day,
  prompts,
  initialDrafts,
  onDone,
}: {
  readonly day: string;
  readonly prompts: readonly JournalPrompt[];
  readonly initialDrafts: Readonly<Record<string, string>>;
  readonly onDone: () => void;
}) {
  const flow = useFlow(prompts.map((p) => p.slug));
  const [drafts, setDrafts] = useState<Record<string, string>>({
    ...initialDrafts,
  });
  const [showingAll, setShowingAll] = useState(false);
  const [writing, setWriting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  /** Whether anything at all was written this sitting or earlier today. */
  const [savedAny, setSavedAny] = useState(
    Object.values(initialDrafts).some((v) => v.trim() !== ''),
  );

  const save = useCallback(
    async (prompt: JournalPrompt) => {
      const text = (drafts[prompt.slug] ?? '').trim();
      // An empty box saved is a skip, not an entry. Writing '' would set
      // `answered_count` computing over a blank key for no gain.
      if (text === '') {
        flow.skip();
        return;
      }

      setWriting(true);
      setFailure(null);
      try {
        await recordJournalResponse(day, prompt.slug, text);
        setSavedAny(true);
        flow.respond('answered');
      } catch (e: unknown) {
        // Online-only (ADR-0012). What was typed is held in `drafts`, so a
        // retry costs one tap rather than rewriting the thought.
        setFailure(e instanceof Error ? e.message : 'Could not save that.');
      } finally {
        setWriting(false);
      }
    },
    [day, drafts, flow],
  );

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

  /* ---------- ESCAPE HATCH — not optional (§5.1) ---------- */
  if (showingAll) {
    return (
      <EscapeHatchList
        items={prompts.map((p) => ({ id: p.slug, title: p.prompt }))}
        answers={flow.answers}
        onSelect={(index) => {
          flow.goTo(index);
          setShowingAll(false);
        }}
        onClose={() => setShowingAll(false)}
      />
    );
  }

  /* ---------- CLEARED — a real screen (§5.4) ---------- */
  if (flow.isComplete) {
    return (
      <View className="flex-1 justify-center gap-2 bg-base p-4">
        <Text
          accessibilityRole="header"
          className="text-2xl font-semibold leading-snug text-state-success-text"
        >
          {prompts.length === 0
            ? 'No prompts yet.'
            : savedAny
              ? 'Entry saved'
              : 'Nothing written today'}
        </Text>
        {/*
          One answered prompt IS a complete entry, so a single line gets the
          same flat acknowledgement as three. Skipping every prompt is also a
          complete visit — there is no streak to break and nothing to make up.
        */}
        <Text className="text-base leading-relaxed text-muted">
          {prompts.length === 0
            ? 'The prompt set is empty for this account.'
            : savedAny
              ? 'That is a complete entry. The prompts you passed over are not owed.'
              : 'You looked and had nothing to say. That is a complete visit.'}
        </Text>
        <View className="flex-row pt-6">
          <FlowAction
            label="Done"
            hint="Closes the journal and returns to today"
            onPress={onDone}
          />
        </View>
      </View>
    );
  }

  const prompt = prompts[flow.position - 1];
  if (prompt === undefined) return null;

  const draft = drafts[prompt.slug] ?? '';

  return (
    <FlowScreen
      position={flow.position}
      total={flow.total}
      canGoBack={flow.canGoBack}
      onBack={flow.back}
      onShowAll={() => setShowingAll(true)}
      title={prompt.prompt}
      context={
        failure !== null
          ? failure
          : 'One answered prompt is a complete entry. Skip the rest.'
      }
      primary={{
        label: failure !== null ? 'Try again' : 'Save',
        hint:
          failure !== null
            ? 'Attempts the same save again with what you already wrote'
            : 'Saves this answer and moves on to the next prompt',
        onPress: () => void save(prompt),
        disabled: draft.trim() === '' && failure === null,
      }}
      secondary={{
        label: 'Skip',
        hint: 'Moves on without writing anything for this prompt',
        onPress: () => {
          setFailure(null);
          flow.skip();
        },
      }}
    >
      <TextInput
        value={draft}
        onChangeText={(text) =>
          setDrafts((d) => ({ ...d, [prompt.slug]: text }))
        }
        placeholderTextColor={COLOR['text-muted']}
        multiline
        accessibilityLabel={prompt.prompt}
        accessibilityHint="Your answer to this prompt. Leaving it empty skips it"
        style={inputStyle}
      />
    </FlowScreen>
  );
}
