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

# A gate that cannot run must not report a pass. Every check below is an `rg`
# invocation whose empty output means "clean", so a missing ripgrep would turn
# this whole script green — the false-confidence failure the FC-1 note warns
# about, in the one place nobody would think to look.
if ! command -v rg >/dev/null 2>&1; then
  echo "check-tokens: ripgrep (rg) is not installed, so this gate cannot run." >&2
  echo "  Install ripgrep and re-run. CI installs it explicitly for this reason." >&2
  exit 2
fi

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
  --glob '!**/.next/**'
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

# ---- 4. the raw palette still matches the LOCKED brand values -----------
# Checks 1-3 keep design values inside the palette file. Nothing checked the
# palette file itself, so it could have been edited to any hex and every gate
# would still have gone green — the palette is the one file whose whole job is
# to hold specific numbers, and it had no assertion on those numbers.
#
# Source: UJG Color System v2.0, locked 2026-07-29, as published in the design
# system's tokens/colors.css and readme.md. See
# docs/DESIGN-SYSTEM-RECONCILIATION.md.
#
# A change here is a BRAND decision recorded in 4.6 first, never a code change
# (4.7 §13). If this fails, either the palette drifted or the brand moved — and
# either way somebody has to say which.
if [ -f "$PALETTE_FILE" ]; then
  # token=hex. Two characters separate --midnight-forest #042F1E from the
  # RETIRED v1 Dark Green #042D1D, which is exactly the kind of typo check 2
  # catches only after it has already shipped.
  LOCKED=(
    'color-night=#0A0A0A'
    'color-platinum=#E8E6E1'
    'color-platinum-muted=#A8A5A0'
    'color-gold=#F2B01E'
    'color-marigold=#E28D1F'
    'color-ember=#D9531A'
    'color-jungle-green=#2E6B4F'
    'color-forest-midnight=#042F1E'
    'color-forest-rich=#0D5E39'
    'color-amethyst=#47107D'
  )

  drift=""
  for pair in "${LOCKED[@]}"; do
    name="${pair%%=*}"
    hex="${pair#*=}"
    if ! rg -q "'${name}':\s*'${hex}'" "$PALETTE_FILE" 2>/dev/null; then
      actual="$(rg -o "'${name}':\s*'#[0-9A-Fa-f]{6}'" "$PALETTE_FILE" 2>/dev/null || true)"
      drift+="      ${name} must be ${hex} — found: ${actual:-<missing>}"$'\n'
    fi
  done

  if [ -n "$drift" ]; then
    report "Palette has drifted from UJG Color System v2.0 (locked 2026-07-29):"
    printf '%s' "$drift"
    echo "    A palette change is a BRAND decision recorded in 4.6 first (4.7 §13)."
    echo "    If the brand genuinely moved, update this list and the reconciliation doc"
    echo "    in the same commit — otherwise the next drift has nothing to fail against."
  fi
fi

echo ""
if [ "$fail" -ne 0 ]; then
  echo "Token discipline check FAILED."
  exit 1
fi
echo "Token discipline check passed."
