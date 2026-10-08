# CFH platform candidate — October 8, 2026

Baseline: live `301c3cad06f6960b859dcf2a325ca02038062db5`, plus the preserved signup preparation `dd0353d26b1f864b37b4da55fa19fa5e023db67f`. Work is isolated in `cfh-platform-20261008` on branch `codex/community-platform-20261008`. The original checkout is unchanged.

## Implemented

- Explicit GitHub provider enablement and a bounded data-read prerequisite before authentication starts.
- Maintainer task publication with reviewer identity and same-project dependency enforcement.
- Claim release with a public handoff, stale-submission invalidation, and archived-project claim protection.
- Durable CFH membership events, private founder inbox notices, and a leased, idempotent email worker with a restricted database role. Private profiles produce anonymous notices.
- Current-commit GitHub check and Vercel status visibility, without merge or deployment authority.
- Portable CFH-only schema generation and minimal dependency security patches.
- Architecture, operator bootstrap, notification activation, and delivery evidence documentation.

## Local evidence

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| Unit and PostgreSQL permission tests | 57 passed |
| Optimized Next.js 16.3.8 build | Passed |
| Chromium browser and automated accessibility suite | 30 passed |
| npm dependency audit | 0 vulnerabilities reported |
| Repository credential-pattern scan | No matches in tracked candidate source |
| Integrated security review | No remaining must-fix findings in reviewed signup, notification, and task authorization paths |

Database tests use PGlite with anonymous, member, maintainer, and worker roles. Browser tests run with shared accounts disconnected. Mail transport tests are mocked. These checks do not establish hosted email delivery, authenticated browser operation, real database writes, complete accessibility conformance, or complete secret detection.

## Live activation remains blocked

The CFH Vercel project's production environment has no Supabase connection configuration. Current SQL connection attempts to the previously selected shared project failed with connection refusal and PostgreSQL `57P03`. October 3's read-only/capacity report remains historical; current database size and schema state could not be rechecked.

No database migration, shared Auth change, founder role grant, sender activation, production promotion, or real notification was performed. The preview is for source/interface review. Before activation: recover normal provider access, reconcile schema history, apply reviewed CFH-only changes, configure exact Auth callbacks and trusted founder identity, verify signup and two-user isolation, then prove a real founder notification. See the architecture and notification runbooks for the order and boundaries.
