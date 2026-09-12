import { supabase } from './supabase.ts';

export interface Entity {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

/**
 * The tenant's entities — Personal, UJG, Empire, JMR. Seeded by the signup
 * trigger, and the FK target for `actions.entity_id`.
 *
 * Read-only here. There is no active-entity concept in slice one: nothing
 * filters by entity yet, so a switcher would be a control that changes
 * nothing. Settings lists them as the record of what exists.
 */
export async function listEntities(): Promise<readonly Entity[]> {
  const { data, error } = await supabase
    .from('entities')
    .select('id, name, slug')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Entity[];
}
