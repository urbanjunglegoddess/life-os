#!/usr/bin/env bash
# Rule 4 gate — the service-role key never reaches the client.
#
# "Not in code, not in a committed env file, not in any EAS secret exposed to
# the bundle." Anything in a React Native bundle is extractable, and a secret
# key that lands in the repo is invisible until someone dumps it — the same
# silent failure mode FC-1 exists to catch on the database side.
#
# Scans TRACKED files only, because "committed" is exactly the boundary the rule
# draws: a local .env holding keys is the intended workflow, a tracked one is
# the defect.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail=0
report() { fail=1; echo ""; echo "  ✗ $1"; echo ""; }

FILES="$(git ls-files)"
[ -z "$FILES" ] && { echo "check-secrets: no tracked files."; exit 0; }

# Modern secret key. The length floor keeps the bare `sb_secret_` prefix used as
# a DETECTOR in apps/mobile/lib/env.ts from matching itself.
hits="$(printf '%s\n' "$FILES" | tr '\n' '\0' \
  | xargs -0 rg --no-heading --line-number -e 'sb_secret_[A-Za-z0-9_-]{8,}' 2>/dev/null)"
if [ -n "$hits" ]; then
  report "Supabase SECRET key committed:"
  echo "$hits"
  echo ""
  echo "    Rotate it in the Supabase dashboard NOW — a committed key is burned"
  echo "    whether or not the commit is later removed. Then keep it in .env,"
  echo "    which is gitignored, and only ever server-side."
fi

# Legacy service_role JWT. Its payload carries "role":"service_role", but base64
# encodes that text differently at each of three byte offsets, so there is no one
# fragment to match — all three alignments are listed. Requiring a `eyJ...` run
# immediately before keeps the same fragments, present as DETECTORS in
# apps/mobile/lib/env.ts, from matching themselves.
JWT_PREFIX='eyJ[A-Za-z0-9_-]{8,}'
legacy="$(printf '%s\n' "$FILES" | tr '\n' '\0' \
  | xargs -0 rg --no-heading --line-number \
      -e "${JWT_PREFIX}nJvbGUiOiJzZXJ2aWN" \
      -e "${JWT_PREFIX}Jyb2xlIjoic2Vydmlj" \
      -e "${JWT_PREFIX}icm9sZSI6InNlcnZpY" 2>/dev/null)"
if [ -n "$legacy" ]; then
  report "Legacy service_role JWT committed:"
  echo "$legacy"
  echo ""
  echo "    Same remedy: rotate first, then remove."
fi

# A tracked .env is the defect regardless of what is currently in it.
tracked_env="$(printf '%s\n' "$FILES" | rg '(^|/)\.env(\.|$)' || true)"
if [ -n "$tracked_env" ]; then
  report "Environment file is TRACKED (env.example is the committed one):"
  echo "$tracked_env"
fi

echo ""
if [ "$fail" -ne 0 ]; then
  echo "Secret scan FAILED."
  exit 1
fi
echo "Secret scan passed."
