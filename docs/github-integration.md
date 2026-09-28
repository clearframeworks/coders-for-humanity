# GitHub connection and source publication

GitHub is the canonical system for source, issues, pull requests, code review, and releases. CFH is the social workspace for context, contributors, discussion, decisions, and handoffs. Project membership in CFH must not imply write access to a repository.

## Current state

The reviewed source is published in [clearframeworks/coders-for-humanity](https://github.com/clearframeworks/coders-for-humanity). The owner explicitly approved publication and the deployment connection on September 28, 2026. The initial published revision is `1f18d47e49bfd7897070fb507b804fd250cc8d0d`; GitHub run `36407475908` passed secret-scan, dependency-audit, and verify.

The dedicated Vercel project `prj_K7Gr8c6SjKw4OtkJClmOcTNWpriB` is linked to GitHub repository ID `1391731736`, owned by `clearframeworks`, with `main` as the production branch. GitHub Discussions and private vulnerability reporting are enabled. No contributor workflow receives a Vercel token. Review staffing and hosting-role controls still need independent verification.

## Implemented public read adapter

`lib/github.ts` reads public metadata for the fixed CFH repository, then independently requests up to 50 open issues, 50 open pull requests, and 12 recent commits. Pull requests returned by the issues endpoint are excluded from the issue list. Requests have an eight-second timeout and a two-minute framework revalidation interval; request-scoped caching avoids redundant reads in one render.

The adapter uses the public GitHub API without stored contributor credentials. It renders actual records or an explicit unavailable/empty state. Public API rate limits can prevent a read, and an empty repository can have no commit history. Neither condition justifies sample activity or an invented contribution count.

Draft handoff links open GitHub's issue composer. The person still reviews the content and submits it on GitHub. Opening the link does not create an issue, publish a CFH conversation, claim a task, or establish review approval. A GitHub issue URL is not evidence that its content has been independently verified.

## Complete source publication deliberately

Publication is approved and complete. For future contributions, review the exact source inventory, license, asset provenance, and secret scan. Do not include `.env.local`, provider exports, local credentials, or unrelated workspace files. Historical release records preserve the earlier pending state; they do not revoke the later approval.

Configure protected-branch and review settings separately from source publication. Verify them using a failing pull request, a stale approval, a self-review attempt, and a contributor identity lacking release permissions. CI definitions and CODEOWNERS do not enforce provider rules by themselves. Keep production credentials out of contributor workflows. See [harness-team.md](harness-team.md).

## Next integration: read-only GitHub App

A future GitHub App should be installed only on approved project repositories. Begin with the metadata, issues, pull-request, and release read permissions needed by the integration; request no write or organization-administration permission without a reviewed use case. Store app credentials and webhook secrets only in the server-side secret store.

The implementation must:

1. Verify each webhook's raw body signature before accepting the event.
2. Resolve installation and numeric repository IDs against approved project mappings; reject unknown or revoked installations.
3. Persist unique delivery IDs and process events idempotently through a durable worker.
4. Bound payload sizes, concurrency, retries, and retained content. Record sanitized failures and a recoverable dead-letter state.
5. Enforce repository visibility and user authorization during reads; never leak private repository metadata into a public feed.
6. Preserve canonical GitHub links and timestamps; show synchronization failures and freshness explicitly.
7. Require a documented mapping from external issue state to CFH task state. A closed issue or merged pull request must not automatically prove an outcome, satisfy independent review, or authorize release.

A separate approved implementation is required for any write capability. No GitHub App, webhook receiver, durable ingestion queue, private-repository synchronization, or automated production integration is active in this foundation.
