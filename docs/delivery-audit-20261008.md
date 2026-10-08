# CFH delivery evidence — October 8, 2026

This audit covers `cfh.retehost.com`, its dedicated repository and hosting project. It does not authorize changes to the separately locked Clear Frameworks site.

## Verified live source and hosting

- Alias `cfh.retehost.com` resolves to deployment `dpl_BrGMZmcdAb7N1o5RtF39rDWRKees`, URL `coders-for-humanity-ao54m15zf-clearframeworks-projects.vercel.app`.
- Project `prj_K7Gr8c6SjKw4OtkJClmOcTNWpriB` (`coders-for-humanity`), team `team_OOO0WtyyxNgirWfm82TovcTI` (`clearframeworks-projects`).
- Deployment metadata identifies `clearframeworks/coders-for-humanity`, source commit `301c3cad06f6960b859dcf2a325ca02038062db5`. GitHub `main` matched it. Commit tree: `67065106f926d433f7c99da2ca12f14d60b530e7`.
- GitHub's recursive source inventory returned `truncated=false`. Vercel's file-tree endpoint is unavailable for this Git-created deployment; the referenced immutable Git commit supplies its source inventory.
- Read-only CLI inspection confirmed repository ID `1391731736`, production branch `main`, Git deployment creation enabled, automatic domain assignment enabled, and fork protection enabled. A merge to `main` is a production-delivery action.
- Build: Next.js, `npm ci`, `npm run build`, Node `24.x`, no custom root directory.
- `vercel env ls production --scope clearframeworks-projects`, from the verified linked project, returned **no environment variables**. Production lacks a configured authentication/database connection. No secret values were read or exported.

Resolve the alias again before releasing and retain the previous deployment as the rollback coordinate. The latest-created deployment is not necessarily production.

## Verified repository enforcement

GitHub is the source host: [clearframeworks/coders-for-humanity](https://github.com/clearframeworks/coders-for-humanity).

- Classic protection requires `secret-scan`, `dependency-audit`, and `verify`, tied to GitHub Actions. Strict up-to-date checks and administrator enforcement are enabled.
- Force pushes and branch deletion are disabled; conversation resolution is required.
- Active ruleset [24219065](https://github.com/clearframeworks/coders-for-humanity/rules/24219065) requires fresh code-owner review and last-push approval. Its only exception is owner user ID `261966974`, limited to pull-request merges. It does not waive mandatory checks.
- CI permissions are `contents: read`, checkout does not persist credentials, action revisions are pinned, and contributor workflows contain no hosting credentials.

Evidence came from Vercel alias/deployment/project reads, GitHub branch/ruleset/tree reads, and scoped CLI reads of full branch protection. This audit changed no provider configuration.

## Existing signup work and repaired CI

[PR #2](https://github.com/clearframeworks/coders-for-humanity/pull/2), head `dd0353d26b1f864b37b4da55fa19fa5e023db67f`, prepared isolated CFH schemas in the previously selected shared Supabase project. Its body records a blocked migration caused by shared-project read-only capacity. Recheck that historical capacity report before activation.

[CI run 37132897434](https://github.com/clearframeworks/coders-for-humanity/actions/runs/37132897434) failed migration reproducibility: 39 of 40 tests passed; build and browser tests were skipped. The candidate normalizes line endings before multiline transformations and regenerates the migration, adding only three blank lines. A regression compares LF and CRLF inputs.

Dependency auditing found advisories against Next.js `16.3.6` and transitive `source-map-js` `1.2.1`. The candidate pins the minimal Next.js patch `16.3.8` and updates the compatible transitive dependency to `1.2.2`; `npm audit --audit-level=high` then reported zero vulnerabilities. Repeat mandatory CI on the final commit.

## Contribution and release boundary

1. A member develops a task with objective, acceptance criteria, dependencies, and reviewer. Atomic claiming establishes responsibility.
2. The contributor works in a fork or scoped branch and pushes to GitHub. CFH membership grants no repository write or hosting privileges.
3. A pull request links task and evidence. CI runs without production secrets. CFH shows the inspected head SHA, reported checks, and provider-attributed Vercel status.
4. GitHub enforces required checks and owner review policy. New commits require fresh checks/review. CFH task acceptance remains separate from merge/release authority.
5. The owner or delegated release steward reviews the preview and approves a scoped release. Merging to this production branch currently triggers hosting delivery.
6. Verify production, record source and previous deployment, and rehearse rollback in staging.

The read adapter creates no issues, assignments, code, merges, or deployments. It only queries the fixed public CFH repository. Checks cover at most three listed PRs, keyed by full head SHA, with ten-minute caching. Partial reads, pagination limits, missing/skipped checks, and rate limits cannot produce a passed summary. Status target links are restricted to HTTPS GitHub/Vercel hosts. Vercel attribution requires a Vercel status sender; a deployment report does not establish production promotion.

Future multi-repository integration should use a repository-scoped GitHub App, signed webhooks, unique delivery IDs, durable retries, and explicit project mappings. Private repository reads require authorization. Passing checks or completing a task must not independently authorize promotion.
