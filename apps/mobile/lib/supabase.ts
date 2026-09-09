import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { ENV } from './env';
import { SecureSessionStore } from './secure-session-store';

/**
 * The single Supabase client. THE ONLY DOORWAY between the app and the spine
 * (6.4 §3) — a screen that imports this directly instead of going through a
 * data-access function in `lib/` is a boundary violation.
 *
 * There is no hand-rolled REST API: every call goes through PostgREST and is
 * constrained by RLS at `tenant_id`. The client holds the PUBLISHABLE key, and
 * that is the whole security model — FC-1 test 10 asserts that a caller holding
 * only this key reads nothing across tenants.
 */
export const supabase = createClient(
  ENV.EXPO_PUBLIC_SUPABASE_URL,
  ENV.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: SecureSessionStore,
      autoRefreshToken: true,
      persistSession: true,
      // No URL-based session detection on native — there is no redirect
      // callback to parse, and leaving it on makes the client wait on one.
      detectSessionInUrl: false,
    },
  },
);

/**
 * Supabase refreshes the access token on a timer, and a timer in a backgrounded
 * React Native app is not reliably serviced. Without this, a phone left alone
 * overnight wakes with an expired token and the first tap of the 6am loop fails.
 * Returns a teardown so the root layout can unsubscribe.
 */
export function startSessionAutoRefresh(): () => void {
  const handle = (state: string) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  };

  handle(AppState.currentState);
  const subscription = AppState.addEventListener('change', handle);
  return () => subscription.remove();
}
