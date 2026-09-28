# Security

## Reporting

Do not report vulnerabilities, credentials, or personal data in public issues. Once an official GitHub repository is established, enable GitHub private vulnerability reporting and use that channel. Before public launch, appoint a security maintainer and publish a working private channel. No reporting inbox is claimed by this local foundation.

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

Use a dedicated database, restrict callback origins, configure email delivery, run advisors, keep dependencies patched, rotate compromised credentials, and verify backups. Privileged publishing through SQL must use auditable provider access and a recorded institutional decision. Audit-log retention, rate-limit cleanup, private reporting, and incident response need named operating owners before launch.

Local PGlite tests validate SQL behavior, but do not substitute for testing the actual Supabase Auth/Data API, email provider, deployment proxy, and backup system. Review staging with at least two accounts and anonymous access.
