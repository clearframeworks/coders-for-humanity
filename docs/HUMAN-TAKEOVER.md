# Human takeover

The immediate goal is to prove one complete human contribution with independent review and a useful handoff. The longer-term goal is a community where thousands of people can coordinate in small accountable project teams.

This document describes the source handoff. Use the dated production release record for the deployed candidate and verification results; do not assume this working tree is the active deployment.

## Start here

- **Public site:** [cfh.retehost.com](https://cfh.retehost.com).
- **Dedicated source destination:** [clearframeworks/coders-for-humanity](https://github.com/clearframeworks/coders-for-humanity). The repository exists, but source upload awaits explicit approval.
- **Owner account:** `clearframeworks`. This identifies the repository owner, not an appointed multi-person security team.
- **Founding project:** `community-platform`, UUID `cf000000-0000-4000-8000-000000000001`.
- **Source of work briefs:** `lib/harness.ts`; matching database records are in the third migration.
- **Boundaries:** [SECURITY.md](../SECURITY.md), [harness-team.md](harness-team.md), [architecture.md](architecture.md), and [github-integration.md](github-integration.md).

The interface provides community/project rooms, a real backlog, public GitHub reads, local discussion drafts, and a local handoff notebook. Notebook exports can carry context to another person now. They are not shared database records or task claims.

Account infrastructure has not been provisioned. Shared posts, member records, assignments, joins, notifications, and review mutations remain closed until dedicated hosted authentication and data isolation are verified. Three migrations are implemented and locally tested; this is not a hosted acceptance result.

## Decisions required from the owner

1. **Source publication:** explicitly approve uploading the CFH source to the public repository, or choose another visibility arrangement. The earlier public push and deployment-link operation was rejected by automatic approval review; it was not executed. Publication and automatic production deployment are separate decisions.
2. **Database organization and cost:** choose the Supabase organization for a dedicated CFH project, inspect the provisioning quote, and approve the cost before creation. Do not borrow an unrelated application's database.
3. **Independent people:** appoint a project maintainer, a harness/security reviewer, and a release steward who have consented to their responsibilities. Establish a private vulnerability-reporting route and conduct coverage. The current role definitions are unstaffed.
4. **Operating scope:** agree the first project's membership and pilot participants, what counts as accepted work, and who can approve provider configuration or release changes.

A standing instruction to build or deploy does not supply a Supabase organization/cost choice or overturn a recorded approval-review rejection. These unresolved decisions are not reasons to fabricate operational services.

## First operating sequence

1. Read the actual production release record. Resolve the public domain to its active deployment and record its rollback coordinate before any replacement.
2. Reproduce the source locally using README.md. Run typecheck, database/domain tests, production build, browser checks, and dependency audit. Preserve exact results with the candidate source revision.
3. After publication approval, upload the reviewed dedicated source, excluding local environment files and secrets. Verify that contributors can obtain the intended revision.
4. Configure repository protections and review rules. Keep contributor CI read-only and without production credentials. Prove failing checks and self-approval cannot authorize a merge; record the provider settings and test evidence.
5. After organization/cost approval, provision dedicated staging and production infrastructure as appropriate. Apply all three migrations in order, configure exact auth callbacks and email delivery, and test real-provider sessions.
6. Exercise anonymous, two-member, assigned-contributor, and independent-maintainer identities. Attempt cross-user reads/writes, role escalation, duplicate claims, hidden-thread access, stale-review acceptance, and unauthorized task completion. Test expired/revoked sessions and restore a backup.
7. Run the first human pilot: find a task, read context, agree the contribution, discuss a blocker, deliver evidence, get independent feedback, resubmit if needed, accept, and hand off. Include accessibility and a non-code contribution.
8. Review the exact release candidate with the appointed steward. Verify provider release permissions, isolate preview credentials, record approvals and rollback, deploy only the approved candidate, and verify its resulting URL.

Task acceptance is never permission to deploy. The local release-policy model, CI files, and CODEOWNERS are supporting tools; no provider-enforced security guarantee is claimed until the humans test and record those controls.

## Seven founding work briefs

These are actual open tasks requested for this platform, not fictional completed work. No assignee or independent approval is implied.

| UUID suffix | Work | First useful deliverable |
| --- | --- | --- |
| `000000000001` | Establish the independent harness team | Consenting role holders, coverage, conflicts policy, and evidence that repository gates deny unsafe changes |
| `000000000002` | Verify accounts and data isolation with real users | Hosted staging permission matrix and reproducible positive/negative session tests |
| `000000000003` | Test the complete contribution journey for accessibility | Keyboard/screen-reader findings for both themes, mobile, and zoom |
| `000000000004` | Write the first human maintainer handoff | A newcomer reproduces setup, understands blockers, and identifies the real release owner without this chat |
| `000000000005` | Design a respectful first contribution experience | Anonymized findings from at least three consenting testers, including non-code and handoff needs |
| `000000000006` | Exercise the review boundary against hostile contributions | Safe staging tests for self-approval, stale evidence, escalation, and separation from deployment |
| `000000000007` | Rehearse a release and rollback with a human steward | Evidence of denied unauthorized release, approved candidate, and tested recovery |

Each full task UUID has prefix `cf100000-0000-4000-8000-`. The full context, dependencies, acceptance criteria, and requested reviewer role are in the work brief. Do not mark a task complete because this document exists.

## Handoff format

Every accepted contribution should leave:

- Its objective, affected people, scope, and links to decisions.
- The exact changes and their source revision or deliverable.
- Reproducible verification evidence, including limitations and failures.
- Remaining work, blockers, dependencies, and the next useful step.
- The independent review, submission version, and any unresolved risk.
- The responsible next person or the expertise still needed, without invented assignments.

Use the workspace notebook to prepare this locally and export Markdown. When shared accounts are connected, put the accepted context in project records with appropriate visibility and revision history.

## Work after the first pilot

Add project-local working groups and a linked context graph; staff moderation and appeal handling; replace bounded catalogue loads with pagination and indexed search; add durable notification and ingestion workers; then introduce permission-aware realtime updates and a read-only GitHub App. Load-test realistic project membership and reviewer queues before advertising capacity for thousands of contributors.

Measure whether people can find useful work, obtain independent review, and continue after someone leaves. Do not substitute member counts, likes, or generated activity for verified project outcomes.