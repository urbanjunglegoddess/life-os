# Root System — mirrored pages

The Life OS Application Root System is a 183-page ClickUp doc (`838qa-88931`)
covering the application from ideation to sunset. **ClickUp is the source of
truth.** These files are a read-only mirror of the pages that govern slice one,
so an agent can read them locally instead of crawling the whole doc.

Mirrored 2026-09-07. Edits here do not propagate back.

## What is here

| Page | File | Why it matters |
| --- | --- | --- |
| 0.3 Documentation Standards | `0.3-documentation-standards.md` | Doc conventions, and the ClickUp API hazard list |
| 0.6 Master Document Register | `0.6-master-document-register.md` | Index of record — status of all 183 pages, open decisions |
| 3.1 Product Requirements | `3.1-product-requirements.md` | What the product is required to do |
| 3.9 MVP / Release Scope | `3.9-mvp-release-scope.md` | Scope boundaries |
| 4.1 Information Architecture | `4.1-information-architecture.md` | Navigation and the sequential interaction model |
| 4.5 Design System | `4.5-design-system.md` | Components, tap targets, states |
| 4.6 Brand & Visual Style | `4.6-brand-visual-style-guide.md` | Palette, contrast, semantic colour roles |
| 4.7 Design Tokens | `4.7-design-tokens.md` | The token set — spacing, type, radius, elevation, motion |
| 4.8 Accessibility | `4.8-accessibility-guidelines.md` | WCAG targets and the per-slice checks |
| 5.1 Solution Architecture | `5.1-solution-architecture.md` | System shape |
| 5.3 ADRs | `5.3-architecture-decision-records.md` | **ADR-0001 to ADR-0014.** Read this before proposing an architectural change |
| 5.4 Technology Stack | `5.4-technology-stack.md` | Stack and tech radar |
| 5.5 Data Architecture | `5.5-data-architecture.md` | The shared action spine, tenancy model |
| 5.6 Database Schema | `5.6-database-schema.md` | Tables, migration strategy |
| 6.1 Build Plan | `6.1-build-plan.md` | Phases and slices |
| 6.2 Coding Standards | `6.2-coding-standards.md` | Canonical source of the repo's `CLAUDE.md` |
| 6.4 Repo Structure | `6.4-repo-structure.md` | Repository layout |
| 7.1 Test Strategy | `7.1-test-strategy.md` | Test approach, the failure chain FC-1 to FC-6 |

## Precedence

Where these disagree, resolve in this order:

1. **`docs/BUILD-SPEC.md`** — the slice one spec, dated 2026-09-07. Most recent decisions.
2. **5.3 ADRs** — the durable decision record.
3. Everything else.

Three conflicts existed when this mirror was first taken. All three were reconciled
in ClickUp on 2026-09-07 and the mirrors below are the reconciled versions:

- **6.4 (now v1.2)** documents the monorepo per ADR-0014. Its earlier flat-repo
  guidance is preserved in labelled SUPERSEDED blocks. Do not "restore" the flat
  layout and do not read `apps/` or `packages/` as drift.
- **6.2 (now v1.3)** moves Victory Native, Realtime, Edge Functions, `pg_cron` and
  `expo-sqlite` into a Deferred Stack section, each with the ADR that deferred it
  and what brings it back. Its offline-read requirement is replaced by mandatory
  failed-write logging per ADR-0012.
- **Migrations are timestamped** (`20260826000100_…`). Both pages now say so, with
  the earlier numbered scheme preserved and labelled.

Nothing was deleted in either reconciliation — superseded guidance stays visible
and labelled, which is how this workspace is maintained.

## Palette drift, unresolved

The brand palette migrated to UJG Color System v2.0 on 2026-08-26. Some mirrored
pages still carry retired v1 values in their header blockquote — 4.5 shows
`Spanish Orange #E86100`, and 5.1, 5.4, 5.5, 5.6 show `Dark Green #042D1D`.

**Use 4.6 and 4.7 for any colour value.** They are migrated and authoritative.
The retired v1 set is `#DCA424` `#E86100` `#5F2C82` `#7E3209` `#042D1D` — any of
those appearing as a live value anywhere is stale.

## Fetching a page not mirrored here

The full doc is `838qa-88931` in ClickUp workspace `8495850`. Books are:
0 Using the Root System · 1 Ideation · 2 Strategy · 3 Requirements ·
4 Experience & Design · 5 Architecture · 6 Build · 7 Quality · 8 Launch ·
9 Operate · 10 Measure · 11 Iterate · 12 Scale · 13 Governance · 14 Sunset.
