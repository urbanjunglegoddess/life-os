import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getSession, onAuthStateChange } from '../lib/auth';

/**
 * The shell. It exists to prove two things end to end: a route renders through
 * the token module, and the Supabase client reaches the project and reports a
 * real session state.
 *
 * It is deliberately not a stand-in for the Today flow, and the sign-in path is
 * deliberately absent. BUILD-SPEC §7 puts the reusable flow primitive (§5.2,
 * §5.3) BEFORE any screen that uses it, and email OTP is a two-question
 * sequence — it is that primitive's first real caller, not a form to hand-roll
 * here and rewrite later.
 */
type AuthState = 'checking' | 'signed-in' | 'signed-out' | 'error';

export default function Shell() {
  const [auth, setAuth] = useState<AuthState>('checking');
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getSession()
      .then((session) => {
        if (active) setAuth(session ? 'signed-in' : 'signed-out');
      })
      .catch((e: unknown) => {
        // Never swallow a failure silently (CLAUDE.md — Error handling).
        if (!active) return;
        setAuth('error');
        setDetail(e instanceof Error ? e.message : String(e));
      });

    const unsubscribe = onAuthStateChange((session) => {
      setAuth(session ? 'signed-in' : 'signed-out');
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-base">
      <View className="flex-1 gap-6 p-4">
        <View className="gap-1">
          <Text className="text-2xl font-semibold text-primary">Life OS</Text>
          <Text className="text-sm text-muted">Slice one · app shell</Text>
        </View>

        <View className="gap-2 rounded-lg border-thin border-decorative bg-surface p-4">
          <Text className="text-base text-primary">Wired</Text>
          <Text className="text-sm text-muted">
            Expo Router · NativeWind · @life-os/tokens · Supabase
          </Text>
        </View>

        <View className="gap-2 rounded-lg border-thin border-decorative bg-surface p-4">
          <Text className="text-base text-primary">Session</Text>
          {auth === 'checking' && (
            <Text className="text-sm text-muted">Checking…</Text>
          )}
          {auth === 'signed-in' && (
            <Text className="text-sm text-state-success-text">Signed in</Text>
          )}
          {auth === 'signed-out' && (
            <Text className="text-sm text-muted">
              Signed out — no sign-in path until the flow primitive exists.
            </Text>
          )}
          {auth === 'error' && (
            <Text className="text-sm text-state-error">
              {detail ?? 'Could not reach Supabase.'}
            </Text>
          )}
        </View>

        <Text className="text-sm text-muted">
          Next: the flow primitive, then email OTP as its first caller.
        </Text>
      </View>
    </SafeAreaView>
  );
}
