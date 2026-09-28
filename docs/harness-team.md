# Harness team and human takeover

The harness is the group responsible for safe contribution boundaries, independent review, release evidence and incident response. Its purpose is to let many people contribute without giving every contributor authority over the deployed system.

## Current state

The platform has review policy, source-level access controls, local database tests, CI definitions and founding work briefs. No independent harness staff, live branch protections, private reporting route or production approval integration is asserted by these files. Confirm actual provider settings and workflow runs before treating a gate as enforced. The repository owner is `clearframeworks`; CODEOWNERS assigns that existing account only. It does not create a security team.

## Authority

| Role | May do | Must not do |
| --- | --- | --- |
| Community member | Discuss, propose, ask for help and join a published project | Grant roles or acquire secrets |
| Contributor | Claim work, submit evidence and open pull requests | Approve own work or deploy |
| Project maintainer | Review scope, behavior, tests and handoff | Treat task completion as deployment authorization |
| Harness reviewer | Review threats, dependencies, data access and infrastructure changes | Approve changes they authored |
| Release steward | Approve reviewed commit and preview, record rollback, verify release | Substitute build success for independent review |
| Repository owner | Appoint consenting reviewers and configure provider enforcement | Claim independence when only one person reviewed |

The target policy uses distinct contributor, maintainer reviewer, security reviewer and release steward identities. Until the independent team exists, releases remain explicitly owner-operated and must record that staffing limitation. Do not fabricate approvals to satisfy the policy. Every code change receives security triage; changes to authentication, permissions, data, dependencies, workflows or release infrastructure require specialist review.

## Mandatory contribution path

1. Start from a work brief with purpose, context, acceptance criteria, dependencies and reviewer.
2. Work on a branch or fork. Untrusted code receives no production secrets or hosting credentials.
3. Open a pull request. Attach tests, screenshots where relevant, limitations and a handoff.
4. Run `secret-scan`, `dependency-audit` and `verify` on the proposed commit. The workflow uses a read-only token, disposable hosted runners, immutable action references and no deployment step. It uses `pull_request`, never `pull_request_target` to execute contribution code.
5. An independent maintainer reviews behavior and acceptance. The harness reviewer records the security assessment. Required reviews must be fresh for the current commit.
6. The release steward reviews the exact preview, source SHA, check evidence, security assessment and rollback coordinate. Provider-enforced approval, not a browser field, authorizes production.
7. After release, record deployment ID, domain, commit, approvers, verification and rollback. An incident pauses releases and triggers a documented recovery decision.

## Configure and verify provider gates

For `main`, configure a GitHub ruleset that blocks deletion and force pushes, requires pull requests, fresh approvals from people other than the last pusher, CODEOWNERS review, conversation resolution and the three required checks. Require the latest branch state where practical. Do not allow contributor or automation bypass. Verify with a disposable failing pull request and a self-review attempt. A CODEOWNERS file by itself does not enforce reviews. Standard review counts alone do not prove that the approvals came from distinct role holders; retain a manual evidence check until a trusted GitHub App verifies role membership.

Keep Vercel production credentials outside contributor CI. Restrict production release permissions to the appointed owner/steward. Do not connect automatic production deployment from a writeable branch until protected-branch and preview approval controls are verified. Preview deployments for untrusted code must not inherit production credentials or unrestricted production data. Review Vercel team membership, environment scopes and Git-trigger behavior directly.

The local `evaluateRelease` function is a tested policy model. It is not wired to a deployment endpoint and cannot authenticate GitHub review identities. It must never be used as a client-submitted authorization claim. A future server integration must independently retrieve provider evidence and fail closed when evidence is unavailable or stale.

## Founding goals

The real initial project is the CFH community platform. `/work` publishes the source-defined work briefs from `lib/harness.ts`. They are unassigned work, not invented completed contributions.

- **Establish the harness team:** appoint consenting reviewers, verify protected branches and a blocked failing PR. Owner and security review required.
- **Verify hosted accounts and isolation:** use an approved dedicated database; test anonymous, member A, member B and maintainer permissions. Do not enable a shared workspace based on local SQL tests alone.
- **Test accessibility:** keyboard and screen-reader journeys, both themes, mobile and zoom; publish reproducible findings.
- **Write the maintainer handoff:** verify that someone unfamiliar with this chat can set up, test, review and operate the project from repository documents.
- **Design onboarding:** test with consenting humans; include non-code contribution, asking for help and respectful handoff.
- **Exercise hostile contributions:** test self-approval, role escalation, stale evidence, unsafe links and workflow changes in staging with synthetic data.
- **Rehearse release and rollback:** prove unauthorized deployment is denied and recovery works before broadening production authority.

Each work item specifies acceptance criteria, reviewer role and dependencies. Human membership, claims and comments must use authenticated persisted records. Where that service is not configured, direct contributors to the public repository and clearly show the connection limitation.

## Security review checklist

Ask what data crosses each boundary; which identity grants access; whether membership can escalate privileges; whether a changed commit invalidates approval; whether external links, markdown and uploads can execute content; whether retries create duplicate writes; whether dependency or workflow edits gain secrets; whether reviewers can reproduce the evidence; and whether rollback restores a known safe state. Record findings and unresolved risks with the contribution.

The small tracked-source secret scanner detects known token and key patterns, including accidental tracked environment files. It does not scan all history, detect all credential formats or guarantee absence of secrets. A detected credential must be revoked and its exposure reviewed. The dependency audit fails on high/critical advisories in both runtime and development dependencies. Neither scanning nor test success establishes that arbitrary code is safe.

## Incident handling

Appoint a private reporting contact before soliciting sensitive vulnerability details. When a report arrives, acknowledge privately, preserve sanitized evidence, stop affected release paths, contain or revoke exposed access, assess impact, fix and independently review, then release and document recovery. Never ask a reporter to disclose secrets in public issues. Set response coverage and disclosure expectations only after the humans responsible have agreed to them.

## References

- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub secure use of pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)
