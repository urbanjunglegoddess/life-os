-- =====================================================================
-- Life OS — Slice Zero: tenancy wall + spine core
-- Rule 1 of the architecture: tenancy on every row, RLS from day one.
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- Layer 1: TENANT (the RLS wall) ----------
create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ---------- Layer 2: PROFILE (a person) ----------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

create table public.tenant_members (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, profile_id)
);
create index on public.tenant_members (profile_id);

-- ---------- Layer 3: ENTITY (context inside a tenant) ----------
create table public.entities (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text not null,
  slug       text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index on public.entities (tenant_id);

-- ---------- AREAS (life domains) ----------
create table public.areas (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text not null,
  slug       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index on public.areas (tenant_id);

-- ---------- ACTIONS (the universal unit) ----------
create table public.actions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  entity_id    uuid references public.entities(id) on delete set null,
  area_id      uuid references public.areas(id) on delete set null,
  title        text not null check (length(btrim(title)) > 0),
  status       text not null default 'open'
               check (status in ('open','doing','done','dropped')),
  do_now_url   text,                        -- deep link: the one-tap escape hatch
  due_at       timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- computation lives in Postgres, never duplicated in app code (anti-Notion rule)
  is_done      boolean generated always as (status = 'done') stored
);
create index on public.actions (tenant_id, status);
create index on public.actions (tenant_id, due_at);

-- =====================================================================
-- TENANCY HELPER
-- SECURITY DEFINER so it can read tenant_members without triggering that
-- table's own RLS (which would recurse). It carries its own auth check --
-- a definer function without one is hazard #7 in the audit list.
-- search_path is pinned to defeat search_path hijacking.
-- =====================================================================
create or replace function public.current_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tm.tenant_id
  from public.tenant_members tm
  where tm.profile_id = (select auth.uid());
$$;

revoke all on function public.current_tenant_ids() from public;
grant execute on function public.current_tenant_ids() to authenticated, service_role;

-- =====================================================================
-- ENABLE RLS ON EVERY TABLE -- including ones that feel internal.
-- PostgREST exposes them regardless of how we think about them.
-- =====================================================================
alter table public.tenants        enable row level security;
alter table public.profiles       enable row level security;
alter table public.tenant_members enable row level security;
alter table public.entities       enable row level security;
alter table public.areas          enable row level security;
alter table public.actions        enable row level security;

-- Force RLS even for the table owner, so a definer-context mistake
-- elsewhere cannot quietly read everything.
alter table public.tenants        force row level security;
alter table public.profiles       force row level security;
alter table public.tenant_members force row level security;
alter table public.entities       force row level security;
alter table public.areas          force row level security;
alter table public.actions        force row level security;

-- ---------- POLICIES ----------
-- auth.uid() is wrapped in a subselect throughout: Postgres then evaluates
-- it once per statement instead of once per row.

create policy tenants_select on public.tenants for select to authenticated
  using (id in (select public.current_tenant_ids()));

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Membership is READ-ONLY through the API. The only writer is the
-- signup trigger below. This is the door that would otherwise let
-- someone grant themselves access to another tenant.
create policy tenant_members_select on public.tenant_members for select to authenticated
  using (profile_id = (select auth.uid()));

create policy entities_all on public.entities for all to authenticated
  using      (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

create policy areas_all on public.areas for all to authenticated
  using      (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

create policy actions_all on public.actions for all to authenticated
  using      (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

-- =====================================================================
-- SIGNUP BOOTSTRAP
-- Creates profile + tenant + membership + default entities and areas.
-- Definer, because the new user has no tenant yet and therefore no rights.
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
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- updated_at ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger actions_touch before update on public.actions
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- TODAY VIEW
-- security_invoker = true is NOT optional. Without it a view runs with
-- the OWNER's rights and silently bypasses RLS on every table it reads --
-- one of the documented ways Supabase apps leak everything.
-- =====================================================================
create view public.actions_today
with (security_invoker = true) as
select a.id, a.tenant_id, a.title, a.status, a.due_at, a.do_now_url,
       ar.name as area_name, e.name as entity_name,
       (a.due_at is not null and a.due_at < now() and a.status <> 'done') as is_overdue
from public.actions a
left join public.areas ar    on ar.id = a.area_id
left join public.entities e  on e.id = a.entity_id
where a.status <> 'dropped';

grant select, insert, update, delete on
  public.tenants, public.profiles, public.tenant_members,
  public.entities, public.areas, public.actions to authenticated;
grant select on public.actions_today to authenticated;
