# Life OS

A mobile-first personal life operating system. React Native (Expo) on Supabase Postgres.

Sold publicly as a paid product, with its author as user zero.

## Status

Phase 2, slice one. The tenancy wall and the spine core exist and are proven.
The monorepo, the design-token module and the Expo shell are up; the shell
renders through Expo Router with NativeWind reading `@life-os/tokens`.

Not yet built: Supabase client and email OTP auth, the reusable flow primitive,
and every product surface. `docs/BUILD-SPEC.md` §7 is the build order and it is
worked in sequence — the flow primitive lands before any screen that uses it.

## The three structural rules

1. **Tenancy on every row, RLS from day one.** Not retrofitted.
2. **Spine first, hubs as lenses.** No hub reaches into a sibling's tables.
3. **Everything decomposes into Actions.**

And the anti-Notion rule: computation lives in Postgres — generated columns and
views — never duplicated as formulas in app code.

## FC-1 is a hard release gate

Public release turns Row Level Security from an organising convenience into the
wall between strangers' financial records, journals and children's names. The
failure mode is silent: nothing crashes, nothing looks wrong, and the data is
simply readable by anyone holding the public key that ships inside the app bundle.

This is the defining failure of the Supabase ecosystem, not an exotic edge case.
CVE-2025-48757 found 303 endpoints across 170 projects readable by anyone with
the anon key. Root cause, every time: RLS was never enabled.

So it is checked by machine:

```bash
./scripts/test-rls.sh
```

Spins a throwaway Postgres, applies every migration, and runs twelve attacks a
real client could mount holding only the public key. Exits non-zero on any
failure. Runs in CI on every push and pull request.

The suite is verified to discriminate: flipping `security_invoker` off on the
`actions_today` view makes test 5 fail, which is the documented leak it exists
to catch.

## Load-bearing design constraints

These three are not preferences. They are what keeps the compliance burden
affordable, and breaking any one changes the cost structure of the whole product.

| Constraint | Why |
| --- | --- |
| **Children are records, never users.** No child login, no child-facing mode or imagery. | COPPA regulates information collected *from* a child, not *about* a child provided by a parent (FTC Complying with COPPA FAQ A.8). A child login brings verifiable parental consent, a written children's data security program, and a retention policy. |
| **Finance is manual entry.** No bank linking or aggregation. | Manual entry means no GLBA exposure. Bank linking needs a fintech attorney *before* the integration is written. |
| **US-only at launch.** | Removes the GDPR Article 27 EU-representative question entirely. Open markets later, once revenue can pay for compliance. |

Also non-negotiable, and not yet built: **in-app account deletion** is mandatory
on both stores — a cascading hard delete across finance, journals, household,
children's records, academic data, Storage objects and the auth user. Google
additionally requires a public web deletion URL. This is its own build slice, not
a settings checkbox, and it is the most likely place for a partial-delete bug
that becomes a compliance failure rather than a defect report.

## Layout

```
apps/mobile/           Expo app — Expo Router, NativeWind
packages/tokens/       design tokens, the single source of truth
supabase/migrations/   applied in filename order
supabase/tests/        FC-1 suite + a local stand-in for Supabase's auth schema
scripts/test-rls.sh    the FC-1 gate
scripts/check-tokens.sh the token-discipline gate
docs/BUILD-SPEC.md     the slice one spec — read it first
docs/root-system/      read-only mirror of the ClickUp pages that govern slice one
```

The local shim mirrors Supabase's real `auth.uid()` implementation, so RLS
behaves identically against a plain Postgres as it does in production.

`apps/web` (three compliance routes) and `packages/types` (generated from the
schema) are specified in BUILD-SPEC §9 and §4 and are not built yet.

## Design tokens are also checked by machine

A colour decision is made once, named once, and referenced everywhere. Components
reference the SEMANTIC tier only — never a raw palette value, never a literal hex.
That rule is what made the v2 palette migration a one-file change that touched
zero component files.

A literal hex in a component is invisible until it is wrong, so the check is not
left to review:

```bash
./scripts/check-tokens.sh
```

It fails on a literal colour outside the raw palette file, on any retired v1 hex,
and on a component reaching past the semantic tier. Like FC-1, it is verified to
discriminate — each of the three rules was broken on purpose and turned it red.

## Running it

```bash
npm install
npm run mobile          # Expo dev server; open on device via Expo Go
npm run typecheck
npm run check:tokens
npm run test:rls        # FC-1 — needs a local PostgreSQL 16
```

There is no local Mac. Device builds and OTA updates go through EAS.

## Not legal advice

Compliance notes here are research. The household and children screens, the
privacy policy, and the terms of service each need review by a Georgia-licensed
attorney before launch.
