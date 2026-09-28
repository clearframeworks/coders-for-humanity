# Coders for Humanity

Open engineering for the human problems worth solving.

A standalone Next.js / TypeScript platform for public-interest engineering. It includes the institution, ten programs, project records, a problem library, contribution filters, five work-board views, a structured proposal workflow, contributor profiles, decision records, a handbook, and evidence-based transparency and impact pages.

Live at https://cfh.retehost.com in explicitly labelled demonstration mode. See `docs/production-release-20260928.md` for the verified deployment and recovery coordinate.

## Run locally

Requirements: Node.js 22 or newer and npm. No database is required to explore the demonstration.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3100. For a production build, run `npm run build` then `npm run start`. Both servers use port 3100; stop one before starting the other.

The appearance setting at the bottom of the navigation offers **Light**, **Dark**, and **System**. System is the initial default. A browser preference is restored before paint, persists across visits, and is independent of authentication. System mode responds to operating-system changes without a reload.

## Demonstration and real data

`CFH_DEMO_MODE=true` (also the safe default when unspecified) loads `lib/demo.ts`. Every example project, task, problem, person, and decision is labelled. Claims and shared submissions are disabled. Proposal drafts may be explicitly saved in localStorage on the current device. No fake impact, partners, grants, or financial records are seeded.

`CFH_DEMO_MODE=false` reads the dedicated Supabase database. If the connection or schema fails, the interface reports an error; it does not silently substitute example data. Public records use explicit publication and profile visibility boundaries. The initial migration seeds only the ten program definitions and MIT software license.

## Connect a dedicated Supabase project

Do not reuse an unrelated application's project or credentials.

1. Create or identify the dedicated CFH Supabase project and review `supabase/migrations/20260928025534_institutional_foundation.sql`.
2. Apply that migration in the project's SQL editor or through the Supabase CLI's reviewed migration workflow. It creates normalized entities, foreign-key indexes, RLS policies, private audit and rate-limit tables, and transactional task-claim/proposal functions.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` or the hosting environment. This application does **not** need a service-role key.
4. Set `NEXT_PUBLIC_SITE_URL` to the exact browser origin, including port locally. `http://localhost:3100` and `http://127.0.0.1:3100` are different origins. The server rejects cross-origin mutations.
5. Enable GitHub OAuth in Supabase Auth, create its GitHub OAuth application, and enter provider credentials only in the provider dashboard. Enable email authentication and configure delivery/rate limits. Use the Supabase PKCE email flow.
6. Allow only the exact application callback URL (`SITE_URL/auth/callback`) in Supabase Auth. Configure the site URL and appropriate preview callback URLs explicitly; avoid broad production wildcards.
7. Set `CFH_DEMO_MODE=false` and rebuild/restart. Sign in and create a contributor profile. Profiles are private until the contributor opts into publication.
8. Complete the staging checks below before public operation.

The private `institutional_roles` table models future governing roles. Role provisioning is an operator database action; no public self-promotion path exists. Public project creation and privileged editorial publishing are intentionally operator-managed in this foundation. Do not grant blanket authenticated write access to published records.

## Verification

```powershell
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

`npm test` runs domain behavior checks and an actual embedded PostgreSQL engine (PGlite) with Supabase-compatible auth roles. It executes the full schema and checks RLS, private profiles, unpublished projects, unauthorized role changes, task claiming, proposal ownership, transactional evidence, duplicate handling, and rate limits.

Browser tests use Chromium against port 3100. They check routes, task filtering, board views, search, draft restoration, mobile navigation, light/dark/system persistence, and automated WCAG A/AA rules. These automated checks do not establish full WCAG 2.2 AA conformance. Test screen readers, zoom, touch targets, and low-bandwidth devices with people before release.

### Required staging checks with the real providers

- GitHub OAuth and email links return to the correct origin and fail safely on expired or reused codes.
- Two independent accounts cannot read each other's private proposals, private profiles, or notifications.
- A task can be claimed only once. Example, unpublished, blocked, or dependency-incomplete work cannot be claimed.
- A complete proposal creates its source records atomically; duplicate titles and rate limits behave as documented.
- Profile creation, editing, opting into publication, and opting out work through the real Data API.
- Verify session refresh, sign-out, email delivery, recovery, backup restoration, and the deployed response headers.
- Run Supabase security advisors. Review every public table, function grant, and RLS policy.

OAuth/email delivery and a hosted Supabase connection require a dedicated provider configuration and are not claimed as verified by the local tests.

## Architecture

```text
app/                 Next.js public routes, authenticated account routes, server actions
components/          Reusable layout, records, filters, forms, and appearance controls
lib/catalog.ts       Request-scoped public read adapter: examples or Supabase
lib/records.ts       Project, financial, and verified outcome records
lib/validation.ts    Shared structured proposal and profile validation
lib/content.ts       Institutional principles and contributor handbook
lib/types.ts         Domain types and taxonomy
supabase/migrations/ Normalized PostgreSQL schema, RLS, transactional protected actions
tests/               Domain, database, browser, and accessibility verification
docs/                Operational and architectural handoff
public/              Original supplied logo and public assets
```

Public pages primarily render on the server. Client JavaScript is limited to navigation, appearance, interactive forms, and protected action controls. The contribution filters work with ordinary GET forms and shareable URLs. Search has a common record shape that can be replaced with PostgreSQL full-text ranking; initial reads are bounded to 1,000 records per entity. Add database pagination and search RPCs before scaling beyond that bound.

## GitHub and deployment

Repository, issue, release, milestone, and contributor relationships belong in the institution's data model; source code and review remain on GitHub. This build supports validated repository and issue links. Automatic issue/PR/release synchronization is not activated; its design is in `docs/github-integration.md`.

The application runs on Vercel as a single Next.js service in the dedicated `coders-for-humanity` project at https://cfh.retehost.com. Deployment configuration explicitly preserves demonstration mode. No remote Git repository or fundraising endpoint was created. Before activating connected accounts and shared writes, complete the provider checks above and update the demonstration settings in `vercel.json` as well as the provider environment.

## Public reporting

`/api/transparency` returns schema-versioned, machine-readable funding and expense records. No published records is a data-availability statement, never a claim of audited zero finances. `/impact` includes only verified records linked to non-demo projects, with method, source, period, and limitations.

See `CONTRIBUTING.md`, `GOVERNANCE.md`, `SECURITY.md`, and `docs/architecture.md` before changing the platform's authority or publication boundaries.

## License

Application source: MIT. The supplied logo is preserved unchanged in `public/cfh-logo.png`. An open-source software license does not convey ownership of institutional governance or confer trademark rights. Other artifact types require an appropriate open license and provenance review.
