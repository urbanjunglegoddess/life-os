-- Faithful local stand-in for the Supabase-managed pieces.
-- Mirrors Supabase's real auth.uid() implementation so RLS behaves identically.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid;
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::json->>'role',''),
    'anon'
  );
$$;

do $$ begin
  create role anon nologin;                exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin;       exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
