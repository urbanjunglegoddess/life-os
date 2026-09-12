import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BiometricGate } from '../../components/journal/BiometricGate.tsx';
import { JournalFlow } from '../../components/journal/JournalFlow.tsx';

export default function JournalRoute() {
  /*
    Bumped on every focus so the gate REMOUNTS, dropping straight back to
    locked. Rule 6 only demands this across backgrounding, which the gate
    handles itself; re-locking on tab blur as well costs one biometric tap and
    closes the far more ordinary case — the phone handed over unlocked with the
    app already open. "It asks every time you come back" is then literally true
    rather than true of one code path.
  */
  const [visit, setVisit] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setVisit((n) => n + 1);
    }, []),
  );

  /*
    The gate carries its own safe area, not this route's. It is full-bleed
    amethyst by design, and a `bg-base` inset above it would read as a bar
    across the top of the locked screen.
  */
  return (
    <BiometricGate key={visit} onDismiss={() => router.replace('/today')}>
      <SafeAreaView className="flex-1 bg-base">
        <JournalFlow onDone={() => router.replace('/today')} />
      </SafeAreaView>
    </BiometricGate>
  );
}
