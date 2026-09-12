import {
  BORDER_COLOR,
  BORDER_WIDTH,
  COLOR,
  FONT_SIZE,
  FONT_WEIGHT,
  SPACE,
  TARGET,
} from '@life-os/tokens';
import { Tabs } from 'expo-router';

/**
 * The tab bar — the persistent chrome every artboard in the Command Center
 * design carries.
 *
 * This replaces the button-list home screen, which is the design's actual
 * claim: THERE IS NO DASHBOARD. Opening the app puts you on Today, and Today is
 * a sequence rather than a page to triage. The tab bar exists so the other
 * three surfaces are one tap away from wherever the sequence has got to, not so
 * there is somewhere to land first.
 *
 * Order is load-bearing and matches §5.2's rule that position never moves:
 * Today (what the app is FOR at 6am) · Capture (what it is for the rest of the
 * day) · Journal (gated) · Settings (reference).
 *
 * Navigator chrome takes style objects rather than class names, so it reads the
 * typed constants directly — the escape hatch 4.7 §11 allows for "where a class
 * will not do". Still the semantic tier; a hex here would be as much a defect
 * as one in a component.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: COLOR['bg-base'] },
        tabBarStyle: {
          backgroundColor: COLOR['bg-surface'],
          borderTopColor: BORDER_COLOR['border-color-decorative'],
          borderTopWidth: BORDER_WIDTH['border-width-thin'],
          // The 48pt floor plus one spacing step above and below. Derived
          // rather than typed so the tap target cannot quietly shrink when the
          // bar is restyled (4.7 §10.3).
          height: TARGET['tap-target-min'] + SPACE['space-2'] * 2,
          paddingTop: SPACE['space-2'],
          paddingBottom: SPACE['space-2'],
        },
        tabBarActiveTintColor: COLOR['accent-primary'],
        tabBarInactiveTintColor: COLOR['text-muted'],
        // Labels only, no icons. An icon-plus-label tab would halve the space
        // the word has to grow into at the largest OS text scale, and the word
        // is the part a screen reader and a stranger both rely on (4.8 §6).
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: {
          fontSize: FONT_SIZE['font-size-sm'],
          fontWeight: FONT_WEIGHT['font-weight-semibold'],
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{ title: 'Today', tabBarAccessibilityLabel: 'Today' }}
      />
      <Tabs.Screen
        name="capture"
        options={{ title: 'Capture', tabBarAccessibilityLabel: 'Capture' }}
      />
      <Tabs.Screen
        name="journal"
        options={{ title: 'Journal', tabBarAccessibilityLabel: 'Journal' }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarAccessibilityLabel: 'Settings' }}
      />
    </Tabs>
  );
}
