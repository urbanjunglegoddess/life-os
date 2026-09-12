#!/usr/bin/env bash
# FC-1 cross-tenant isolation gate.
# Spins a throwaway Postgres, applies the migrations, runs the attack suite.
# Exits non-zero if any assertion fails. Wire this into CI as a required check.
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGDATA="${PGDATA:-/tmp/lifeos-pgdata}"
PGPORT="${PGPORT:-5433}"
PGSOCK="${PGSOCK:-/tmp/lifeos-pgsock}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() { "$PGBIN/pg_ctl" -D "$PGDATA" -o "-k $PGSOCK" stop -m immediate >/dev/null 2>&1 || true; }
trap cleanup EXIT

rm -rf "$PGDATA" "$PGSOCK"; mkdir -p "$PGDATA" "$PGSOCK"
if [ "$(id -u)" = "0" ]; then
  id postgres >/dev/null 2>&1 || useradd -m postgres
  chown -R postgres "$PGDATA" "$PGSOCK"
  RUN() { su postgres -c "$1"; }
else
  RUN() { bash -c "$1"; }
fi

RUN "$PGBIN/initdb -D $PGDATA -U postgres --auth=trust" >/dev/null
RUN "$PGBIN/pg_ctl -D $PGDATA -l /tmp/lifeos-pg.log -o '-p $PGPORT -k $PGSOCK' start" >/dev/null
for _ in $(seq 1 30); do psql -h "$PGSOCK" -p "$PGPORT" -U postgres -c 'select 1' >/dev/null 2>&1 && break; sleep 1; done

PSQL="psql -h $PGSOCK -p $PGPORT -U postgres -q -v ON_ERROR_STOP=1"
$PSQL -f "$ROOT/supabase/tests/00_local_supabase_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "  applying $(basename "$f")"; $PSQL -f "$f"; done
# Granted to anon ON PURPOSE. The attack suite is only meaningful if the public
# key can reach the table at all: without the grant, "anon reads nothing" would
# pass on a missing privilege rather than on RLS, which is exactly the
# assertion-that-cannot-fail the FC-1 note warns about.
$PSQL <<'GRANTS'
grant select, insert, update, delete on
  public.tenants, public.profiles, public.tenant_members,
  public.entities, public.areas, public.actions,
  public.journal_prompts, public.journal_entries to anon, service_role;
grant select on public.actions_today to anon, service_role;
grant execute on function public.current_tenant_ids() to anon;
grant execute on function public.record_journal_response(date, text, text) to anon;
GRANTS

OUT="$(psql -h "$PGSOCK" -p "$PGPORT" -U postgres -q -f "$ROOT/supabase/tests/fc1_cross_tenant_isolation.sql" 2>&1 | grep -v '^NOTICE')"
echo "$OUT"
if echo "$OUT" | grep -q 'FC-1 GATE: CLOSED'; then
  echo ""; echo "FC-1 FAILED — release gate is closed."; exit 1
fi
echo ""; echo "FC-1 passed."
