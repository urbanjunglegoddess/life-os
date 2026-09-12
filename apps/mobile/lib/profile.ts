import { supabase } from './supabase.ts';

export interface AccountProfile {
  readonly displayName: string | null;
  readonly email: string | null;
}

/**
 * The signed-in person.
 *
 * Only ever ONE row: `profiles_select` restricts the table to
 * `id = auth.uid()`, so there is no way to read anybody else's profile even if
 * the query asked for it — which is also why Settings cannot list household
 * members. Children are records, never users (rule 7); they will come from a
 * people table when one exists, not from `profiles`.
 *
 * The email lives on the auth user rather than the profile row, so it is read
 * from the session.
 */
export async function getProfile(): Promise<AccountProfile> {
  const [{ data: row, error }, { data: auth }] = await Promise.all([
    supabase.from('profiles').select('display_name').maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (error) throw error;
  return {
    displayName: (row?.display_name as string | null) ?? null,
    email: auth.user?.email ?? null,
  };
}
