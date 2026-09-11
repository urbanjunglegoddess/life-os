import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { COLOR, RADIUS, SPACE, TARGET } from '@life-os/tokens';

import { createAction } from '../../lib/actions.ts';
import { listAreas, type Area } from '../../lib/areas.ts';
import { resolveWhen, type WhenChoice } from '../../lib/captureInput.ts';
import { FlowScreen } from '../flow/FlowScreen.tsx';

/**
 * The capture flow — BUILD-SPEC §5.5.
 *
 * Blank-page paralysis is the thing being designed against, so it ASKS rather
 * than presenting a form. Title → area → when, and every step after the first
 * is skippable with a visible default. A capture that only ever gets a title is
 * a SUCCESSFUL capture, not a partial one.
 */
type Stage = 'title' | 'area' | 'when' | 'saving' | 'saved' | 'error';

const inputStyle = {
  minHeight: TARGET['tap-target-min'],
  borderWidth: 1,
  borderColor: COLOR['border-meaningful'],
  borderRadius: RADIUS['radius-md'],
  paddingHorizontal: SPACE['space-4'],
  paddingVertical: SPACE['space-3'],
  color: COLOR['text-primary'],
  fontSize: 16,
} as const;

export function CaptureFlow({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState<Stage>('title');
  const [title, setTitle] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [areas, setAreas] = useState<readonly Area[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Loaded during the title step so the area list is ready when it is reached —
  // a spinner between two questions reads as the app stalling.
  useEffect(() => {
    let active = true;
    listAreas()
      .then((a) => active && setAreas(a))
      .catch(() => active && setAreas([]));
    return () => {
      active = false;
    };
  }, []);

  async function save(when: WhenChoice) {
    setStage('saving');
    setError(null);
    try {
      await createAction({
        title,
        areaId,
        dueAt: resolveWhen(when, new Date()),
      });
      setStage('saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that.');
      setStage('error');
    }
  }

  const position = stage === 'title' ? 1 : stage === 'area' ? 2 : 3;

  /* ---------- SAVING ---------- */
  if (stage === 'saving') {
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

  /* ---------- SAVED — the cleared state ---------- */
  if (stage === 'saved') {
    return (
      <View className="flex-1 justify-center gap-2 bg-base p-4">
        <Text
          accessibilityRole="header"
          className="text-2xl font-semibold leading-snug text-state-success-text"
        >
          Captured
        </Text>
        <Text className="text-base leading-relaxed text-muted">{title}</Text>
        <View className="pt-6">
          <FlowButton label="Done" hint="Returns to the home screen" onPress={onDone} />
        </View>
      </View>
    );
  }

  /* ---------- ERROR ---------- */
  if (stage === 'error') {
    return (
      <View className="flex-1 justify-center gap-4 bg-base p-4">
        <Text
          accessibilityRole="header"
          className="text-xl font-semibold text-state-error"
        >
          Could not save that capture
        </Text>
        <Text className="text-base leading-relaxed text-muted">
          {error ?? 'Something went wrong.'}
        </Text>
        {/*
          Online-only (ADR-0012): the write needed a connection. Nothing typed is
          thrown away — the title is still held, so retrying costs one tap rather
          than retyping the thought that prompted the capture.
        */}
        <FlowButton
          label="Try again"
          hint="Attempts the save again with what you already entered"
          onPress={() => void save('someday')}
          emphasis="primary"
        />
        <FlowButton label="Back to home" hint="Leaves without saving" onPress={onDone} />
      </View>
    );
  }

  /* ---------- THE QUESTIONS ---------- */
  return (
    <FlowScreen
      position={position}
      total={3}
      canGoBack={stage !== 'title'}
      onBack={() => setStage(stage === 'when' ? 'area' : 'title')}
      onShowAll={() => {}}
      title={
        stage === 'title'
          ? 'What is it?'
          : stage === 'area'
            ? 'Which area?'
            : 'When?'
      }
      context={
        stage === 'title'
          ? 'One line is enough. You can add the rest later.'
          : stage === 'area'
            ? 'Skip if it does not belong anywhere yet.'
            : 'Skip if it has no deadline.'
      }
      primary={
        stage === 'title'
          ? {
              label: 'Next',
              hint: 'Moves on to choosing an area',
              onPress: () => setStage('area'),
              disabled: title.trim() === '',
            }
          : stage === 'area'
            ? {
                label: 'Skip',
                hint: 'Leaves this capture unfiled and moves on',
                onPress: () => {
                  setAreaId(null);
                  setStage('when');
                },
              }
            : {
                label: 'Today',
                hint: 'Saves this capture as due by the end of today',
                onPress: () => void save('today'),
              }
      }
      secondary={
        stage === 'when'
          ? {
              label: 'Tomorrow',
              hint: 'Saves this capture as due by the end of tomorrow',
              onPress: () => void save('tomorrow'),
            }
          : undefined
      }
      tertiary={
        stage === 'when'
          ? {
              label: 'Someday',
              hint: 'Saves this capture with no deadline',
              onPress: () => void save('someday'),
            }
          : undefined
      }
    >
      {stage === 'title' && (
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Call the accountant"
          placeholderTextColor={COLOR['text-muted']}
          autoFocus
          multiline
          accessibilityLabel="What is it?"
          style={inputStyle}
        />
      )}

      {stage === 'area' && (
        <View className="gap-2">
          {areas === null && <Text className="text-sm text-muted">Loading areas…</Text>}
          {areas?.length === 0 && (
            <Text className="text-sm text-muted">
              No areas yet — this capture will be unfiled.
            </Text>
          )}
          {areas?.map((area) => (
            <Pressable
              key={area.id}
              onPress={() => {
                setAreaId(area.id);
                setStage('when');
              }}
              accessibilityRole="button"
              accessibilityLabel={area.name}
              accessibilityHint="Files this capture under this area and moves on"
              style={{ minHeight: TARGET['tap-target-min'] }}
              className="justify-center rounded-lg border-thin border-decorative bg-surface px-4"
            >
              <Text className="text-base text-primary">{area.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </FlowScreen>
  );
}

/** A standalone action outside the fixed row — same target floor and labelling. */
function FlowButton({
  label,
  hint,
  onPress,
  emphasis = 'secondary',
}: {
  label: string;
  hint: string;
  onPress: () => void;
  emphasis?: 'primary' | 'secondary';
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
