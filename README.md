# Coders for Humanity

A community workspace for people building public-interest projects together: shared context, useful contributions, independent review, and handoffs that let the next person continue.

This source is the **public foundation**, not a demonstration catalogue. It contains one real founding project—the community platform itself—and seven unassigned work briefs with stable UUIDs. It does not invent members, conversations, completed contributions, impact, or funding.

The site uses the dedicated Vercel project `coders-for-humanity` and domain [cfh.retehost.com](https://cfh.retehost.com). A domain's existence does not establish which source revision is deployed. Consult the dated production release record in `docs/` for the verified deployment, source revision, checks, limitations, and rollback coordinate. This README does not certify that the current working tree has been released.

The community workspace was deployed and verified on September 28, 2026: [release record](docs/community-release-20260928.md). All 12 browser acceptance tests passed against the public domain. Start the human handoff with [HUMAN-TAKEOVER.md](docs/HUMAN-TAKEOVER.md).

## What works in this source

- Community and project rooms, a real founding backlog, contribution filters, project context, knowledge, and a harness charter.
- Light, dark, and system appearance, with a persistent browser preference.
- Public GitHub repository metadata, open issues, pull requests, and commits through a bounded server read adapter. Empty or unavailable activity is shown honestly.
- Conversation drafts stored on this device, including title, body, conversation type, and project; the contributor can continue a draft on GitHub.
- A personal handoff notebook with context, changes, evidence, remaining work, and review needs. Save, edit, delete, clear, and export Markdown locally.
- Implemented account, community, assignment, inbox, and independent-review interfaces and database rules. These shared workflows remain unavailable until a dedicated hosted database and authentication are configured and verified.

Local notes are not encrypted, synchronized, submitted, or approved. Browser data removal can erase them. Export before changing devices; do not put credentials or private information in them.

## Run locally

Use Node.js 22 or newer and npm. The public foundation requires no database.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open [localhost:3100](http://localhost:3100). Production mode is `npm run build`, then `npm run start`. The servers share port 3100; stop one before starting the other.

`CFH_DEMO_MODE=false` is the foundation setting and is explicitly set in `vercel.json`. With no Supabase configuration, `lib/founding.ts` provides the actual founding project and `lib/harness.ts` provides its seven work briefs. With configured Supabase, the catalogue reads published database records and reports failures rather than replacing them with sample data. The legacy demo fixture remains available only through an explicit `CFH_DEMO_MODE=true` setting for isolated development; it is not the intended production catalogue.

## Provider and publication status

| Boundary | Current state |
| --- | --- |
| Source repository | The reviewed source is published in `clearframeworks/coders-for-humanity` after the owner's explicit approval on September 28, 2026. The first GitHub CI run passed all three jobs. |
| Git-triggered deployments | The dedicated CFH Vercel project is connected to this repository, with `main` as its production branch. Merge and release permissions remain separate from community membership. |
| Supabase | Three migrations and protected actions are implemented and tested locally. No dedicated hosted CFH Supabase project has been provisioned. Organization selection and provisioning cost approval remain pending. |
| Authentication | GitHub/email sign-in requires provider configuration and real-session verification. It is not operational merely because the UI or SQL exists. |
| Harness team | Roles and work briefs are defined. Independent reviewers and release stewards have not been appointed; provider-enforced gates have not been verified. |

See [the human takeover guide](docs/HUMAN-TAKEOVER.md) for the ordered next steps. Do not reuse an unrelated application's database or credentials.

## Connect the dedicated database

After the owner explicitly chooses the Supabase organization and approves the quoted provisioning cost:

1. Provision the dedicated CFH project and a staging environment appropriate for testing.
2. Review and apply **all three migrations in filename order**:
   - `20260928025534_institutional_foundation.sql`
   - `20260928034553_community_workspace.sql`
   - `20260928040326_founding_human_work.sql`
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the exact `NEXT_PUBLIC_SITE_URL`. This application does not require a service-role key in its web runtime. Keep provider credentials out of source control.
4. Configure GitHub OAuth and email authentication in the provider dashboards. Set explicit callback URLs ending in `/auth/callback`; avoid broad production wildcards. Configure delivery, rate limits, and recovery.
5. Keep `CFH_DEMO_MODE=false`. Rebuild after changing public environment values.
6. Verify anonymous, member A, member B, and independent maintainer sessions through the hosted application and Data API. Test private data isolation, role escalation, claim races, hidden conversations, rate limits, current-submission review, revoked sessions, and sign-out.
7. Run provider security advisors and rehearse backup recovery. Enable shared participation only after the harness reviewer and owner accept the evidence.

Profiles are private until the contributor opts into publication. Project membership does not confer maintainer or release authority. Privileged role appointments remain explicit operator actions.

## Verification

```powershell
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

The database suite executes PostgreSQL in PGlite with Supabase-compatible roles. It covers the migrations, row-level access, protected mutations, claim isolation, discussion boundaries, independent reviews, and founding-record consistency. Local success does not prove hosted Auth, provider permissions, or production deployment controls.

Browser checks cover the public journeys, drafts, notebook, themes, mobile navigation, and accessibility rules. Automated checks do not establish complete WCAG conformance; people must test screen readers, keyboard use, zoom, and constrained devices. The final release record owns the check results for the specific deployed candidate.

## Source map

| Path | Responsibility |
| --- | --- |
| `app/` | Public rooms, authenticated workspaces, server actions, and routes |
| `components/` | Interface, forms, local drafts, notebook, and appearance controls |
| `lib/catalog.ts`, `lib/founding.ts` | Public catalogue and actual founding project |
| `lib/community.ts` | Authenticated viewer and discussion reads |
| `lib/github.ts` | Public GitHub read adapter with bounded requests |
| `lib/harness.ts` | Founding tasks and release policy model |
| `supabase/migrations/` | Normalized data, access rules, protected actions, and real founding records |
| `tests/` | Domain, database, browser, and accessibility verification |
| `docs/` | Operating boundaries, release evidence, and human handoff |

The shared-workspace design and scale roadmap are in [architecture.md](docs/architecture.md). The repository boundary is in [github-integration.md](docs/github-integration.md). Read [SECURITY.md](SECURITY.md), [GOVERNANCE.md](GOVERNANCE.md), and [the harness charter](docs/harness-team.md) before changing authority.

## License and evidence

Application source is MIT. The original supplied logo is preserved in `public/cfh-logo.png`; the software license does not transfer trademark rights or institutional authority.

Impact and financial pages distinguish unavailable records from audited zero activity. Only verified, sourced outcomes belong in public impact reports. No completed human pilot or measured public-benefit outcome is claimed by this foundation.
