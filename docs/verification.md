# Community workspace verification — September 28, 2026

The candidate replaces the demonstration homepage with a community workspace and a real founding project. No invented people, posts, projects, or outcomes are shown in the default mode.

| Check | Evidence |
| --- | --- |
| Production build and TypeScript | Passed on Next.js 16.3.6 |
| Domain, PostgreSQL and release-policy tests | 28 passed; all three migrations executed in PGlite |
| Chromium end-to-end suite | 12 passed, exit code 0 |
| Accessibility | No automated WCAG A/AA violations across ten working screens in both light and dark modes |
| Drafts | Conversation fields restored and cleared; project context carried into composer |
| Personal handoff | Save, restore, edit, Markdown export contents, and clear verified |
| Responsive navigation | Menu works; seven screens have no horizontal overflow at 390px |
| Theme | Light/Dark persist; System responds to OS appearance |
| Dependency audit | Zero known vulnerabilities in locked dependencies |
| Source credential scan | No known credential patterns in staged/tracked source; .env files excluded |
| Browser visual inspection | Production candidate inspected; no browser errors reported |

Database tests verify public/private isolation, profile and authority escalation denial, atomic claims and proposals, private saves and notifications, hidden thread/reply isolation, contribution-only membership, HTTPS submission evidence, independent review, invalidation of old approvals, stale-browser denial, and rate limits. Founding task fields match the public backlog exactly.

Browser tests exercise real project rooms and all six tabs, work filters and board views, proposal and conversation drafts, notebook exports, disabled unconfigured sign-in, review gating, public routes, and 404s for removed fictional records.

The initial browser run completed every test assertion but stalled during Windows web-server teardown; it was stopped. A separate managed production server was then used and the entire suite completed with exit code 0. No test was skipped or weakened.

## Limits

PGlite tests exercise real PostgreSQL SQL/RLS, not a hosted Supabase deployment. A dedicated database, OAuth/email setup, and multi-user staging verification remain pending. No hosted account or shared-posting success is claimed. Provider branch protection, private vulnerability reporting, reviewer staffing, and release-approver enforcement have not been verified.

The public GitHub adapter reads public repository activity and surfaces failures. The repository exists but the public source upload and Git-triggered deployment connection remain pending explicit owner approval after automatic approval review rejected that combined action. No deployment secrets are in contributor CI.

Automated accessibility scans do not establish full WCAG conformance. Human keyboard/screen-reader and usability assessment is a founding work item. Scale/load testing for thousands of contributors remains a later milestone.

Live deployment evidence is recorded separately in the release report. The earlier report, production-release-20260928.md, describes the superseded institutional demonstration.
