-- =====================================================================
-- Life OS — Slice One: the journal (BUILD-SPEC §5.6, build order step 8)
--
-- Two new tables, exactly the pair §6 names: `journal_prompts` (the question
-- set) and `journal_entries` (ONE ROW PER DAY PER TENANT). Both carry
-- `tenant_id`, and both get RLS enabled AND forced in this same file — rule 1,
-- never a follow-up, because a table that lands unguarded leaks silently.
--
-- The answers live in `journal_entries.responses`, a jsonb object keyed by
-- prompt SLUG rather than prompt id. Two reasons: the slug survives reseeding
-- and rewording the prompt set (§11 row 2 is Omegea's to revisit), and a day's
-- entry stays one row, which is what "one per day per tenant" means. The cost
-- is honest and worth naming: this is a bag, not a relation, so per-prompt
-- reporting across time will want a real `journal_responses` child table if the
-- journal ever grows analytics. It does not have one yet because slice one does
-- not need one.
--
-- Fix-forward. 20260826000100 and 20260910000100 are applied and never edited.
-- =====================================================================

-- ---------------------------------------------------------------------
-- DERIVED: how many prompts a day's entry actually answers.
--
-- Rule 2 — computation lives in Postgres. "An entry with ONE answered prompt
-- is a complete entry" (§5.6) is a product rule, so it is a generated column
-- here rather than a truthiness check re-implemented in each caller. Blank and
-- whitespace-only answers do not count: a saved empty box is a skip, and the
-- client must not be the only thing that knows that.
--
-- IMMUTABLE is required for a generated column to reference it. It is honestly
-- immutable: same jsonb in, same count out, no table or setting consulted.
--
-- No `set search_path`, matching `touch_updated_at` and
-- `sync_action_completed_at`. This repo pins search_path on SECURITY DEFINER
-- functions, where an unpinned path is a privilege-escalation route; this one
-- is not definer and calls nothing but pg_catalog builtins, which resolve
-- ahead of any user schema. A SET clause here would also block inlining, for
-- a function the planner runs on every row written.
-- ---------------------------------------------------------------------
create or replace function public.journal_answered_count(p_responses jsonb)
returns int
language sql
immutable
as $$
  select count(*)::int
  from jsonb_each_text(coalesce(p_responses, '{}'::jsonb)) kv
  where btrim(kv.value) <> '';
$$;

-- ---------------------------------------------------------------------
-- JOURNAL PROMPTS — the question set, per tenant.
--
-- Tenant-scoped rather than global so the set can be reworded per account
-- without a migration. Seeded by the signup trigger below.
-- ---------------------------------------------------------------------
create table public.journal_prompts (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  -- The stable key. `responses` is keyed by this, so rewording `prompt` never
  -- orphans an answer already written.
  slug       text not null check (length(btrim(slug)) > 0),
  prompt     text not null check (length(btrim(prompt)) > 0),
  sort_order int  not null default 0,
  -- Retiring a prompt must not delete the answers already given under it, so
  -- prompts are deactivated rather than removed.
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index on public.journal_prompts (tenant_id, sort_order);

-- ---------------------------------------------------------------------
-- JOURNAL ENTRIES — one row per day per tenant (§6).
-- ---------------------------------------------------------------------
create table public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- The LOCAL calendar day, supplied by the client. `current_date` is the
  -- server's day in UTC and would file a 6am entry in Georgia under the wrong
  -- date for part of the year; it is here as a floor, not as the normal path.
  entry_date date not null default current_date,
  responses  jsonb not null default '{}'::jsonb
             check (jsonb_typeof(responses) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Derived, never written by the client (rule 2).
  answered_count int     generated always as (public.journal_answered_count(responses)) stored,
  is_complete    boolean generated always as (public.journal_answered_count(responses) > 0) stored,
  unique (tenant_id, entry_date)
);
-- No separate index for "today's entry" or for a date-ordered history: the
-- unique constraint above is already a btree on (tenant_id, entry_date), and
-- Postgres reads a btree backwards as happily as forwards. A second index on
-- the same columns would cost every write and serve nothing.

create trigger journal_entries_touch before update on public.journal_entries
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- RLS — ENABLED AND FORCED, in the migration that creates the tables.
-- Forced as well as enabled so a definer-context mistake somewhere else
-- cannot read every tenant's journal.
-- =====================================================================
alter table public.journal_prompts enable row level security;
alter table public.journal_entries enable row level security;

alter table public.journal_prompts force row level security;
alter table public.journal_entries force row level security;

-- Same shape as `actions_all`: the tenant is the wall, and `auth.uid()` is
-- wrapped in a subselect so it is evaluated once per statement, not per row.
create policy journal_prompts_all on public.journal_prompts for all to authenticated
  using      (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

create policy journal_entries_all on public.journal_entries for all to authenticated
  using      (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

-- =====================================================================
-- RECORDING ONE ANSWER
--
-- The merge of a single prompt's answer into the day's entry is a computation,
-- so it lives here rather than as a read-modify-write in the client — two
-- prompts answered from two screens must not clobber each other, and the app
-- should never have to hold the whole entry in memory to add one line.
--
-- SECURITY INVOKER, deliberately: this runs with the caller's rights and is
-- therefore subject to `journal_entries_all` exactly like a direct write. A
-- definer function here would be a hole straight through the tenancy wall.
-- =====================================================================
create or replace function public.record_journal_response(
  p_entry_date date,
  p_slug       text,
  p_text       text
)
returns public.journal_entries
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_tenant uuid;
  v_row    public.journal_entries;
begin
  -- `tenant_members` is already restricted to the caller by its own policy, so
  -- this cannot resolve to somebody else's tenant even if it wanted to.
  select tm.tenant_id into v_tenant
  from public.tenant_members tm
  where tm.profile_id = (select auth.uid())
  limit 1;

  if v_tenant is null then
    raise exception 'No tenant for this account.';
  end if;

  insert into public.journal_entries (tenant_id, profile_id, entry_date, responses)
  values (v_tenant, (select auth.uid()), p_entry_date,
          jsonb_build_object(p_slug, coalesce(p_text, '')))
  on conflict (tenant_id, entry_date) do update
    -- Right-hand side wins, so re-answering a prompt replaces that one key and
    -- leaves every other answer for the day untouched.
    set responses = public.journal_entries.responses || excluded.responses
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_journal_response(date, text, text) from public;
grant execute on function public.record_journal_response(date, text, text)
  to authenticated, service_role;

-- =====================================================================
-- SEED THE PROMPT SET
--
-- Decided 2026-09-12 (BUILD-SPEC §11 row 2): blocker, progress, forward hook.
-- Replacing the signup trigger rather than editing 20260826000100, which is
-- applied. The function body is otherwise identical to the one it replaces.
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(coalesce(new.email,'user'), '@', 1));

  insert into public.tenants (name)
  values (coalesce(split_part(new.email,'@',1),'personal') || '''s tenant')
  returning id into v_tenant_id;

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (v_tenant_id, new.id, 'owner');

  insert into public.entities (tenant_id, name, slug)
  values (v_tenant_id,'Personal','personal'),
         (v_tenant_id,'UJG','ujg'),
         (v_tenant_id,'Empire','empire'),
         (v_tenant_id,'JMR','jmr');

  insert into public.areas (tenant_id, name, slug, sort_order)
  values (v_tenant_id,'Self','self',1),
         (v_tenant_id,'Home','home',2),
         (v_tenant_id,'Money','money',3),
         (v_tenant_id,'Business','business',4),
         (v_tenant_id,'Academic','academic',5),
         (v_tenant_id,'Kids','kids',6),
         (v_tenant_id,'Spirit','spirit',7);

  insert into public.journal_prompts (tenant_id, slug, prompt, sort_order)
  values (v_tenant_id,'held-up','What held today up?',1),
         (v_tenant_id,'moved','What moved?',2),
         (v_tenant_id,'waiting','What is waiting on you tomorrow?',3);

  return new;
end;
$$;

-- Tenants created before this migration have no prompts and would open the
-- journal to an empty flow. Idempotent, so re-running the file is safe.
insert into public.journal_prompts (tenant_id, slug, prompt, sort_order)
select t.id, p.slug, p.prompt, p.sort_order
from public.tenants t
cross join (values
  ('held-up','What held today up?',1),
  ('moved','What moved?',2),
  ('waiting','What is waiting on you tomorrow?',3)
) as p(slug, prompt, sort_order)
on conflict (tenant_id, slug) do nothing;

grant select, insert, update, delete on
  public.journal_prompts, public.journal_entries to authenticated;
