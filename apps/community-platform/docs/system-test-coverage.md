# CFH system acceptance scope

This environment tests the actual application with synthetic identities and a loopback adapter backed by the canonical PostgreSQL migrations. It contains no production people or credentials. See [setup and boundaries](system-test-environment.md).

| Journey | Browser checks | Persistence and permission checks |
| --- | --- | --- |
| Anonymous discovery | Every main navigation destination, account redirect, phone menu, keyboard dismissal/focus, nested active navigation | Anonymous catalogue queries through the SDK and database policies |
| New contributor | Introduce, contribute, review, create private profile, reopen account | Own saved row read back; anonymous visibility denied |
| Profile editing | Duplicate username feedback/focus, retained edits, private/public state, public page | Unique constraint and private/public database reads |
| Conversations | Publish, independent reply, save, reopen workspace, remove saved item | Actual posts/replies/saved rows and other-person saved-item privacy |
| Shared work | Join project, claim, start, block/resume, submit evidence, exclude self-review, request changes, resubmit, independent approval and acceptance | Membership, assignment, work status, evidence, review version and completion in PostgreSQL |
| Notifications | Mark read, reload | Saved read timestamp; other-person notification privacy |
| Personal handoff | Commitments appear before optional notebook; keyboard expand/collapse; draft survives reload | Browser-local recovery state is separate from shared task state |
| Proposals | Save/reload draft, complete substantive sections, submit, reopen | Atomic proposal/evidence creation and author-only access |
| Failure and recovery | Injected profile-save failure retains edits and retries; public handbook/header remains available; transient profile reads recover through the installed SDK's retry behavior | One-shot HTTP failure, actual successful database operation and sanitized 503→200 read transcript |
| Persistent query error | Member-page error boundary, visible retry, public header and account reload recovery | Nonretryable test query error, then normal database read |
| Private contributor and sign-out | Participation guidance, account accessibility scan, sign-out, protected-page redirect | Private profile remains private; test cookie removed |

The system suite runs these journeys at 390px touch/mobile and 1440px desktop, with additional 320px reflow and 200% computed-text enlargement stress checks. Text enlargement is explicitly emulated and is not native browser zoom. It complements the production-build public browser suite (including search/filter, theme, local draft recovery, documents/downloads, public route and automated accessibility checks), the unit suite and the database tests. The database tests independently exercise wrong-user edits, authority escalation, competing claims, hidden threads, rate limits, self-review and stale-version rejection.

## Evidence rules

Use the actual test output and screenshots for the current candidate; this table is a coverage map, not a receipt that every scenario passed. `npm run system:verify` must report matching runtime source and migration fingerprints before final acceptance. A running snapshot must be restarted after runtime edits. Tests reset local records between scenarios and do not contact real people.

## Explicit boundaries

Cookie bootstrap substitutes for provider registration, email delivery, PKCE, external OAuth and session revocation. The adapter is a limited PostgREST-compatible transport; it is not hosted Supabase. External GitHub activity is deliberately unavailable. The suite does not test production hosting, real contributor participation, physical-device behavior or arbitrary external website destinations.

The current product has no member project/task creation or leave-project action. Those capabilities are not invented by the fixture environment. A research proposal does not create an accepted project, task acceptance does not authorize a release, and joining a project does not appoint a maintainer. Accessibility automation and expert walkthroughs are not participant research or full assistive-technology conformance.
