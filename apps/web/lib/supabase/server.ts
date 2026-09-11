import { createServerClient } from '@supabase/ssr';
import type { cookies } from 'next/headers';

import { readEnv } from '../env.ts';

/**
 * Server-side Supabase client for Server Components and Route Handlers.
 *
 * It holds the PUBLISHABLE key and is therefore still governed by RLS — the
 * same wall FC-1 tests. "Server-side" is not a synonym for privileged here, and
 * reaching for the secret key to make a query work would be stepping over the
 * wall rather than through it.
 */
export function createClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const env = readEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. Harmless when middleware is
            // refreshing the session; if there is no middleware, the session
            // simply is not refreshed here rather than the render throwing.
          }
        },
      },
    },
  );
}
