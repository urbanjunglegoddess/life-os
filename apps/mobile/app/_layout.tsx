// Tailwind's output. Must be imported once, at the root, before any styled node.
import '../global.css';

import { COLOR } from '@life-os/tokens';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { startSessionAutoRefresh } from '../lib/supabase';

export default function RootLayout() {
  // Token refresh is driven off app foreground/background rather than a bare
  // timer, which a backgrounded RN app does not reliably service. Mounted once,
  // at the root, so there is exactly one subscription for the app's lifetime.
  useEffect(() => startSessionAutoRefresh(), []);

  return (
    <SafeAreaProvider>
      {/*
        Navigator chrome takes style objects rather than class names, so it reads
        the typed constants directly — the escape hatch 4.7 §11 allows for
        "where a class will not do". It is still the semantic tier; a hex here
        would be just as much a defect as one in a component.
      */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLOR['bg-base'] },
        }}
      />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
