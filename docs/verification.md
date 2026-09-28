# Verification record

Verified locally on September 27–28, 2026.

| Check | Result |
| --- | --- |
| Next.js production build | Passed; all generated routes compiled |
| Strict TypeScript | Passed |
| Domain and PostgreSQL tests | 14 passed |
| Chromium end-to-end tests | 9 passed |
| Automated WCAG A/AA scan | No reported violations on home, contribution board, proposal form, project detail, and login in light and dark modes |
| Theme preference | Light/Dark persistence across reload; System responds to OS appearance |
| Mobile navigation | 390px viewport; menu links work; no homepage horizontal overflow |
| Browser console and runtime errors | None reported during desktop visual review |
| Dependency audit | Zero known vulnerabilities after updating the development CLI; production audit also clean |
| Original logo | SHA-256 matches the supplied file exactly |

Desktop captures are in `artifacts/home-light.png` and `artifacts/home-dark.png`.

Database checks executed the full SQL migration in PGlite, including PostgreSQL roles and row-level security. They verify public/private record separation, rejection of profile/role escalation, a second task claimant being rejected, atomic proposal/source creation, proposal ownership, duplicate handling, and the submission rate limit.

Browser checks also verify project navigation, filter intersections, Kanban, example-task claim restrictions, browser draft restoration, duplicate-project suggestions, search, transparent empty financial records, all specified public routes, and genuine 404 responses.

## Limits of this evidence

No dedicated hosted Supabase project, GitHub OAuth application, email delivery provider, or hosting deployment was provisioned. Provider-dependent authentication and shared writes are implemented but require configuration and real-provider staging verification. No production domain was changed.

Automated scans are not a complete WCAG conformance assessment. Screen-reader testing, community/domain review, and operating acceptance remain necessary before public launch. Administrative publication, GitHub synchronization, comment moderation, review tooling, and notification delivery are not active workflows; see architecture.md for their boundaries.
