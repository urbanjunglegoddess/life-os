# Design-system reconciliation — UJG brand system ↔ `packages/tokens`

Written 2026-09-12, from a full read of the Urban Jungle Goddess design system
as published in the Claude Design project
`671aef86-403e-4b58-a82b-b47143448ed5` (`_ds/urban-jungle-goddess-design-system-…`).

This is a **new document, not a mirrored ClickUp page.** It records where the
brand system and the app's token module agree, where they diverge, and which
side is authoritative for each divergence. It exists because nothing previously
compared the two: `scripts/check-tokens.sh` enforces that components use the
semantic tier, but nothing checked that the semantic tier still matches the
brand.

## The governing rule

Root System 4.7 is explicit, and it is quoted here because every row below
turns on it:

> SOURCE OF TRUTH IS CODE. There is no Tokens Studio file, no Figma variable
> set, no export step. 4.7 is the specification and the rationale; when the two
> disagree, this module wins and the page gets corrected.

So a divergence is **not automatically a defect in the app.** Most of the rows
below are the app correctly being a different thing from the marketing site.

## What the brand system actually is

Its own `readme.md` settles the scope question. It was built from the founder's
brand PDFs, the live Wix homepage, and the logo artwork, and it ships
`ui_kits/marketing_site`, `ui_kits/command_core`, a 1200px page max, 96/160px
section rhythm, hover states, `backdrop-filter` glass, and Lucide icons over a
CDN.

**It is a web and collateral system.** The mobile app is a consumer of the
*brand* — the palette, the voice, the type faces — not of that system's layout,
surface, or interaction layer. Reading `semantic.css` as binding on the app
would be a category error.

---

## 1. Palette — full agreement, now enforced

Every core and support colour in `packages/tokens/src/palette.ts` matches the
brand's locked v2.0 hexes exactly.

| Brand token | Brand hex | Repo token | Status |
| --- | --- | --- | --- |
| `--night` | `#0A0A0A` | `color-night` | ✅ |
| `--platinum` | `#E8E6E1` | `color-platinum` | ✅ |
| `--platinum-muted` | `#A8A5A0` | `color-platinum-muted` | ✅ |
| `--gold` | `#F2B01E` | `color-gold` | ✅ |
| `--ember` | `#D9531A` | `color-ember` | ✅ |
| `--amethyst` | `#47107D` | `color-amethyst` | ✅ |
| `--forest` | `#0D5E39` | `color-forest-rich` | ✅ |
| `--jungle-green` | `#2E6B4F` | `color-jungle-green` | ✅ |
| `--midnight-forest` | `#042F1E` | `color-forest-midnight` | ✅ |
| `--marigold` | `#E28D1F` | `color-marigold` | ✅ |

`color-jungle-green-text` `#5B8972` is repo-derived (4.7 §2 — Rich Jungle Green
is 3.14:1 on Night and fails AA as text) and has no brand counterpart. That is
correct: it is an accessibility derivation, not a new brand hue.

**None of the five retired v1 values** `check-tokens.sh` bans (`#DCA424`,
`#E86100`, `#5F2C82`, `#7E3209`, `#042D1D`) appears anywhere in the brand
system. The v1 *names* survive in the brand readme as parenthetical aliases
("Luminous Gold (Goldenrod)", "Deep Amethyst (Eminence)") but every hex is v2.

⚠️ One naming trap: the brand's `#042F1E` is `--midnight-forest`, and the
retired v1 Dark Green is `#042D1D`. Two characters apart. The retired-value
grep in `check-tokens.sh` is what stops the wrong one being pasted back in.

**Action taken:** `check-tokens.sh` gained a fourth check asserting these ten
pairs. Palette drift was previously undetectable — the file could have been
edited to any value and every gate would still have gone green.

---

## 2. Semantic roles — REAL CONFLICT, app wins

This is the only material disagreement, and it is worth being precise about
because it affects what colour a button is.

| Role | Brand `semantic.css` | Repo `color.ts` | Authority |
| --- | --- | --- | --- |
| Primary action / CTA | **Ember** `--action-primary-bg` | **Gold** `accent-primary` | **Repo** |
| Warning | **Gold** `--status-warning` | **Marigold** `state-warning` | **Repo** |
| Error / urgent | Ember `--status-danger` | Ember `state-error` | agree |
| Success | Jungle Green | Jungle Green | agree |
| Info | Amethyst | *(no role)* | n/a |
| Label on accent | **Platinum** `--text-on-accent` | **Night** `text-on-warm` | **Repo** |

Three things make the repo right here:

1. **`color.ts` reserves Ember for exactly one meaning.** "Ember means exactly
   ONE thing (4.7 §3.2). If Ember appears and nothing failed, that is a bug in
   the design, not a style choice." A brand where the CTA and the failure state
   are the same colour is fine on a marketing page, where nothing fails. It is
   not fine on a screen whose whole job is a 6am decision.

2. **`--text-on-accent: platinum` would fail contrast on gold.** Platinum
   `#E8E6E1` on Gold `#F2B01E` is roughly 1.2:1. The repo's `text-on-warm:
   night` is the only defensible pairing, and 4.8 does not bend. The brand
   system gets away with it because its primary fill is Ember, where platinum
   is legible — but the rule as written would be applied to gold too.

3. **The design doc itself sides with the repo.** `Life OS - Command Center
   Directions.dc.html` sets `.btn-p{background:#F2B01E;color:#0A0A0A}` — gold
   fill, night label — uses marigold `#E28D1F` for overdue, and uses ember
   `#D9531A` only on "Delete my account". Its own header states the artboards
   "read from `@life-os/tokens` semantic tier only". The brand's own designer
   resolved this conflict in the app's favour when drawing the app.

**No code change.** Recorded so the next person to open `semantic.css` does not
"fix" the app to match it.

---

## 3. Surface model — deliberate divergence

| | Brand | Repo |
| --- | --- | --- |
| Card fill | `--surface-card: --night-90` (Night mixed 92% toward Platinum) | `bg-surface` = forest-midnight over Night at 0.4 |
| Treatment | Neumorphic twin shadow + 2–4% vertical sheen + top-lit inner edge | Flat fill |
| Separation | Extrusion | **Border and spacing** |

The brand readme is emphatic: "**Nothing in this system is a flat fill.**" The
app is entirely flat fills, and that is a decision with a measurement behind
it — `elevation.ts` records that 4.6 §3.5 found this palette cannot produce a
surface luminance step, so elevation moved to borders and spacing at v2.0.

Worth noting the two surface values are *arithmetically* reconciled even though
the methods differ: `compositeOver('#042F1E', '#0A0A0A', 0.4)` is exactly
`#081912`, which is the literal the design doc uses for every card, annotated
in the doc as "forest-midnight at 0.4 over Night". The design doc and the token
module compute the same pixel.

**No code change.** Neumorphism, glass, `backdrop-filter` and the ten gradients
are web-only and out of scope for the beta.

---

## 4. Scales — drift, all of it explicable

| Scale | Brand | Repo | Note |
| --- | --- | --- | --- |
| Type `xl` / `2xl` / `3xl` / `4xl` | 21 / 26 / 32 / 42 | 20 / 24 / 30 / 36 | Brand ladder is px-anchored for decks and print; repo's is a mobile ladder that must survive OS text scaling (4.7 §5.5) |
| Leading tight / snug | 1.1 / 1.25 | 1.2 / 1.35 | Repo is looser — correct for a phone |
| Radius `md` | **10px** (the brand's "house radius") | **8px** | Genuine drift, no rationale on either side |
| Radius `lg` / `xl` | 18 / 28 | 12 / 16 | Brand is a web scale |
| Border `thin` | **1.5px** | **1px** | Name collision: the brand's `--border-hairline` is 1px, which is the repo's `thin`. The repo's `hairline` is 0.5px and has no brand counterpart |
| Tracking, caps | `0.16em` label / `0.28em` eyebrow | `1.2px` (`letter-spacing-caps`) | At 12px, 0.16em ≈ 1.92px. **The app's eyebrows are ~40% tighter than brand.** The readme calls this letterspacing "the single most recognizable UJG detail" |
| Duration instant / fast / slow | 80 / 140 / 320 | 100 / 150 / 300 | Minor |
| Easing standard | `cubic-bezier(.2,.6,.2,1)` | `cubic-bezier(0.4,0,0.2,1)` | Repo is Material's default. The brand curve is a stated decision ("fast out of the gate, soft landing") |
| Spacing | 0–40 (15 steps) | 0–16 (11 steps) | Repo's scale is deliberately CLOSED and smaller; the brand's extra steps are page-layout sizes |

The tracking row is the one with visible consequence today — `text-xs uppercase
tracking-caps` appears on every eyebrow in the app. Note, though, that the
design doc also uses `letter-spacing:1.2px` for `.eyebrow`, so the artboards
match the app, not the brand sheet.

**No code change.** Every row here is a design value, and 4.7 §13 puts those
with Omegea, not in a refactor.

---

## 5. Typefaces — an open question the brand has already answered

| Slot | Brand | Repo |
| --- | --- | --- |
| Body | Urbanist | `font-body: Urbanist` ✅ |
| Display | **Methanerse** | `font-display: Urbanist` (aliased) |
| Heading | Omega Sans | *(no slot)* |
| Data / numeric | **Data Control** — "every figure, eyebrow, label, nav link, badge" | `font-numeric: Urbanist` |
| Editorial / signature / glyph | Mallong / Alistair Signature / Data Control Unifon | *(no slots)* |

`typography.ts` aliases display to body and says so: "Aliased to body until a
display face passes the on-device validation in 4.6 §4.2. Open question 4.7 §14
item 5 — do not resolve it here." BUILD-SPEC §11 row 3 says the same, and
assigns it to Omegea.

The brand system has since **locked Methanerse for display and Data Control for
data**, and ships both as TTFs. That does not close the open question — the
repo's condition was *on-device validation*, not *a decision on paper*, and
none of these faces has been run on a phone at accessibility text sizes with
only a Regular weight available (brand gap 5: no bold or light cuts exist for
Methanerse, Omega Sans, Mallong, Alistair Signature, or Data Control).

**No code change. This is a decision for Omegea** — see the open items below.

---

## 6. Things the brand has that the app has no role for

Recorded so their absence reads as a decision rather than an oversight: the ten
named gradients and two ambient washes (brand rule: "behind content, never as
button fills"), five image filter chains, `[data-persona]` registers for the
four voices, the `[data-theme="light"]` block (4.7: "One theme exists: dark
base. Light and high-contrast are FUTURE-STATE"), glass and neumorphic surface
families, and the `--focus-ring` *geometry* (2px Night gap then 4px Gold ring —
the repo has `focus-ring` as a colour only, with no ring structure token).

The focus-ring one is the only gap here with an accessibility edge to it, and
it is worth a look when the app first needs a visible focus state.

---

## Open items for Omegea

None of these are things an agent should decide.

1. **Display and data typefaces.** The brand has locked Methanerse and Data
   Control; BUILD-SPEC §11 row 3 still lists the display face as open pending
   on-device validation. Only Regular weights exist. Does the app adopt them,
   and at which sizes?
2. **Eyebrow tracking.** Brand 0.16em vs app 1.2px (≈0.1em). The brand calls
   this its most recognisable detail. The artboards use the app's value.
3. **House radius.** Brand 10px, app 8px. No rationale recorded on either side.
4. **Standard easing curve.** Brand `cubic-bezier(.2,.6,.2,1)` is a stated
   brand decision; the app carries Material's default, which was probably never
   a decision at all. Nothing in the app animates yet, so this is free to change
   now and expensive later.

## Change log

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-12 | Created from a full read of the UJG design system; palette conformance check added to `check-tokens.sh` | Omegea Hunter / Claude |
