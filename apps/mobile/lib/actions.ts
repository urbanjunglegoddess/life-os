import { CaptureInputSchema, type CaptureInput } from './captureInput.ts';
import { getCurrentTenantId } from './tenant.ts';
import { supabase } from './supabase.ts';

export interface CreatedAction {
  readonly id: string;
  readonly title: string;
}

/**
 * Create an Action — the universal unit. Everything in this app decomposes into
 * one, and capture is the path that makes the first.
 *
 * `status` and `created_at` are left to their database defaults, and `is_done`
 * is a generated column. Computation lives in Postgres; setting any of them
 * here would be the duplicated-formula failure the app exists to escape.
 */
export async function createAction(input: CaptureInput): Promise<CreatedAction> {
  const parsed = CaptureInputSchema.parse(input);
  const tenantId = await getCurrentTenantId();

  const { data, error } = await supabase
    .from('actions')
    .insert({
      tenant_id: tenantId,
      title: parsed.title,
      area_id: parsed.areaId,
      due_at: parsed.dueAt,
    })
    .select('id, title')
    .single();

  if (error) throw error;
  return data as CreatedAction;
}
