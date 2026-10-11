# CFH human maintainer handoff

Updated October 11, 2026. Coders for Humanity's first goal is one complete human contribution: choose useful work, agree its scope, collaborate, submit evidence, receive review, and leave enough context for someone else to continue. The real founding project is **Community platform**; the other projects in the demo fixture are illustrative concepts. See [the founding project](../lib/founding.ts) and [the seven founding work briefs](../lib/harness.ts).

Start from the [October 8 production release record](../artifacts/supabase-20261008/production-release-80830a8.txt). It records a connected release, superseding earlier statements that account infrastructure was unprovisioned. Its remaining signup and notification acceptance checks are still open in that record. Dated evidence does not certify today's live provider state; resolve the production alias again before a release.

## Source and release evidence

- Public site: [cfh.retehost.com](https://cfh.retehost.com).
- Source repository: [clearframeworks/coders-for-humanity](https://github.com/clearframeworks/coders-for-humanity).
- Repository and final release owner: `clearframeworks`, under [owner authority](owner-authority.md).
- Founding project: `community-platform`, UUID `cf000000-0000-4000-8000-000000000001`.
- This handoff contribution: `cfh-handoff`, task UUID `cf100000-0000-4000-8000-000000000004`. Its acceptance criteria and requested maintainer review are in [the work brief](../lib/harness.ts).

The October 8 release record identifies source `80830a8e537d73fa06ca303156c6edddeb3b07f6`, deployment `dpl_2AruvPhA272k4XJyBL526HMtikCD`, and [its immutable URL](https://coders-for-humanity-r1wa5aea7-clearframeworks-projects.vercel.app). It records a match for all 171 deployed source hashes, successful [CI run 37855912045](https://github.com/clearframeworks/coders-for-humanity/actions/runs/37855912045), and rollback deployment `dpl_BrGMZmcdAb7N1o5RtF39rDWRKees`.

That release used owner-authorized Vercel delivery after ordinary merging was blocked. The record says the pull request remained open and `main` remained at `301c3cad06f6960b859dcf2a325ca02038062db5`. Obtain the intended full revision explicitly; checking out `main` alone does not reproduce the recorded release. Reconcile the release branch and `main` before a subsequent release.

## Implemented and verified boundaries

| Boundary | Evidence and limit |
| --- | --- |
| Public workspace | Source provides community/project rooms, founding tasks, public GitHub reads, appearance settings, local discussion drafts, and a handoff notebook. See [README](../README.md) and [workspace iteration](workspace-iteration.md). Local notes stay on the device; export them before clearing browser data. |
| Shared work | Source implements email account entry, profiles, task publication and claims, claim release with handoff, conversations, inbox notices, and review actions. Implementation does not establish a completed hosted contribution. See [platform architecture](community-platform-architecture.md) and [release record](../artifacts/supabase-20261008/production-release-80830a8.txt). |
| Database | October 8 records describe an approved dedicated Free Supabase project `uinavtzevjoskkymhakx`, installed `cfh`/`cfh_private` schemas and row-level permissions, plus the incremental native mail migration. The initial namespaced bundle incorporates five source migrations. See [installation](../supabase/shared/README.md) and [hosted setup evidence](preview-20261008.md). Do not replay the installed initial bundle. |
| Account connectivity | The release record documents production configuration, `/join` HTTP 200, an enabled signup form, and configured dedicated Auth SMTP. Actual email receipt, callback, and a saved profile remain acceptance checks. GitHub OAuth was disabled in the hosted setup record. |
| Founder alerts | Event, inbox, outbox, and native dispatch infrastructure exists. The release record leaves founder bootstrap, a dedicated Vault sending credential, Cron activation, and actual delivery pending. Signup SMTP and founder alert delivery are separate. Follow [founder notifications](founder-notifications.md). |
| Review and release | The [October 8 delivery audit](delivery-audit-20261008.md) records required GitHub checks and owner review rules. These are dated provider observations, not a fresh certification. Defined harness roles do not establish that consenting people have been appointed. See [owner authority](owner-authority.md) and [harness charter](harness-team.md). |

Earlier provisioning and deployment statements in README, the candidate verification, preview notes, architecture, and release checklist describe earlier stages. For the recorded production source and activation status, use the later production release record above. Keep historical evidence intact and recheck provider state before changing it.

## Run the source locally

Use Node.js 22 or newer and npm, matching the scripts in [package.json](../package.json) and setup in [README](../README.md). Work in a durable checkout of the intended revision and read its `AGENTS.md`. For framework code changes, also read the relevant installed Next.js guides required there.

Run from the repository root:

```powershell
npm ci
if (-not (Test-Path -LiteralPath '.env.local')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env.local'
}
npm run dev
```

Open [localhost:3100](http://localhost:3100). For the public foundation without a database, keep `CFH_DEMO_MODE=false` and leave Supabase configuration unset. This uses the real founding project and tasks. `CFH_DEMO_MODE=true` is an isolated development fixture, not the production catalogue. With Supabase configured, catalogue reads use the database and surface failures. See [catalogue selection](../lib/catalog.ts).

For approved hosted testing, use the dedicated CFH project's publishable configuration and exact environment origin. Keep local environment files out of source control. The web runtime does not require an administrator/service-role key; provider and worker credentials belong in their separately approved configuration. Follow the [installation runbook](../supabase/shared/README.md) rather than applying the source migrations into `public`.

## Verify a contribution

The [CI workflow](../.github/workflows/checks.yml) defines mandatory `secret-scan`, `dependency-audit`, and `verify` jobs. From the repository root, reproduce the relevant checks:

```powershell
python .github/workflows/scan-secrets.py
npm audit --audit-level=high
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The secret scanner requires Python 3 and reads paths returned by `git ls-files`; untracked new files are omitted. Review new files and stage only the intended contribution files before relying on the local scan. CI scans the tracked pull-request checkout. Stop the development server before browser tests: Playwright starts a fresh production server on port 3100 and refuses to reuse an existing one. Production mode manually uses `npm run build`, then `npm run start`. See [Playwright configuration](../playwright.config.ts).

Record the exact revision, commands, results, and limitations with the contribution. The October 8 release record reports 59 local unit/database tests and passing TypeScript, credential scanning, build, dependency audit, and browser/accessibility checks on `80830a8`. Those results belong to that revision. PGlite permission tests and mocked transport tests do not prove hosted sessions or delivered mail; automated accessibility tests do not establish complete WCAG conformance. See [candidate verification limits](candidate-verification-20261008.md).

## Carry a task through review

1. Choose an existing work brief and agree objective, acceptance criteria, dependencies, and reviewer with its maintainer. Research, design, documentation, translation, testing, field review, and domain expertise are welcome alongside code. Follow [CONTRIBUTING](../CONTRIBUTING.md).
2. Confirm responsibility through the shared claim workflow when available. A local notebook or exported plan does not claim a task, submit work, or request review. If the shared journey is blocked, record that blocker and obtain an agreed handoff rather than implying a claim succeeded.
3. Work in a focused branch or fork. Link the task, changed behavior or deliverable, verification evidence, and limitations in a pull request. CFH's [GitHub adapter](github-integration.md) reads public activity; it does not push, merge, or deploy code.
4. Submit the current work for the designated review, address feedback, and attach evidence for the latest submission. Task acceptance and repository review remain separate. Leave the next person the context and remaining work below.
5. Release only with the owner's scoped authorization or explicit delegation and required checks on the final commit. The delivery audit records automatic delivery from `main`; treat merging to that branch as a production action. Recheck the active deployment, exact candidate, provider controls, and rollback coordinate before releasing.

`clearframeworks` is the final release authority. Their explicit candidate approval is sufficient human authorization even when they authored the change; it does not waive automated checks. Other contributors need owner approval or explicit delegation. Agent review is not independent human review, and owner approval must not be reported as independent review. Profile creation, project membership, and task completion grant no merge, hosting, or privileged database authority. See [owner authority](owner-authority.md) and [AGENTS](../AGENTS.md).

## Next acceptance work

The next useful operating milestone is the first verified human contribution. Resolve these remaining checks in the appropriate approved environment and attach sanitized evidence:

- Complete real email-link receipt, callback, saved profile, and sign-out; exercise anonymous, member A, member B, and maintainer sessions. Verify cross-user isolation, role escalation rejection, claim races, hidden conversations, stale-review rejection, and revoked-session behavior. See [architecture acceptance](community-platform-architecture.md) and the [account work brief](../lib/harness.ts).
- Verify the founder's confirmed identity and inbox, then obtain scoped activation approval before configuring the separate worker credential and Cron. Prove an actual founder alert arrives using [the notification runbook](founder-notifications.md).
- Agree pilot participants and appoint consenting maintainer/security/release responsibilities as needed. Complete keyboard, screen-reader, mobile, both-theme, and zoom testing; leave findings and retest evidence. See [the harness charter](harness-team.md) and [founding work briefs](../lib/harness.ts).
- Reconcile repository and deployed revisions, record current provider enforcement, and rehearse recovery before the next approved release. Follow [owner authority](owner-authority.md) and [release checklist](release-checklist.md), updating its historical provisioning assumptions against the release record.

This documentation contribution still needs project maintainer acceptance. The two Luna agents assist with preparation and evidence review; they do not appoint human reviewers, certify hosted acceptance, or mark the task complete.

## Leave the next person a usable handoff

For each contribution, include its objective and scope; exact revision or deliverable; decisions and changed behavior; reproducible check results and limitations; unresolved blockers and dependencies; review of the current submission; and the next useful action with the responsible person or expertise still needed. Use real assignments and keep private data and credentials out of the handoff.

The workspace notebook can save and export Markdown locally. Put accepted context into shared project records when that workflow is verified and available, with appropriate visibility and revision history. A document's existence is not evidence of completed task acceptance or a measured public-benefit outcome.
