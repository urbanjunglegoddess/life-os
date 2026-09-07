#!/usr/bin/env bash
# Design-token discipline gate — Root System 4.7 §3.1 and §11.
#
# "A literal hex in a component is invisible until it is wrong." The whole point
# of the semantic tier is that this check is MECHANICAL, not a judgement call at
# review time. Three things are checked:
#
#   1. No literal colour anywhere in app or package source except the one raw
#      palette file. That is what keeps a palette migration a one-file change.
#   2. No RETIRED v1 hex anywhere. 4.7 §11 names these as a grep-able build
#      failure once the token module lands. It has landed.
#   3. No component reaching past the semantic tier into the raw palette.
#
# Exits non-zero on any hit. Wired into CI alongside the FC-1 gate.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SCAN=()
[ -d apps ] && SCAN+=(apps)
[ -d packages ] && SCAN+=(packages)
if [ ${#SCAN[@]} -eq 0 ]; then
  echo "check-tokens: no apps/ or packages/ to scan."; exit 0
fi

EXCLUDES=(
  --glob '!**/node_modules/**'
  --glob '!**/dist/**'
  --glob '!**/.expo/**'
  --glob '!**/build/**'
  --glob '!**/assets/**'
)
SRC=(--glob '*.ts' --glob '*.tsx' --glob '*.js' --glob '*.jsx' --glob '*.json' --glob '*.css')

# The ONLY file allowed to contain a raw colour value.
PALETTE_FILE='packages/tokens/src/palette.ts'

fail=0
report() { fail=1; echo ""; echo "  ✗ $1"; echo ""; }

# ---- 1. literal colour values outside the raw palette --------------------
hits="$(rg --no-heading --line-number \
  "${EXCLUDES[@]}" "${SRC[@]}" \
  --glob "!$PALETTE_FILE" \
  -e '#[0-9A-Fa-f]{6}\b' -e '#[0-9A-Fa-f]{3}\b' \
  -e '\brgba?\([0-9]' \
  "${SCAN[@]}" 2>/dev/null)"
if [ -n "$hits" ]; then
  report "Literal colour values outside $PALETTE_FILE:"
  echo "$hits"
  echo ""
  echo "    Point at a SEMANTIC token instead (4.7 §3). If the role genuinely"
  echo "    does not exist yet, add it to packages/tokens — not to the component."
fi

# ---- 2. retired v1 palette, anywhere ------------------------------------
# Goldenrod · Spanish Orange · Eminence · a retired shade · old Dark Green.
retired="$(rg --no-heading --line-number -i \
  "${EXCLUDES[@]}" "${SRC[@]}" \
  -e '#DCA424' -e '#E86100' -e '#5F2C82' -e '#7E3209' -e '#042D1D' \
  "${SCAN[@]}" 2>/dev/null)"
if [ -n "$retired" ]; then
  report "RETIRED v1 palette values (4.7 §11) — these were replaced at v2.0:"
  echo "$retired"
fi

# ---- 3. raw palette reached from outside the token package --------------
raw="$(rg --no-heading --line-number \
  "${EXCLUDES[@]}" "${SRC[@]}" \
  --glob '!packages/tokens/**' \
  -e '\bPALETTE\b' -e "'color-[a-z-]+'" \
  "${SCAN[@]}" 2>/dev/null)"
if [ -n "$raw" ]; then
  report "Raw palette referenced outside packages/tokens:"
  echo "$raw"
  echo ""
  echo "    Components touch the SEMANTIC tier only (4.7 §3.1)."
fi

echo ""
if [ "$fail" -ne 0 ]; then
  echo "Token discipline check FAILED."
  exit 1
fi
echo "Token discipline check passed."
