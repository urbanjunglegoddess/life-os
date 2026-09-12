import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TARGET } from '@life-os/tokens';

import { getSession, onAuthStateChange } from '../lib/auth.ts';

/**
 * The entry gate — and nothing else.
 *
 * THERE IS NO HOME SCREEN, which is the Command Center design's actual claim:
 * a dashboard is a page you have to triage before you can act, and the 6am
 * loop cannot afford one. This route decides signed-in or signed-out and gets
 * out of the way; the tab bar is what the app opens to.
 *
 * It stays mounted only for as long as that check takes, so it renders no
 * navigation of its own. Sign-out lives in Settings, where a destructive
 * action belongs, rather than one tap from the thing you open at 6am.
 */
type AuthState = 'checking' | 'signed-in' | 'signed-out' | 'error';

export default function EntryGate() {
  const [auth, setAuth] = useState<AuthState>('checking');
  const [detail, setDetail] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setAuth('checking');

    getSession()
      .then((s) => active && setAuth(s ? 'signed-in' : 'signed-out'))
      .catch((e: unknown) => {
        if (!active) return;
        setAuth('error');
        setDetail(e instanceof Error ? e.message : String(e));
      });

    // Keeps the gate honest if the session ends while it is on screen — an
    // expired refresh here must land on sign-in, not on an empty Today.
    const unsubscribe = onAuthStateChange((s) =>
      setAuth(s ? 'signed-in' : 'signed-out'),
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [attempt]);

  if (auth === 'signed-in') return <Redirect href="/today" />;
  if (auth === 'signed-out') return <Redirect href="/sign-in" />;

  if (auth === 'error') {
    return (
      <SafeAreaView className="flex-1 bg-base">
        <View className="flex-1 justify-center gap-4 p-4">
          <Text
            accessibilityRole="header"
            className="text-xl font-semibold text-state-error"
          >
            Could not reach Supabase
          </Text>
          <Text className="text-base leading-relaxed text-muted">
            {detail ?? 'Unknown error.'}
          </Text>
          <Pressable
            onPress={() => setAttempt((n) => n + 1)}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            accessibilityHint="Checks for a saved session again"
            hitSlop={TARGET['hit-slop-default']}
            style={{ minHeight: TARGET['tap-target-min'] }}
            className="justify-center rounded-md bg-accent-primary px-4"
          >
            <Text className="text-center text-base font-semibold text-on-warm">
              Try again
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-base">
      <View
        className="flex-1 items-center justify-center p-4"
        accessibilityRole="progressbar"
        accessibilityLabel="Checking your session"
        accessibilityState={{ busy: true }}
      >
        <Text className="text-base text-muted">Checking…</Text>
      </View>
    </SafeAreaView>
  );
}
