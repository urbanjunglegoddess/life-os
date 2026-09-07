# CLAUDE.md — Life OS

Operating instructions for any agent writing code in this repo. Canonical source
is Root System page 6.2 (`docs/root-system/6.2-coding-standards.md`), reconciled
with `docs/BUILD-SPEC.md`. **Read `docs/BUILD-SPEC.md` first** — it is the slice
one spec and it wins wherever the mirrored Root System pages disagree with it.

## What this is

A multi-tenant, mobile-first personal life OS that replaces Notion as the owner's
operating system for life and business. Built solo, in short sessions, and sold
publicly as a paid product with its author as user zero. That last fact is why
tenancy and RLS are treated as a wall between strangers rather than as tidy
organisation.

**A website tells; an application does.** Everything decomposes into Actions
carrying a do-now deep link. Progress rolls up from completed Actions — never
typed by hand. If a feature only records something and never produces an Action,
stop and question it.

Not a Notion clone. It does a specific set of things faster, without Notion's
chained-formula problem.

## Stack (locked)

Expo Router · NativeWind · TanStack Query + Zustand · React Hook Form + Zod ·
Supabase (Postgres, Auth email OTP, RLS, Storage) · `expo-local-authentication` ·
`expo-secure-store` · EAS Build/Update · Sentry · TypeScript throughout.

**No local Mac. EAS cloud builds are non-optional.**

**Deferred — do not pull in:** `expo-sqlite`, Victory Native, Realtime, Edge
Functions, `pg_cron`, RevenueCat. Page 6.2 §4 records each one with the ADR that
deferred it and what would bring it back. They are shelved, not rejected.

New framework, state library, or service? Log an ADR in
`docs/root-system/5.3-architecture-decision-records.md` **before** the code.

## Repo layout

```
apps/mobile/       Expo app
apps/web/          Next.js — compliance pages only: /delete-account, /privacy, /terms
packages/types/    shared TypeScript types, generated from the DB schema
packages/tokens/   design tokens, single source of truth
supabase/          migrations + FC-1 tests
scripts/           test-rls.sh
docs/root-system/  mirrored ClickUp pages — read-only, edits do not propagate back
docs/BUILD-SPEC.md the slice one spec
```

Page 6.4 documents this layout and keeps the earlier flat one (`/app`, `/lib`,
`/db`) in labelled SUPERSEDED blocks. Do not "restore" the flat layout, and do
not read `apps/` or `packages/` as drift.

## Already built — slice zero, merged

The tenancy wall and spine core exist and are proven. Migration:
`supabase/migrations/20260826000100_tenancy_and_spine.sql`.

- Tables `tenants`, `profiles`, `tenant_members`, `entities`, `areas`, `actions` —
  `tenant_id` on every row, RLS both **ENABLED** and **FORCED** on every table.
- `current_tenant_ids()` — SECURITY DEFINER helper with its own auth check and a
  pinned `search_path`.
- A signup trigger bootstrapping profile, tenant, membership, entities and areas.
- `actions_today` — a view with `security_invoker = true`.

## The FC-1 gate

```bash
./scripts/test-rls.sh
```

Spins a throwaway Postgres, applies every migration, runs twelve cross-tenant
attacks a real client could mount holding only the public key. Runs in CI on every
push. **Must pass before any release.**

**EVERY NEW TABLE GETS A NEW FC-1 CASE IN THE SAME PULL REQUEST.** No exceptions,
no follow-up ticket.

The suite is verified to discriminate — disabling `security_invoker` on the view
turns test 5 red. Keep it that way. An assertion that passes regardless of the
code is worse than no assertion: it buys false confidence in the one place where
failure is silent.

## Rules that must not be broken

1. **`tenant_id` on every new table.** RLS enabled AND forced in the same
   migration that creates the table — never as a follow-up. A table that lands
   unguarded is a cross-tenant leak, and nothing crashes to tell you.
2. **Computation lives in Postgres.** Generated columns for row-local math, views
   for cross-row aggregates. Never duplicate a formula in app code — that is the
   exact Notion failure this app exists to escape.
3. **Components reference SEMANTIC design tokens only.** A literal hex anywhere in
   `apps/mobile/components` is a review failure, no argument. The v2 palette
   migration repointed every colour and touched zero component files; that only
   works while the rule holds.
4. **The service-role key never reaches the client.** Not in code, not in a
   committed env file, not in any EAS secret exposed to the bundle. Anything in a
   React Native bundle is extractable. FC-1 test 11 makes this concrete.
5. **Online-only for the beta.** Writes need a connection; on failure show a clear
   message and a retry. **Log every failed write locally with a timestamp** — the
   kill criterion measures friction, and a write lost to flaky wifi must not read
   as a design failure.
6. **Biometric gate on the journal only**, via `expo-local-authentication`,
   rendered at `z-gate` (z-index 900). The app opens freely so the 6am one-tap
   loop stays instant. **Gate state must NOT persist across backgrounding** —
   re-authenticate on return.
7. **Children are records, never users.** No child login, no child-facing mode, no
   child-facing imagery anywhere including store listings. A child login pulls in
   verifiable parental consent, a children's data security program and a retention
   policy. Not in scope, and not by accident.
8. **Finance is manual entry only.** No bank linking.
9. **No hub reaches into a sibling hub's tables.** Cross-hub needs go through the
   spine or an explicit exported interface. If a feature wants to reach across
   directly, stop and flag it — that is an architecture change, not a quick fix.
10. **Never edit an applied migration.** Fix forward with a new numbered file.

## The interaction model

One question, one screen, everywhere — a sequence of single-decision screens, not
a page of controls, with a persistent escape hatch to a scannable list in the same
position on every screen. Consequence-first ordering decides *what comes next*;
sequential delivery decides *how it arrives*. Screen anatomy is fixed and position
is load-bearing: actions never reorder between screens.

**Full specification: `docs/BUILD-SPEC.md` §5. Read it before building any screen.**

Build the reusable flow primitive (§5.2 + §5.3) *before* any screen that uses it.
Every flow in the app is that component with different content.

## Conventions

| Element | Convention | Example |
| --- | --- | --- |
| Variables / functions | camelCase | `spawnActionsFromTemplate` |
| Types / components | PascalCase | `QuickCaptureSheet` |
| Constants | UPPER_SNAKE_CASE | `IRS_MILEAGE_RATE` |
| DB tables & columns | snake_case, plural tables | `action_logs`, `reorder_threshold` |
| DB views | `v_` prefix | `v_trade_stats` |
| Migrations | timestamped, append-only | `20260826000100_tenancy_and_spine.sql` |

- **TypeScript strict. No `any` on data models.** Types in `packages/types` are
  generated from the DB schema — regenerate, do not hand-edit.
- **Zod at every boundary**; React Hook Form for input. Invalid input rejects with
  no write.
- **Schema before screens.** No UI for an area until its tables + RLS exist and the
  migration is committed.
- **Vertical, not horizontal.** One slice per session, wired end to end. Never
  leave a slice half-wired; never scaffold ten empty screens.
- **Commits:** small, present tense, one logical change, referencing the ClickUp
  custom ID `UJGFREE-####` (list `901110966415`). Branch `feat/*`, PR into `main`.
- **Comment why, not what.** Any non-trivial computed value gets a one-line note
  where it is defined plus a line in `docs/root-system/5.6-database-schema.md`.

## Error handling

- Loading, empty and error states on **every** screen — definition of done, not
  polish.
- Never swallow a failure silently: surface it in the UI and log it to Sentry.
- An expired session mid-action must re-auth and **preserve state**.
- Account deletion is a cascading hard delete across every table, Storage objects
  and the auth user. A partial delete is a compliance failure, not a defect.

## Testing

- **Unit:** validation, generated-field math.
- **Integration:** Supabase client → RLS → tables.
- **E2E:** capture-to-action, log money, run a routine, complete the day.
- **FC-1:** `./scripts/test-rls.sh` — the release gate. New table, new case, same PR.

## How to run things

```bash
./scripts/test-rls.sh          # FC-1 cross-tenant isolation suite (CI-required)
npx expo start                 # dev, from apps/mobile — on-device via Expo Go
eas build / eas update         # cloud builds and OTA; there is no local Mac
```

## Do not

- Add a table without `tenant_id`, RLS forced, and an FC-1 case in the same PR.
- Duplicate a Postgres-computed value as a formula in app code.
- Write a literal hex into a component.
- Ship mock data to `main` — it hides broken data paths.
- Pull in a deferred dependency (see Stack) without an ADR.
- Build a record type that never spawns an Action.
- Drift into theming or refactors while core surfaces are unbuilt. Name it and
  get back to shipping a slice.
- Answer an open question yourself. `docs/BUILD-SPEC.md` §11 lists what is
  undecided and who decides it — ask, do not invent.
