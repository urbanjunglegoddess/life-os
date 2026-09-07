# Life OS

A mobile-first personal life operating system. React Native (Expo) on Supabase Postgres.

Sold publicly as a paid product, with its author as user zero.

## Status

Phase 2, slice zero. The tenancy wall and the spine core exist and are proven.
No app yet.

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
supabase/migrations/   applied in filename order
supabase/tests/        FC-1 suite + a local stand-in for Supabase's auth schema
scripts/test-rls.sh    the gate
```

The local shim mirrors Supabase's real `auth.uid()` implementation, so RLS
behaves identically against a plain Postgres as it does in production.

## Not legal advice

Compliance notes here are research. The household and children screens, the
privacy policy, and the terms of service each need review by a Georgia-licensed
attorney before launch.
