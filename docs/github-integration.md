# GitHub integration contract

GitHub remains the source-control and review system. The platform stores validated repository URLs, issue URLs, repository identifiers, contributor identities, milestones, and decisions; it links users to the canonical work.

For future synchronization, use a GitHub App installed only on approved official repositories. Request read access to metadata, issues, pull requests, and releases; do not request organization administration or write access without a concrete need. Keep the private key and webhook secret server-side.

Verify the raw request body with the webhook HMAC before parsing. Persist the delivery identifier with a uniqueness constraint for idempotency. Match the GitHub numeric repository ID to an approved project repository. Reject unknown installations and repositories. Apply bounded retries and record failures without logging secrets or private payloads.

Map external issue states to institutional tasks only through an explicit policy. Closing an issue must not automatically prove an outcome, approve a proposal, or advance a project to deployment. Contributor attribution should be opt-in and tied to a verified account. Preserve a link to every canonical issue, PR, or release rather than duplicating Git.

This implementation does not receive webhooks, synchronize GitHub state, or invent repository activity. Those services require an installed GitHub App and a reviewed event-processing implementation.
