# Architecture and boundaries

The platform is a modular monolith. Public pages are server-rendered. The catalogue adapter chooses a labelled demo dataset or Supabase; a connection error never becomes invented data. Financial and outcome adapters are separate so examples cannot accidentally become institution-wide metrics.

The PostgreSQL schema normalizes programs, problems, projects, memberships, maintainers, repositories, milestones, deployments, metric definitions, impact observations, tasks, assignments, skills, dependencies, proposals and sources, decisions, comments, reviews, organizations, partners, sponsors, finances, and notifications. Auth identities stay in `auth.users`. Public profiles omit email. Flexible JSON is used only for a validated transactional function input, not as the storage model for core entities.

RLS is enabled everywhere. Published records are readable anonymously. A profile is visible only if public or owned by the caller. Proposals and their sources are author-only. Public catalogues should not expose unreviewed proposals. A future moderation console needs an explicit, audited reviewer read path; this implementation does not quietly grant every authenticated user reviewer access.

Privileged functions live in the private schema, have fixed search paths, verify auth.uid(), and have narrowly granted execute permissions. Public RPC wrappers are security invokers. Task claims lock the row and check publication, demonstration status, dependencies, and availability before creating an assignment and audit event. Proposal submission validates all sections and inserts sources in the same transaction.

Next.js server actions also validate the actual origin and user, returning useful messages to the UI. Claims and proposals are rate-limited in PostgreSQL. Direct access to lower-level write tables is denied, so using the Data API does not bypass these invariants.

## Current limits

- Search is a bounded cross-entity catalogue search; PostgreSQL full-text indexes are prepared for a paginated search endpoint.
- Example data is held in source and never inserted into production.
- GitHub synchronization and institutional editorial/admin interfaces are extension points, not active services.
- Comments, reviews, notifications, and governing roles have normalized storage and read boundaries; their moderation/delivery workflows must be implemented with explicit authorization before enabling writes.
- Profile skills are normalized but skill editing is an extension to the current basic profile form.
- Browser draft storage is local, explicit, and removable; it is not a server-side draft vault. Do not enter confidential information.

The public site is intentionally honest about these operating limits. Provider activation, governance appointments, legal registration, project acceptance, and measured outcomes cannot be produced by generating software alone.
