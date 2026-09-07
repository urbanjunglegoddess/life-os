\pset pager off
\set QUIET on

-- ===================================================================
-- FC-1 CROSS-TENANT ISOLATION TEST
-- Hard release gate, no override. Every case is an attack a real
-- client could mount holding only the public anon key.
-- ===================================================================
drop table if exists test_results cascade;
create table test_results (
  n int generated always as identity,
  name text, expected text, actual text, passed boolean
);
grant select, insert on test_results to public;
grant usage, select on sequence test_results_n_seq to public;

create or replace function assert(p_name text, p_expected text, p_actual text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into test_results(name, expected, actual, passed)
  values (p_name, p_expected, p_actual, p_expected is not distinct from p_actual);
end; $$;
grant execute on function assert(text,text,text) to public;

-- Two strangers sign up. The trigger bootstraps each one's tenant.
delete from auth.users;
delete from public.tenants;
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','alice@example.com'),
  ('22222222-2222-2222-2222-222222222222','bob@example.com');

drop table if exists t;
create table t as
select tm.profile_id, tm.tenant_id,
       case tm.profile_id when '11111111-1111-1111-1111-111111111111'
            then 'alice' else 'bob' end as who
from public.tenant_members tm;
grant select on t to public;

insert into public.actions (tenant_id, title)
select tenant_id, 'Alice: pay the water bill' from t where who='alice';
insert into public.actions (tenant_id, title)
select tenant_id, 'Bob: book flights' from t where who='bob';

-- ================= ATTACKS, RUN AS ALICE =================
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare b_t uuid; ok text; n int;
begin
  select tenant_id into b_t from t where who='bob';

  perform assert('1. Alice reads only her own actions','Alice: pay the water bill',
    (select string_agg(title,', ' order by title) from public.actions));

  perform assert('2. Alice cannot see Bob''s tenant row','0',
    (select count(*)::text from public.tenants where id = b_t));

  perform assert('3. Alice cannot see Bob''s membership','0',
    (select count(*)::text from public.tenant_members
     where profile_id='22222222-2222-2222-2222-222222222222'));

  perform assert('4. Alice cannot read Bob''s profile','0',
    (select count(*)::text from public.profiles
     where id='22222222-2222-2222-2222-222222222222'));

  perform assert('5. View honours RLS (security_invoker=true)','1',
    (select count(*)::text from public.actions_today));

  ok := 'BLOCKED';
  begin insert into public.actions (tenant_id,title) values (b_t,'INJECTED BY ALICE');
        ok := 'ALLOWED'; exception when others then ok := 'BLOCKED'; end;
  perform assert('6. Alice cannot INSERT into Bob''s tenant','BLOCKED',ok);

  ok := 'BLOCKED';
  begin update public.actions set tenant_id=b_t where title like 'Alice:%';
        get diagnostics n = row_count;
        ok := case when n>0 then 'ALLOWED' else 'BLOCKED' end;
        exception when others then ok := 'BLOCKED'; end;
  perform assert('7. Alice cannot REPARENT a row into Bob''s tenant','BLOCKED',ok);

  n := 0;
  begin delete from public.actions where title like 'Bob:%';
        get diagnostics n = row_count;
        exception when others then n := 0; end;
  perform assert('8. Alice cannot DELETE Bob''s actions','0',n::text);

  ok := 'BLOCKED';
  begin insert into public.tenant_members (tenant_id,profile_id,role)
        values (b_t,'11111111-1111-1111-1111-111111111111','owner');
        ok := 'ALLOWED'; exception when others then ok := 'BLOCKED'; end;
  perform assert('9. Alice cannot GRANT herself Bob''s tenant','BLOCKED',ok);
end $$;
commit;

-- ================= ANONYMOUS: no JWT, public key only =================
begin;
set local role anon;
do $$
declare ok text;
begin
  begin ok := (select count(*)::text from public.actions);
  exception when others then ok := '0'; end;
  perform assert('10. Anon holding the public key reads nothing','0',ok);
end $$;
commit;

-- ================= SERVICE ROLE: expected to bypass =================
begin;
set local role service_role;
do $$ begin
  perform assert('11. service_role sees everything -- why it must NEVER ship in the bundle','2',
    (select count(*)::text from public.actions));
end $$;
commit;

-- ================= NO TABLE WITHOUT RLS =================
do $$ begin
  perform assert('12. Every public table has RLS enabled','0',
    (select count(*)::text from pg_tables pt
     join pg_class c on c.relname=pt.tablename and c.relnamespace='public'::regnamespace
     where pt.schemaname='public'
       and pt.tablename not in ('test_results','t')
       and not c.relrowsecurity));
end $$;

\set QUIET off
\echo ''
\echo '=============== FC-1 CROSS-TENANT ISOLATION ==============='
select n, case when passed then 'PASS' else '*** FAIL ***' end as result, name
from test_results order by n;
\echo ''
select count(*) filter (where passed) || ' / ' || count(*) || ' passed' as summary from test_results;
select case when bool_and(passed) then 'FC-1 GATE: OPEN'
            else 'FC-1 GATE: CLOSED -- DO NOT SHIP' end as verdict from test_results;
