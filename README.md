# Coders for Humanity

## October 8 platform candidate

This candidate preserves live source `301c3cad06f6960b859dcf2a325ca02038062db5` and the previous signup preparation. The current design and rollout sequence are in [community-platform-architecture.md](docs/community-platform-architecture.md). [Delivery evidence](docs/delivery-audit-20261008.md) distinguishes production from this candidate.

New source includes maintainer task publishing, dependency checks, claim release with a durable handoff, founder profile alerts with a scoped email worker, current-commit GitHub check visibility, and signup failure handling. On October 8 the owner created and approved the dedicated Free Supabase project **Coders for Humanity** (`uinavtzevjoskkymhakx`) in organization `javqroqxdnqbgoqkzknt`, West US / Oregon (`us-west-2`). The five-migration CFH bundle was installed and database structure/permissions verified. Data API exposure, Auth, Vercel connection, real signup, and founder delivery still require verification. No successful hosted signup or delivered founder alert is claimed.

The previously selected shared `retehost-cfw` project could not accept connections; its recovery is separate. The new dedicated project requires no pause or upgrade of that service. Use the five-migration, CFH-specific bundle in [supabase/shared](supabase/shared/README.md): its directory name is historical, but the current app still expects `cfh` and `cfh_private` schemas. Configure notifications using [founder-notifications.md](docs/founder-notifications.md); administrator credentials must not enter CFH's web runtime.

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
| Supabase | Owner-created dedicated Free project `uinavtzevjoskkymhakx` is approved. Five-migration namespaced bundle installed; structure and database permissions verified. API/Auth/application acceptance remains pending. |
| Authentication | GitHub/email sign-in requires provider configuration and real-session verification. It is not operational merely because the UI or SQL exists. |
| Harness team | Roles and work briefs are defined. Independent reviewers and release stewards have not been appointed. GitHub mandatory checks and owner review rules were verified on October 8; see the delivery audit. |

See [the human takeover guide](docs/HUMAN-TAKEOVER.md) for the ordered next steps. Do not reuse an unrelated application's database or credentials.

## Connect the dedicated database

The approved target is `uinavtzevjoskkymhakx`, organization `javqroqxdnqbgoqkzknt`, on the Free plan. No upgrade or pause of another project is required.

1. Verify the target and installed schema history before any SQL. The October 8 installation is complete; do not replay the initial bundle.
2. For a future empty initial installation, apply **only** `supabase/shared/migrations/20261003150827_shared_cfh_namespace.sql`. This reviewed bundle includes the three foundation migrations plus `20261008173854_task_development.sql` and `20261008173918_cfh_profile_notifications.sql`, transformed into `cfh` and `cfh_private`. Do not apply the five source migrations directly into `public`. Expose `cfh` through the Data API; never expose `cfh_private`.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the exact `NEXT_PUBLIC_SITE_URL`. This application does not require a service-role key in its web runtime. Keep provider credentials out of source control.
4. Configure this dedicated project's Auth Site URL as `https://cfh.retehost.com` and explicitly allow `https://cfh.retehost.com/auth/callback` plus any exact candidate-preview callback needed for acceptance testing. Configure and verify the Auth SMTP sender, delivery, rate limits, and recovery. GitHub OAuth remains unavailable until its provider credentials/callbacks are configured and `CFH_GITHUB_AUTH_ENABLED=true`. Auth mail and founder notification mail are separate delivery paths.
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
