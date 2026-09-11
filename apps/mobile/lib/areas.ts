import { supabase } from './supabase.ts';

export interface Area {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

/**
 * The tenant's life areas — Self, Home, Money, Business, Academic, Kids, Spirit.
 * Seeded by the signup trigger, ordered by the `sort_order` the trigger sets so
 * the capture flow lists them the same way every time.
 */
export async function listAreas(): Promise<readonly Area[]> {
  const { data, error } = await supabase
    .from('areas')
    .select('id, name, slug')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Area[];
}
