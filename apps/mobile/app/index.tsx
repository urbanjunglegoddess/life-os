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
          <Text className="text-sm text-muted">Slice one · capture</Text>
        </View>

        {auth === 'checking' && <Text className="text-sm text-muted">Checking…</Text>}

        {auth === 'error' && (
          <View className="gap-2 rounded-lg border-thin border-decorative bg-surface p-4">
            <Text className="text-base text-state-error">Could not reach Supabase</Text>
            <Text className="text-sm text-muted">{detail ?? 'Unknown error.'}</Text>
          </View>
        )}

        {auth === 'signed-out' && (
          <View className="gap-4">
            <Text className="text-base leading-relaxed text-muted">
              Sign in to start capturing.
            </Text>
            <HomeButton
              label="Sign in"
              hint="Opens the email sign-in flow"
              onPress={() => router.push('/sign-in')}
              emphasis="primary"
            />
          </View>
        )}

        {auth === 'signed-in' && (
          <View className="gap-4">
            {/*
              The whole point of the app at this stage: one tap from open to a
              captured thought. Everything else on this screen gives way to it.
            */}
            <HomeButton
              label="Capture"
              hint="Opens the capture flow to add something new"
              onPress={() => router.push('/capture')}
              emphasis="primary"
            />
            <HomeButton
              label="Sign out"
              hint="Ends this session on the device"
              onPress={() => void signOut()}
            />
          </View>
        )}

        <View className="grow" />
        <Text className="text-sm text-muted">
          Next: the Today flow, against actions_today.
        </Text>
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
