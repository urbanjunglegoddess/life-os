import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { readEnv } from '../env.ts';

/**
 * Session refresh for Next middleware.
 *
 * NOT REGISTERED as root middleware yet, deliberately. Every route in this app
 * is static and unauthenticated, so running an auth round-trip on each request
 * would be latency with nothing to show for it. It is written now so that the
 * route which does need it starts from a correct version — and registers with a
 * `matcher` scoped to that route, not to the whole site.
 *
 * THE getUser() CALL BELOW IS THE ENTIRE POINT and is the thing Supabase's
 * quickstart snippet omits: it creates the client, never calls it, and returns.
 * Without this line nothing is revalidated and no cookie is rewritten, so the
 * middleware silently does nothing while looking correct — sessions expire
 * exactly as if it were not there.
 */
export async function updateSession(request: NextRequest) {
  const env = readEnv();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Revalidates the token and triggers setAll above. Do not remove, and do not
  // put logic between createServerClient and this call.
  await supabase.auth.getUser();

  return supabaseResponse;
}
