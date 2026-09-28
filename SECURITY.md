# Security

## Reporting

Do not report vulnerabilities, credentials, or personal data in public issues. The repository is `clearframeworks/coders-for-humanity`. A staffed private reporting channel is not yet verified; contact a known repository owner privately before sending sensitive details. The owner must enable and verify private vulnerability reporting, appoint a security maintainer and publish response coverage. No unverified inbox or staffed team is claimed here.

Include affected versions, safe reproduction steps, expected and observed behavior, potential impact, and relevant sanitized evidence. Do not access another person's information or test destructively. Agree disclosure timing with the security maintainer and document a repair and release plan.

## Controls implemented

- RLS on every exposed table; private-by-default profiles and author-only proposals.
- Server-verified users on protected actions; Supabase SSR cookie refresh and PKCE callback.
- Explicit origin checking in addition to Next.js server action protections.
- Structured validation, React text escaping, bounded field sizes, and HTTPS-only external record URLs.
- Atomic, row-locked task claiming; a unique active assignment per task.
- Database-enforced per-user hourly rate limits for successful claims and submissions. Provider authentication endpoints require Supabase's own rate limits and abuse controls.
- Private audit records for transactional claims and submissions. No user-editable role claims.
- Security headers, a baseline CSP, and no service-role key in application code.

The CSP permits inline framework scripts/styles. Strengthening it with per-request nonces is a deployment improvement; do not claim that this baseline eliminates every XSS risk.

## Operator obligations

Read [the harness team charter](docs/harness-team.md). Community membership and task acceptance never grant merge or deployment authority. Source changes require automated checks, independent maintainer review, security review and a release steward's approval for the exact commit and preview. New changes invalidate previous evidence. CODEOWNERS and workflow definitions do not establish provider-enforced gates; verify branch rules, real check runs, distinct reviewer identities and production permissions directly. Public CI has no deployment step or production credentials.

Use a dedicated database, restrict callback origins, configure email delivery, run advisors, keep dependencies patched, rotate compromised credentials, and verify backups. Privileged publishing through SQL must use auditable provider access and a recorded institutional decision. Audit-log retention, rate-limit cleanup, private reporting, and incident response need named operating owners before launch.

Local PGlite tests validate SQL behavior, but do not substitute for testing the actual Supabase Auth/Data API, email provider, deployment proxy, and backup system. Review staging with at least two accounts and anonymous access.
