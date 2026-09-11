import { createBrowserClient } from '@supabase/ssr';

import { readEnv } from '../env.ts';

/** Browser-side Supabase client for Client Components. */
export function createClient() {
  const env = readEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
