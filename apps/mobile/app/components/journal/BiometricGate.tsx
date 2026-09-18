import * as LocalAuthentication from 'expo-local-authentication';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LAYER, TARGET } from '@life-os/tokens';

/**
 * The biometric gate — CLAUDE.md rule 6, BUILD-SPEC §8.
 *
 * The journal is the ONLY gated surface. The app itself opens freely so the
 * 6am one-tap loop stays instant; putting this in front of everything would
 * trade the product's core promise for a lock on four screens.
 *
 * Two properties do the actual work, and both are easy to lose in a refactor:
 *
 *   1. `z-gate` (900) — above every other layer, always.
 *   2. THE UNLOCK DOES NOT SURVIVE BACKGROUNDING. Handing someone an unlocked
 *      phone is the threat this defends against, and a gate that stays open
 *      until the process dies defends against nothing.
 *
 * Children are not mounted while locked, so nothing behind the gate is rendered
 * or held in a view that a screenshot or the app switcher could capture.
 */
type GateState =
  | 'checking'
  | 'locked'
  | 'authenticating'
  | 'unlocked'
  /** No biometric hardware, or nothing enrolled. Stated plainly, never faked. */
  | 'unavailable';

export function BiometricGate({
  children,
  onDismiss,
}: {
  readonly children: ReactNode;
  /** "Not now" — leaves without unlocking. */
  readonly onDismiss: () => void;
}) {
  const [state, setState] = useState<GateState>('checking');
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (!active) return;
      setState(hasHardware && isEnrolled ? 'locked' : 'unavailable');
    })();
    return () => {
      active = false;
    };
  }, []);

  /*
    RE-LOCK ON BACKGROUND. Rule 6: "Gate state must NOT persist across
    backgrounding — re-authenticate on return."

    Only 'background', deliberately — NOT 'inactive'. iOS reports 'inactive'
    while the Face ID sheet is on screen, so relocking on it would tear down
    the gate's own prompt and leave the user tapping Unlock forever.
  */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        setState((s) => (s === 'unlocked' ? 'locked' : s));
        setFailure(null);
      }
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(async () => {
    setState('authenticating');
    setFailure(null);
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock your journal',
      // The device passcode is a legitimate second factor and the OS already
      // rate-limits it. Refusing the fallback would lock the owner out of their
      // own journal the first time a wet thumb fails twice.
      disableDeviceFallback: false,
      cancelLabel: 'Not now',
    });

    if (result.success) {
      setState('unlocked');
      return;
    }

    setState('locked');
    // A cancel is a choice, not a failure, and saying "authentication failed"
    // at someone who tapped cancel is the app misreading them (4.5 §6.1).
    if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
      setFailure('That did not match. Try again, or use your passcode.');
    }
  }, []);

  if (state === 'unlocked') return <>{children}</>;

  return (
    <SafeAreaView
      /*
        z-gate, from the token module. A raw 900 here would be exactly the kind
        of number two components can quietly disagree about (4.7 §10.2).
      */
      style={{ zIndex: LAYER['z-gate'] }}
      className="flex-1 justify-center gap-3 bg-ceremonial p-6"
      accessibilityViewIsModal
    >
      <Text className="text-xs uppercase tracking-caps text-on-cool">
        Gated route
      </Text>

      {state === 'checking' && (
        <Text
          accessibilityRole="header"
          className="text-2xl font-semibold leading-snug text-on-cool"
        >
          Checking this device…
        </Text>
      )}

      {state === 'unavailable' && (
        <>
          <Text
            accessibilityRole="header"
            className="text-2xl font-semibold leading-snug text-on-cool"
          >
            This device has no lock set
          </Text>
          {/*
            Said plainly rather than dressed up. There is no biometric or
            passcode enrolled, so there is nothing for the gate to check — and
            pretending otherwise would be the app claiming a protection it is
            not providing.
          */}
          <Text className="text-base leading-relaxed text-on-cool">
            The journal gate needs a fingerprint, a face, or a passcode enrolled
            in your phone&rsquo;s settings. Until one is, anyone holding this
            phone can read the journal.
          </Text>
          <View className="flex-row gap-2 pt-4">
            <GateButton
              label="Open anyway"
              hint="Opens the journal without a device check"
              emphasis="primary"
              onPress={() => setState('unlocked')}
            />
            <GateButton
              label="Not now"
              hint="Leaves the journal without opening it"
              onPress={onDismiss}
            />
          </View>
        </>
      )}

      {(state === 'locked' || state === 'authenticating') && (
        <>
          <Text
            accessibilityRole="header"
            className="text-2xl font-semibold leading-snug text-on-cool"
          >
            The journal is locked
          </Text>
          <Text className="text-base leading-relaxed text-on-cool">
            It asks every time you come back. Nothing here is cached behind the
            gate — not the text, not the dates.
          </Text>
          {failure !== null && (
            <Text className="text-base leading-relaxed text-on-cool">
              {failure}
            </Text>
          )}
          <View className="flex-row gap-2 pt-4">
            <GateButton
              label={state === 'authenticating' ? 'Checking…' : 'Unlock'}
              hint="Asks your phone to confirm it is you, then opens the journal"
              emphasis="primary"
              disabled={state === 'authenticating'}
              onPress={() => void unlock()}
            />
            <GateButton
              label="Not now"
              hint="Leaves the journal locked and goes back to today"
              onPress={onDismiss}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

/**
 * The gate's own button. It cannot reuse `FlowAction`: that one is built for
 * the base ground, and its secondary style (surface fill, platinum edge) is
 * invisible on amethyst. Same 48pt floor, same labelling rules.
 */
function GateButton({
  label,
  hint,
  onPress,
  emphasis = 'secondary',
  disabled = false,
}: {
  readonly label: string;
  readonly hint: string;
  readonly onPress: () => void;
  readonly emphasis?: 'primary' | 'secondary';
  readonly disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      hitSlop={TARGET['hit-slop-default']}
      style={{ minHeight: TARGET['tap-target-min'], flex: 1 }}
      className={[
        'justify-center rounded-md px-4 py-3',
        emphasis === 'primary'
          ? 'bg-accent-primary'
          : 'border-thin border-meaningful',
        disabled ? 'opacity-disabled' : '',
      ].join(' ')}
    >
      <Text
        className={[
          'text-center text-base font-semibold',
          emphasis === 'primary' ? 'text-on-warm' : 'text-on-cool',
        ].join(' ')}
      >
        {label}
      </Text>
    </Pressable>
  );
}
