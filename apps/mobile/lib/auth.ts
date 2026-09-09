import type { Session } from '@supabase/supabase-js';

import { supabase } from './supabase';

/**
 * Email OTP auth. No password, per the locked stack — one less secret for the
 * owner to manage and one less credential surface on a stolen phone.
 *
 * These are the data-access layer's auth functions. Screens call them; screens
 * never call `supabase.auth` directly.
 */

/**
 * Send a one-time code. `shouldCreateUser` stays TRUE: the signup trigger in
 * `20260826000100_tenancy_and_spine.sql` is what bootstraps profile, tenant,
 * membership, entities and areas, so a first sign-in IS the account creation
 * path. Turning this off would produce a user with no tenant and no rights.
 */
export async function sendEmailOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

/** Exchange the emailed code for a session. */
export async function verifyEmailOtp(
  email: string,
  token: string,
): Promise<Session> {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  });
  if (error) throw error;
  if (!data.session) throw new Error('Verification returned no session.');
  return data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/** Fires on sign-in, sign-out and token refresh. Returns a teardown. */
export function onAuthStateChange(
  callback: (session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}
