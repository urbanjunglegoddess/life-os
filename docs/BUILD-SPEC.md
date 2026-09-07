# Life OS — Build Spec, Slice One

Handoff document. Everything here is decided. Where something is open, it says so.

Read this whole file before writing code. The interaction model in §5 is not a
styling preference — it is the product, and building a conventional list-and-form
app that "looks like" this spec will fail the only test that matters.

---

## 1. What this is

A mobile-first personal life operating system replacing a ~35-database Notion hub.
React Native (Expo) on Supabase Postgres. Shipping publicly as a paid product,
with its author as user zero.

**The kill criterion, and it governs every trade in this document:** after one
week of real daily use, if friction is *higher* than Notion's, stop and re-scope.
A tool its own author avoids will not retain strangers.

## 2. Current state

Slice zero is merged and green.

| Built | Where |
| --- | --- |
| Tenancy wall: tenant → profile → entity, `tenant_id` on every row | `supabase/migrations/20260826000100_tenancy_and_spine.sql` |
| RLS enabled AND forced on every table | same |
| `current_tenant_ids()` — SECURITY DEFINER, own auth check, pinned search_path | same |
| Signup trigger bootstrapping profile, tenant, membership, entities, areas | same |
| `actions_today` view with `security_invoker = true` | same |
| FC-1 cross-tenant isolation suite — 12 attacks, 12 passing | `supabase/tests/fc1_cross_tenant_isolation.sql` |
| CI gate | `.github/workflows/rls-gate.yml` |

No app exists. That is slice one.

**Blocked:** the Supabase project is not yet provisioned (free-tier limit).
Migrations apply unchanged the moment it exists. Build against a local Postgres
using `scripts/test-rls.sh` until then.

## 3. Locked stack

Expo Router · NativeWind · TanStack Query + Zustand · React Hook Form + Zod ·
Supabase (Postgres, Auth email OTP, RLS, Storage) · `expo-local-authentication` ·
`expo-secure-store` · EAS Build/Update · Sentry · TypeScript throughout.

**No local Mac.** EAS cloud builds are non-optional.

Deferred, do not pull in: `expo-sqlite`, Victory Native, Realtime, Edge Functions,
pg_cron, RevenueCat.

## 4. Repo structure

```
apps/mobile/      Expo app
apps/web/         Next.js — compliance surface only (§9)
packages/types/   shared TypeScript types, generated from the DB schema
packages/tokens/  design tokens, single source of truth
supabase/         migrations + tests (exists)
scripts/          test-rls.sh (exists)
```

## 5. THE INTERACTION MODEL — one question, one screen

This is ADR-0010 and it is the defining decision of the product.

### 5.1 The rule

Every surface is a **sequence of single-decision screens**, not a page of
controls. One screen asks one thing, shows only what is needed to answer it, and
offers a small fixed set of responses.

The rationale is neurodivergent-first design: reducing what is on screen lowers
executive-function load. Two things follow that are easy to get wrong —

**The escape hatch is not optional.** Neurodivergent is not one set of needs.
Reducing visible structure helps executive-function load and *hurts* people who
need to see whole structure to feel oriented. A persistent "show all" affordance
drops any flow to a scannable list. It sits in the same place on every screen.

**Ordering and delivery are separate concerns.** Consequence-first (ADR-0009)
decides *what comes next*. One-question-one-screen decides *how it arrives*.
A static single card was rejected — if the ranking picks wrong, trust collapses
and there is nowhere to go. A sequence is different: the user still reaches
everything, just not all at once.

### 5.2 Screen anatomy

Every flow screen has the same four regions, in the same positions, always:

```
┌──────────────────────────────┐
│ progress          ≡ show all │  ← where am I · escape hatch
├──────────────────────────────┤
│                              │
│  THE SUBJECT                 │  ← one thing
│  its context                 │  ← why it is here
│                              │
├──────────────────────────────┤
│  [ primary ] [ alt ] [ alt ] │  ← fixed positions, motor memory
└──────────────────────────────┘
```

Position is load-bearing. Actions never reorder between screens — a person
should be able to hit "later" without reading, three mornings in.

### 5.3 Non-negotiables for every flow

- **One decision per screen.** No nested choices, no "and also".
- **Progress is always visible.** Not knowing how long a sequence runs is its own
  anxiety. Show position and total.
- **Deferral is never punished.** No streaks that break, no guilt copy, no red
  counters climbing. "Later" is a legitimate answer given by a legitimate person.
- **Every flow is exitable at any point** without losing what was already answered.
- **No timers.** Nothing counts down.
- **Back always works** and restores the previous answer.

### 5.4 The Today flow

Order is consequence-first: what breaks if skipped, ranked by cost of missing —
not by time of day.

1. **Overdue**, most consequential first — **capped**, with "+N more".
   An unbounded overdue list is a guilt list and people stop opening those.
   The cap number is open — see §11.
2. **Due today**, same ranking.
3. **Calendar context** — a single non-interactive screen showing the day's
   fixed shape. Not in the beta (no calendar), but the slot is reserved.

Per card: `Do now` (opens `do_now_url` if present, else marks doing) ·
`Later` · `Drop`.

**The cleared state is a real screen, not an empty list.** When the queue is
worked, say so plainly and stop. Do not backfill with optional work to keep the
sequence going — that teaches people the flow never ends.

### 5.5 Capture flow

Blank-page paralysis is the thing being designed against. Ask, don't present a form.

Title → area → when. Every step after the first is skippable with a visible
default. A capture that only ever gets a title is a successful capture.

### 5.6 Journal flow

Biometric gate first (§8), then one prompt per screen, all skippable.
An entry with one answered prompt is a complete entry.

### 5.7 Onboarding

Same model. One question per screen. Do not front-load setup — the app should be
usable after the shortest possible path, with the rest asked later in context.

---

## 6. Data model

Slice zero shipped `tenants`, `profiles`, `tenant_members`, `entities`, `areas`,
`actions`, and the `actions_today` view. Slice one adds journal tables.

**Rules that do not bend:**

1. `tenant_id` on every new table. RLS enabled *and forced*, in the same migration
   that creates the table. Never a follow-up.
2. Computation lives in Postgres — generated columns and views. Never duplicated
   as formulas in app code. (This is the whole reason the Notion hub failed.)
3. Components reference **semantic** design tokens only. A literal hex anywhere in
   `apps/mobile/components` is a review failure with no argument attached.

New tables for slice one: `journal_entries` (tenant-scoped, one per day per
tenant) and `journal_prompts`. Follow the existing migration's shape exactly —
including the `force row level security` line, which is easy to omit.

## 7. Build order

Each step ends somewhere runnable. Do not batch them.

1. Monorepo scaffold + `packages/tokens` from the existing UJG v2 palette.
2. Expo app shell, Expo Router, NativeWind wired to the tokens.
3. Supabase client + **email OTP auth** + session persistence via `expo-secure-store`.
4. The flow primitive — a reusable sequential-screen component implementing §5.2
   and §5.3. **Build this before any screen that uses it.** Every flow in the app
   is this component with different content; getting it right once is the
   difference between a coherent product and four things that resemble each other.
5. Capture flow (§5.5). First writeable path. Prove RLS end-to-end from a device.
6. Today flow (§5.4) against `actions_today`.
7. The escape-hatch list view.
8. Journal migration + biometric gate + journal flow.
9. Failed-write logging (§8).
10. EAS build to a real device. The beta starts here, not before.

## 8. Constraints that must not be broken

**Online-only (ADR-0012).** Writes need a connection. On failure: a clear message
and a retry. **Log every failed write locally with a timestamp.** The kill
criterion measures friction, and a write lost to flaky wifi is not a design
failure — without this log the week's result cannot be read honestly.

**Biometric gate on the journal only (ADR-0013).** The app opens freely so the
6am one-tap loop stays instant. `expo-local-authentication` guards journal entry
and reading. Renders at `z-gate` (z-index 900). **Gate state must not persist
across backgrounding** — re-authenticate on return.

**Children are records, never users.** No child login, no child-facing mode, no
child-facing imagery anywhere including the store listing. COPPA regulates
information collected *from* a child, not *about* a child provided by a parent.
A child login brings verifiable parental consent, a written children's data
security program, and a retention policy. Not in scope, and not by accident.

**Finance is manual entry.** No bank linking, ever, without a fintech attorney
first. Not in the beta at all.

**US-only at launch.** Removes the GDPR Article 27 question entirely.

**The service-role key never reaches the client.** Not in code, not in a committed
`.env`, not in an EAS secret exposed to the bundle. Anything in a React Native
bundle is extractable. FC-1 test 11 exists specifically to make this concrete.

## 9. `apps/web` — compliance surface only

Three pages, nothing else:

- `/delete-account` — public account and data deletion request. **Google requires
  this as a web URL separate from the in-app path.**
- `/privacy`
- `/terms`

Both stores require policy and terms links in metadata *and* inside the app.
Marketing and waitlist are deferred.

**Account deletion is a build slice, not a settings checkbox.** It is a cascading
hard delete across every table, Storage objects, and the auth user. A partial
delete is a compliance failure, not a defect report — and it is the single most
likely place for one.

## 10. The FC-1 gate

`./scripts/test-rls.sh` must pass before any release. It runs in CI on every push.

Public release turns RLS from an organising convenience into the wall between
strangers' financial records, journals, and children's names. The failure mode is
silent — nothing crashes.

**Every new table gets a new FC-1 case in the same PR.** The suite is verified to
discriminate (disabling `security_invoker` on the view turns test 5 red); keep it
that way. An assertion that passes regardless of the code is worse than no
assertion, because it buys false confidence.

## 11. Open — do not invent answers

| # | Question | Who decides |
| --- | --- | --- |
| 1 | The overdue cap number in §5.4 | Omegea, from the first week's real data |
| 2 | Journal prompt set and wording | Omegea |
| 3 | Display typeface — Urbanist is the safe default; a display face needs on-device validation | Omegea, after §7 step 2 |
| 4 | Pricing and paywall shape | Not needed for the beta |
| 5 | Chart palette — the v2 five-series set has two series below 3:1 on dark | Blocks charts; no charts in this slice |

## 12. Not legal advice

Compliance notes here are research. The household and children screens, the
privacy policy, and the terms of service each need review by a Georgia-licensed
attorney before launch.
