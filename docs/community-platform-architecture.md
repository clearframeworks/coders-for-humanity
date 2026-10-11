# CFH: a working community platform

Design and source review: October 8, 2026. This document distinguishes live evidence, implementation in this candidate, and work still required. It does not authorize activation, role grants, messages, Git pushes, or releases.

## What is actually running

`cfh.retehost.com` resolves to the dedicated Vercel project `coders-for-humanity` (`prj_K7Gr8c6SjKw4OtkJClmOcTNWpriB`). The observed production deployment is `dpl_BrGMZmcdAb7N1o5RtF39rDWRKees`, built from `clearframeworks/coders-for-humanity` commit `301c3cad06f6960b859dcf2a325ca02038062db5`. Recheck this before a release; a remembered commit is not live evidence. This project is separate from the frozen `clearframeworks.org` project.

Production has no configured environment variables in the October 8 provider inspection. The app therefore deliberately disables shared authentication and community mutations. Public pages, local browser drafts, and public GitHub reads can work while nobody can create a shared account. This is the immediate operational failure, not a reason to bypass identity checks.

The source already includes Supabase auth, profiles, project membership, posts, task claims, review submissions, an inbox, RLS, and narrow mutation functions. Before this candidate, the inbox only received discussion-reply notifications. There was no founder signup notification, durable email delivery, maintainer task creation UI, or way to return an abandoned claim. GitHub activity is a cached public read of one repository; it is not a synchronized delivery system.

The owner previously selected the shared Supabase project `retehost-cfw` (`msekcqxmwvxxxqcsdpfn`). The October 3 record reports database read-only protection and absent CFH schemas. The October 8 database connection attempt failed with `ECONNREFUSED`; the current database contents and writeability remain unverified. Never infer that the old read-only condition has cleared, disable database protection, delete EVE records, or buy capacity as part of an ordinary CFH migration.

## Architecture decision

Keep the existing Next.js modular application, PostgreSQL data model, and provider-managed identity. Add a small durable integration worker for email and GitHub events. Do not build a second Git host or a general remote-code execution service inside CFH.

| System | Authoritative for | Connection |
| --- | --- | --- |
| CFH application and `cfh` schema | Contributor profiles, public project context, tasks, claims, handoffs, discussions, acceptance decisions | Session-bound server actions and database authorization |
| Supabase Auth | Verified identities and sessions | PKCE callback; app-scoped cookie; identity UUID |
| `cfh_private` schema | Role configuration, audit events, outbox, integration delivery receipts | Unexposed schema, narrowly granted operator/worker functions |
| GitHub | Git objects, branches, issues, pull requests, code reviews, check runs, merge state | Canonical links now; least-privilege GitHub App in a later increment |
| Vercel | Preview and production artifacts, deployment records, hosting permission | Owner-operated release using verified provider evidence |
| Transactional mail provider | Delivery attempts, delivered/bounced outcomes | Durable outbox, scoped worker, verified sender and founder destination |

CFH membership grants participation, not repository write access. A task marked complete is not a merge or deployment command. A GitHub merge is not proof that a project delivered its promised real-world outcome.

## The complete human journey

1. **Join.** A visitor begins a profile, verifies email or a configured OAuth provider, and returns to the intended screen. Preserve the draft across callback failure and retry. Show only sign-in providers that have actually been configured. An existing shared Auth identity can join CFH without becoming an EVE or Retehost administrator.
2. **Set up a profile.** Save name, unique handle, interests, availability, and optional links. Email is never part of the public profile. Public participation and private account settings must be clear. A first persisted CFH profile records the membership milestone once; repeated login or profile edits do not create new-signup alerts.
3. **Find a project.** Each project has a problem, intended beneficiaries, objective, repository, current priorities, and appointed maintainers. Joining a project grants its contributor relationship only.
4. **Develop the task.** Discuss the need, define a small outcome, record context and acceptance criteria, nominate a real reviewer, and name dependencies. In this candidate an appointed project maintainer publishes a bounded task at `/work/new`. Other contributors propose work through the project conversation; a self-selected title cannot grant publishing authority. Persistent draft/revision editing remains a later increment.
5. **Claim and work.** An authenticated contributor with a profile claims an open task atomically. A database lock and one-assignment primary key prevent double claims. Unfinished dependencies block the claim; archived projects cannot receive new claims. Work moves through `CLAIMED`, `IN PROGRESS`, and optionally `BLOCKED`. People work in a Git branch or fork using their own provider access.
6. **Keep continuity.** A contributor who cannot continue leaves a public handoff and releases their claim from the workspace. The task becomes open, the former assignment is removed, submission evidence is cleared, and the submission version advances. Handoffs stay on the task. Work already in review or complete cannot be silently released. Maintainer reassignment, inactivity reminders, and cancellation are future explicit workflows, not permission to seize another person's assignment.
7. **Submit and review.** The contributor supplies evidence and requests review. A non-assignee project maintainer reviews the current submission version. Changes requested return work to `IN PROGRESS`; resubmission invalidates prior review. Acceptance completes the CFH task. The nominated reviewer is a stored UUID for routing; it does not remove the existing independent-maintainer checks or give that person exclusive control.
8. **Check and merge code.** For code work, link a pull request in an approved repository. Required checks run on the exact proposed head. The owner or an explicitly delegated reviewer approves the current candidate according to repository policy. The founder retains final release authority; no second human is invented when the owner is the only active operator. That owner exception does not change the app's task self-review rules.
9. **Preview and release.** Build a preview from the approved source. Associate the exact commit, preview ID, check results, review evidence, rollback coordinate, and owner approval. Deploy through provider controls, verify the production URL and critical journey, and record the release. App participants receive no hosting credentials.
10. **Operate.** The founder sees new members, unanswered requests, claims that need help, review backlog, failed deliveries, and integration health. Contributors receive relevant task and conversation updates. The system should expose actual progress and failures, not invented activity.

## State and data design

The existing `profiles`, `projects`, `project_members`, `project_maintainers`, `tasks`, `task_dependencies`, `task_assignments`, `reviews`, `notifications`, and audit log remain the core. The candidate adds task creation and `task_handoffs`, plus notification persistence described in the notification operations documentation.

| Transition | Required authority and evidence |
| --- | --- |
| Publish task | Maintainer of the active published project; valid scope, reviewer, and same-project dependencies |
| `OPEN → CLAIMED` | Authenticated profile, no current assignee, all dependencies complete |
| `CLAIMED → IN PROGRESS/BLOCKED` | Current assignee |
| `IN PROGRESS → REVIEW/BLOCKED` | Current assignee; HTTPS evidence for review |
| `BLOCKED → IN PROGRESS` | Current assignee |
| `REVIEW → IN PROGRESS` | Independent project maintainer requests changes against current version |
| `REVIEW → COMPLETE` | Independent project maintainer approved the current submission version |
| `CLAIMED/IN PROGRESS/BLOCKED → OPEN` | Current assignee supplies durable handoff; version changes invalidate stale review |
| Code merge or production release | Separate provider-enforced checks and owner/delegated approval |

The next data increment should add immutable `task_submissions` with numeric repository/PR IDs and exact head SHA; typed notification events and deep links; task revisions; GitHub delivery receipts; integration freshness; and release evidence. Never use a mutable PR URL alone as proof that an approved commit is unchanged. Existing HTTPS evidence links remain manual evidence until that integration is implemented.

## Founder notification contract

The durable event is **CFH profile created**, not an unverified email form submission and not every shared `auth.users` insert. The profile transaction records an event with a unique member/event key. A configured founder inbox receives it once. Delivery retries must not generate duplicate member alerts, and a mail failure must not undo a valid account.

Resolve the founder recipient from trusted operator configuration using a verified identity UUID. A public handle, claimed email address, `signup_platform` metadata, or editable profile field must never choose an administrator, role, or delivery recipient. Keep raw email and provider receipts private. An outbox worker needs a bounded lease, retry backoff, stable idempotency key, attempt count, delivery status, and exhausted-retry visibility. A queued event is not evidence of delivered mail. Test actual receipt and a bounce/failure before calling email notifications operational.

Later event types should cover claim/release, review requested, changes requested, acceptance, and conversation replies. Make preferences explicit and distinguish personal updates from founder operational alerts. Until transport is connected, report the exact available channel and pending setup honestly.

## Git and hosting integration

GitHub remains the Git host. Existing public source is available at `https://github.com/clearframeworks/coders-for-humanity`; CFH should make the repository, issue, pull request, checks, and preview reachable from each task.

Start the GitHub App with approved repositories only and read access to metadata, issues, pull requests, checks/statuses, and deployments only when needed. Store numeric installation/repository/user IDs. Keep private keys and installation tokens server-side; give previews and untrusted code no production credentials. Authenticate webhook raw bodies, bound payloads, persist unique delivery IDs, acknowledge promptly, and process events idempotently. Treat private-repository data as private even if a CFH project is public. Refresh authorization after installation removal or repository visibility changes. See [GitHub App guidance](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/best-practices-for-creating-a-github-app) and [webhook delivery guidance](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks).

Adding issue-creation or branch/push abilities needs a separately scoped write design. A user clicking a composer link does not create an issue. Never put an owner's broad personal token behind a contributor button. Re-read provider checks and current head before merge or release; webhook arrival alone is not an authorization decision. Preserve required `secret-scan`, `dependency-audit`, and `verify` checks, including for owner-operated work.

## Trusted bootstrap and activation order

1. Restore ordinary access to the previously approved Supabase project and inspect capacity/read-only status. Use a separately approved recovery/capacity procedure if necessary. Preserve other applications and their data.
2. Verify whether `cfh` and `cfh_private` exist and inspect migration history. If absent, use only the generated shared CFH bundle. Historical dedicated-project migrations contain broad public-schema operations and must never be applied directly to the shared project. If any CFH schema already exists, reconcile its version and generate an incremental migration; never replay schema creation blindly.
3. Expose `cfh` with explicit grants and RLS, preserving every existing exposed schema; never expose `cfh_private`. Preserve the shared Auth Site URL, callbacks, and email hook; append exact CFH callbacks rather than replacing other apps' configuration. [Supabase custom schema documentation](https://supabase.com/docs/guides/api/using-custom-schemas).
4. Configure the isolated CFH preview with the correct project URL, publishable key, canonical site URL, and actually enabled providers. The app's normal runtime needs no service-role key. Untrusted preview code must not receive shared production database credentials.
5. Have the founder verify an account and create its CFH profile. In a trusted administrative session, independently match the authenticated identity UUID against the founder's verified provider account. Check that `cfh.profiles.id` is exactly that UUID. Do not grant privilege based on username, signup metadata, or a browser-supplied role.
6. Bootstrap `cfh.project_maintainers(project_id,user_id)` for the founder's verified UUID and the platform project `cf000000-0000-4000-8000-000000000001`, using an operator-only transaction and audit record. Appoint further maintainers only by explicit owner delegation. Configure the founder notification recipient by that same trusted mapping using the notification migration's documented operator path; grant no direct client mutation of recipient settings.
7. Prove email delivery and callback, profile save, duplicate handle handling, visibility, sign-out, and at least two-user permission isolation. Prove task creation, dependencies, competing claims, release/handoff, requested changes, resubmission, stale-review denial, and completion. Verify founder inbox plus actual external delivery separately. Inspect database advisors after migration.
8. Run required CI, review the exact candidate and rollback coordinate under CFH owner policy, deploy, and verify real signup on `cfh.retehost.com`. Production is not repaired until that end-to-end result is observed.

Bootstrap appointments and shared-service configuration are explicit operator actions. No source migration silently makes the first visitor an administrator. No application role grant alters EVAN/EVE runtime authority.

The notification configuration is `cfh_private.founder_notification_settings(singleton,user_id,email)`. A privileged operator inserts the single row with `singleton=true`, the independently verified founder Auth/profile UUID, and the verified recipient address. It is not writable through an application configuration RPC. The founder profile must already exist. Previously captured profile events can then be routed once to that founder. Follow [the notification operating instructions](founder-notifications.md) for the exact setup and verification procedure.

The mail worker uses a short-lived server-held JWT for the `cfh_notification_worker` role, limited to the notification claim/completion functions. Activation requires `CFH_NOTIFICATION_CRON_SECRET` (at least 32 characters), `CFH_NOTIFICATION_WORKER_JWT`, `CFH_NOTIFICATION_SENDER_EMAIL` (a verified sender), `CFH_NOTIFICATION_RESEND_API_KEY`, and `CFH_EMAIL_NOTIFICATIONS_ENABLED=true`. These values belong in the approved server environment, never source or a contributor preview. The worker role must not acquire unrelated CFH, EVAN, or EVE data privileges. Record token rotation, scheduling, and delivery verification before enabling the worker.

## Delivery priorities and proof

| Priority | Deliverable | Completion evidence |
| --- | --- | --- |
| P0 | Working signup, callback, profile, founder alert | A real verified CFH member can return and save; founder receives the right event; repeat login does not resend |
| P1 | Useful contributor loop | Maintainer publishes work; two identities exercise claim/release/review; unauthorized and stale actions are rejected |
| P2 | GitHub evidence in the task | Current PR head/checks/reviews/preview display with timestamps; duplicate/out-of-order/revoked webhooks are handled safely |
| P3 | Controlled owner release | Failing checks block release; authorized candidate deploys; rollback and deployed SHA are verified |
| P4 | Community operations | Reports/moderation, onboarding help, backlog ownership, mail failure handling, backups, measured capacity and retention |

The architecture agent owns workflow/data contracts; identity and notification work owns enrollment/delivery; delivery security owns GitHub/CI/provider boundaries; the integrating agent verifies the whole human journey. These are development responsibilities, not new production roles. Start with a small real pilot, then measure time to verified signup, time to first useful contribution, review wait, delivery failures, and verified outcomes before expanding the community.

## Remaining limits of this candidate

Task authoring currently publishes a new task; there is no persistent editable task draft, cancellation, maintainer reassignment, or task revision history. Review evidence remains a versioned HTTPS link, not automatically verified code. GitHub writes, webhook ingestion, check synchronization, and automated production release are not implemented. Operational notifications require trusted recipient setup, a connected sender/worker, and delivery proof. Hosted database and authentication acceptance cannot be inferred from local PGlite or browser tests.
