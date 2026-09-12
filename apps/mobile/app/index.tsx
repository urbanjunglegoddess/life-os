import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TARGET } from '@life-os/tokens';

import { getSession, onAuthStateChange, signOut } from '../lib/auth.ts';

/**
 * Home. Still a shell — the Today flow is §7 step 6 and does not exist — but it
 * is now a real entry point rather than a status card: the one thing it offers
 * is the path into capture, which is the app's whole promise at this stage.
 */
type AuthState = 'checking' | 'signed-in' | 'signed-out' | 'error';

export default function Home() {
  const [auth, setAuth] = useState<AuthState>('checking');
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getSession()
      .then((s) => active && setAuth(s ? 'signed-in' : 'signed-out'))
      .catch((e: unknown) => {
        if (!active) return;
        setAuth('error');
        setDetail(e instanceof Error ? e.message : String(e));
      });

    const unsubscribe = onAuthStateChange((s) =>
      setAuth(s ? 'signed-in' : 'signed-out'),
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-base">
      <View className="flex-1 gap-6 p-4">
        <View className="gap-1">
          <Text
            accessibilityRole="header"
            className="text-2xl font-semibold text-primary"
          >
            Life OS
          </Text>
          <Text className="text-sm text-muted">Slice one · today &amp; capture</Text>
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
            {/*
              Today leads: §5.4 orders by consequence, and what breaks if
              skipped outranks what might be added. Capture sits under it, still
              one tap from open.
            */}
            <HomeButton
              label="Today"
              hint="Opens today's work, most consequential first"
              onPress={() => router.push('/today')}
              emphasis="primary"
            />
            <HomeButton
              label="Capture"
              hint="Opens the capture flow to add something new"
              onPress={() => router.push('/capture')}
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
          Next: the escape-hatch list, then the journal.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function HomeButton({
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
