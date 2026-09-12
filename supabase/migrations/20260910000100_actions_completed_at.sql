-- =====================================================================
-- Life OS — Slice One: completion timestamp belongs to Postgres
--
-- The Today flow can now complete an Action (ADR-0011, "complete and undo").
-- `actions.completed_at` is DERIVED from status, so the client must not be the
-- thing that sets it: two writers for one value is the duplicated-formula
-- failure rule 2 exists to prevent, and the second writer is always the one
-- that drifts.
--
-- Fix-forward. 20260826000100 is applied and is never edited.
-- No new table, so no new FC-1 case: the wall this touches is unchanged and a
-- case that cannot fail would only buy false confidence.
-- =====================================================================

create or replace function public.sync_action_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' then
    -- Coalesce rather than overwrite: re-saving a done action must not move the
    -- moment it was finished.
    new.completed_at := coalesce(new.completed_at, now());
  else
    -- Undo. Leaving a stale timestamp behind would make `completed_at is not
    -- null` disagree with the generated `is_done` column, and rollups read both.
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger actions_sync_completed_at
  before insert or update on public.actions
  for each row execute function public.sync_action_completed_at();

-- Existing rows predate the trigger; bring them into line so the invariant
-- holds for the whole table rather than only for rows written from here on.
update public.actions
   set completed_at = case when status = 'done'
                           then coalesce(completed_at, updated_at)
                           else null end
 where (status = 'done') <> (completed_at is not null);
