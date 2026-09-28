# Architecture and boundaries

CFH is a social workspace organized around human projects. The intended unit of coordination is a small project team with a shared goal, current context, bounded tasks, independent reviewers, and a usable handoff. Thousands of people should be able to participate across many such teams without a single global conversation becoming the work queue.

The current application is a modular Next.js/TypeScript monolith. Public pages render primarily on the server; interactive client code handles navigation, themes, drafts, handoffs, and protected forms. This is a foundation for the model, not evidence that thousands of concurrent members have been supported.

## What exists now

The public foundation contains one real project, Community platform, and seven unassigned work briefs with stable UUIDs in `lib/harness.ts`. The database seed uses the same identities and does not overwrite task progress. No fictional people or activity are included in the foundation catalogue.

The interface has community discussion routes, project rooms, a contribution board, people directory, personal workspace, inbox, review queue, and harness guidance. Public GitHub activity comes from the actual repository API. A conversation draft and a handoff notebook work locally before account provisioning. Local drafts are clearly device-only and can be cleared; notebook handoffs export as Markdown.

Three migrations implement normalized programs, projects, evidence, memberships, maintainers, repositories, tasks, dependencies, assignments, proposals, decisions, profiles, posts, saved posts, reviews, finances, notifications, audit records, and rate limits. They have been exercised locally in PostgreSQL-compatible tests. A hosted CFH database and authentication service have not been provisioned or verified.

## Data and authority boundaries

| Boundary | Rule |
| --- | --- |
| Public catalogue | Read source-defined founding records without a database; read authorized database records once configured. A configured database failure is an error, never fabricated fallback activity. |
| Identity | Auth identities stay in `auth.users`. The public profile excludes email. Public participation requires authenticated identity and an opted-in public profile. |
| Membership | Joining a published project grants a contributor relationship, not maintainer status or release permissions. |
| Conversations | Root conversations and one level of replies have explicit publication boundaries. Hidden roots also hide their replies. Saved-post records and notifications are owner-scoped. |
| Tasks | Claims lock the task row and validate availability, publication, and dependencies. Only the assignee can make allowed contribution-state changes. |
| Reviews | Submitting for review requires an HTTPS evidence link and increments the submission version. An independent project maintainer reviews the current version; stale or self-authored approval cannot complete the task. |
| Deployment | Task acceptance never triggers a deployment. Release authority remains outside the community mutation API. Provider enforcement is not established by an in-app policy display. |
| Local notebook | Browser storage only, versioned and bounded, not encrypted or synchronized. Saving a note grants no task, review, or release authority. |

Database tables use row-level security. Privileged functions live in a private schema with fixed search paths, explicit identity checks, and narrow execute grants; exposed wrappers are security invokers. Direct table mutation is restricted. Server actions additionally validate the request origin and session. These checks are defense in depth, not a substitute for hosted verification.

No runtime service-role key is required. Contributors and untrusted pull-request runners must never receive production credentials. A repository file, role title, or client-provided review flag cannot grant production authority.

## Current limitations

- Shared posts, account profiles, claims, joins, saved records, and inbox activity require approved hosted provisioning and complete authentication tests.
- Moderation policy and hidden-record boundaries exist, but an operational moderation console, trained moderators, appeals process, private reporting coverage, and abuse response staffing remain to be built or appointed.
- The public catalogue has a 1,000-row bound per entity. Discussion, inbox, and GitHub reads are bounded. These are initial safety limits, not complete cursor pagination or scalable search.
- The GitHub adapter performs cached public reads. It does not synchronize private repositories, receive webhooks, create issues, merge code, or deploy.
- No realtime transport, durable event worker, attachment service, global ranking engine, or distributed search service is running.
- Institutional roles, reviewer authority, and member visibility have database models. Role appointment, repository enforcement, and human consent remain explicit operating responsibilities.
- Current source, deployed source, and verified provider state must be distinguished in release evidence. The current working tree is not automatically production.

## Roadmap for thousands of humans

Each step should prove a complete human workflow before broadening the surface or membership.

1. **Prove one complete contribution.** With two contributors and an independent maintainer in staging: join a project, understand its goal, agree a task, discuss a blocker, submit evidence, request changes, resubmit, accept, and hand off. Include a non-code deliverable. Verify all negative permission cases.
2. **Make project context navigable.** Add linked milestones, decisions, evidence, task dependencies, and handoffs with authors and revision history. A discussion can propose a decision; an accountable maintainer records its accepted outcome. Do not treat chat volume as shared understanding.
3. **Create project-local teams.** Introduce working groups with explicit scope, membership, review responsibility, and escalation paths. Delegate within a project; do not grant organization-wide power as a reward for activity. Add workload and availability signals that contributors control.
4. **Operationalize moderation and safety.** Staff conduct and security response separately, provide private reporting, add reports/appeals and narrowly scoped moderation actions, and audit privileged changes. Rate limits, invitation policies, and anti-abuse measures should match observed risks and remain reviewable.
5. **Scale the read paths.** Replace catalogue-wide loads with indexed cursor pagination, filtered queries, and bounded search endpoints. Define measured latency and concurrency targets, profile representative data, and load-test permission-aware queries. Keep project scope in keys and access policies.
6. **Add durable coordination events.** Persist events through a transactional outbox or equivalent queue design. Use idempotent workers for notifications and GitHub ingestion, with retry limits, dead-letter handling, and auditability. Realtime delivery should notify clients to refresh authorized state; it must not become an alternative access-control system.
7. **Expand the GitHub connection.** Use a least-privilege GitHub App on approved repositories, initially read-only, with signed webhook verification and repository-ID mapping. Keep source and pull requests canonical on GitHub while CFH holds human context and handoffs.
8. **Test federation between projects.** Connect shared dependencies, reusable components, and cross-project review capacity without merging every project's authority or private data. Measure reviewer backlog, time to useful contribution, continuity after handoff, and verified outcomes rather than popularity.

These are proposed increments. No queue, realtime service, moderation team, or large-scale capacity is implied to be deployed by this document.

## Operating ownership

The harness charter defines contributor, maintainer, security reviewer, and release-steward responsibilities. Those independent roles are currently unstaffed, and provider-level review gates have not been verified. The owner must appoint consenting people, choose and fund the dedicated providers, verify protections, and record the first human pilot. See [HUMAN-TAKEOVER.md](HUMAN-TAKEOVER.md).