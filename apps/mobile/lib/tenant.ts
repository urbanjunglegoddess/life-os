import { supabase } from './supabase.ts';

/**
 * The signed-in user's tenant.
 *
 * `actions.tenant_id` is NOT NULL and its RLS policy checks the inserted value
 * against `current_tenant_ids()`, so a write has to carry the tenant explicitly
 * — the wall does not fill it in for you. Read from `tenant_members`, whose own
 * policy already restricts rows to `profile_id = auth.uid()`: there is no way to
 * read someone else's membership here even if the query asked for it.
 */
export async function getCurrentTenantId(): Promise<string> {
  const { data, error } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data === null) {
    // The signup trigger bootstraps membership, so this means the session is
    // valid but the account was never provisioned — worth saying plainly rather
    // than failing later on a confusing RLS rejection.
    throw new Error('No tenant for this account. Sign out and sign in again.');
  }
  return data.tenant_id as string;
}
