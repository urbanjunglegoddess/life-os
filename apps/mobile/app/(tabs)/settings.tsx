import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TARGET } from '@life-os/tokens';

import { signOut } from '../../lib/auth.ts';
import { listEntities, type Entity } from '../../lib/entities.ts';
import { ENV } from '../../lib/env.ts';
import { getProfile, type AccountProfile } from '../../lib/profile.ts';

/**
 * Settings — the Command Center design's 1f.
 *
 * Reference, not a decision queue, so it is a scannable list rather than a
 * sequence (IA §7.4). The one-question-one-screen model governs DECIDING;
 * reading what your account is does not need to arrive one fact at a time.
 *
 * Everything on this screen is either real data or plainly labelled as not
 * built. There are no controls that appear to do something and do not — which
 * is why the entity list does not pretend to be a switcher and the deletion
 * panel does not carry a Delete button.
 */
export default function SettingsRoute() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [entities, setEntities] = useState<readonly Entity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError(null);

    Promise.all([getProfile(), listEntities()])
      .then(([p, e]) => {
        if (!active) return;
        setProfile(p);
        setEntities(e);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load settings.');
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  const web = ENV.EXPO_PUBLIC_WEB_URL;

  return (
    <SafeAreaView className="flex-1 bg-base">
      <ScrollView contentContainerClassName="gap-8 p-4 pb-16">
        {/* ---------- WHO ---------- */}
        <View className="gap-1">
          <Text className="text-xs uppercase tracking-caps text-muted">
            Settings
          </Text>
          <Text
            accessibilityRole="header"
            className="text-2xl font-semibold leading-snug text-primary"
          >
            {profile?.displayName ?? 'Your account'}
          </Text>
          <Text className="text-sm text-muted">
            {profile?.email ?? 'Loading…'}
          </Text>
        </View>

        {error !== null && (
          <Section title="Could not load settings">
            <Text className="text-base leading-relaxed text-state-error">
              {error}
            </Text>
            <SettingsButton
              label="Try again"
              hint="Reloads your profile and entities"
              emphasis="primary"
              onPress={() => setAttempt((n) => n + 1)}
            />
          </Section>
        )}

        {/* ---------- ENTITIES ---------- */}
        <Section title="Entities">
          {entities === null && !error && (
            <Text className="text-sm text-muted">Loading…</Text>
          )}
          {entities?.map((entity) => (
            <Row key={entity.id} label={entity.name} />
          ))}
          {/*
            Read-only, and said so. Nothing in slice one filters by entity, so a
            selectable chip here would be a control with no effect — worse than
            no control, because it teaches that taps do not land.
          */}
          {entities !== null && entities.length > 0 && (
            <Text className="text-sm leading-relaxed text-muted">
              Actions carry an entity, but nothing filters by one yet. This is
              the list, not a switcher.
            </Text>
          )}
        </Section>

        {/* ---------- THE GATE ---------- */}
        <Section title="Journal gate">
          <View className="gap-1 rounded-lg border-thin border-decorative bg-surface p-4">
            <Text className="text-base text-primary">
              Face ID, fingerprint or passcode
            </Text>
            {/*
              Rendered as a STATUS, not a toggle. Rule 6 makes the gate
              unconditional for the beta, and drawing a switch that cannot move
              — or one that can, in defiance of the rule — would misdescribe the
              product either way.
            */}
            <Text className="text-sm leading-relaxed text-muted">
              Always on. The journal re-asks every time you come back to it, and
              that is not adjustable in the beta.
            </Text>
          </View>
        </Section>

        {/* ---------- LEGAL ---------- */}
        <Section title="Legal">
          <WebLink base={web} path="/privacy" label="Privacy policy" />
          <WebLink base={web} path="/terms" label="Terms of service" />
        </Section>

        {/* ---------- DELETION ---------- */}
        <Section title="Delete account" tone="error">
          <Text className="text-base leading-relaxed text-muted">
            This is a hard delete, not a deactivation. It removes your actions,
            journal entries, finance rows, household and children&rsquo;s
            records, uploaded files, and your sign-in — everywhere, at once. It
            cannot be undone and there is no export afterward.
          </Text>
          {/*
            No Delete button, deliberately. The cascading delete across every
            table, Storage and the auth user is its own build slice and is not
            written yet; a button that looked like it deleted an account and did
            not would be a compliance failure rather than a defect (§9). The web
            route is the request channel until that slice lands.
          */}
          <Text className="text-base leading-relaxed text-muted">
            The deletion itself is not built yet. Requests go through the web,
            without opening the app:
          </Text>
          <WebLink base={web} path="/delete-account" label="Request deletion" />
        </Section>

        {/* ---------- SESSION ---------- */}
        <Section title="Session">
          <SettingsButton
            label="Sign out"
            hint="Ends this session on the device and returns to sign-in"
            onPress={() => {
              void signOut().then(() => router.replace('/'));
            }}
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  tone = 'default',
  children,
}: {
  readonly title: string;
  readonly tone?: 'default' | 'error';
  readonly children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text
        accessibilityRole="header"
        className={[
          'text-xs uppercase tracking-caps',
          tone === 'error' ? 'text-state-error' : 'text-muted',
        ].join(' ')}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({ label }: { readonly label: string }) {
  return (
    <View
      className="justify-center rounded-lg border-thin border-decorative bg-surface px-4 py-3"
      style={{ minHeight: TARGET['tap-target-min'] }}
    >
      <Text className="text-base text-primary">{label}</Text>
    </View>
  );
}

/**
 * A link to the compliance site — or, until one is deployed, the path it will
 * live at.
 *
 * No domain has been chosen and `apps/web` is not live, so there is nothing
 * honest to link to yet. Rendering a dead link styled as a working one is the
 * failure this avoids: the store reviewer who taps it is the person the page
 * exists for.
 */
function WebLink({
  base,
  path,
  label,
}: {
  readonly base: string | undefined;
  readonly path: string;
  readonly label: string;
}) {
  if (base === undefined) {
    return (
      <View
        className="justify-center gap-1 rounded-lg border-thin border-decorative bg-surface px-4 py-3"
        style={{ minHeight: TARGET['tap-target-min'] }}
      >
        <Text className="text-base text-primary">{label}</Text>
        <Text className="text-sm text-muted">
          Not published yet — will be at {path}
        </Text>
      </View>
    );
  }

  const url = `${base.replace(/\/$/, '')}${path}`;
  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint="Opens this page in your browser"
      hitSlop={TARGET['hit-slop-default']}
      style={{ minHeight: TARGET['tap-target-min'] }}
      className="justify-center rounded-lg border-thin border-decorative bg-surface px-4 py-3"
    >
      <Text className="text-base text-primary">{label}</Text>
    </Pressable>
  );
}

/** Same 48pt floor and labelling rules as every other action in the app. */
function SettingsButton({
  label,
  hint,
  onPress,
  emphasis = 'secondary',
}: {
  readonly label: string;
  readonly hint: string;
  readonly onPress: () => void;
  readonly emphasis?: 'primary' | 'secondary';
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
