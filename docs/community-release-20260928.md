# Community workspace production release — September 28, 2026

Owner authorization: build the human collaboration space using three subagents, add security and harness gates, and “Push it live before usage runs out.”

- Public URL: https://cfh.retehost.com
- Vercel project: `coders-for-humanity` / `prj_K7Gr8c6SjKw4OtkJClmOcTNWpriB`
- Team: `clearframeworks-projects`
- Source revision: `7602a4ccdf5ecb51bfcb945dbc73bddaeff51d27` on local `codex/community-workspace`
- Active deployment: `dpl_ETrPg8jXPRSm79Ny7sAdcXYUMy4K`
- Immutable URL: https://coders-for-humanity-fqcmrstxi-clearframeworks-projects.vercel.app
- Provider status: READY; resolving `cfh.retehost.com` returned this deployment after release.
- Rollback coordinate: `dpl_5YhceWkUH4b8h8yPZn5awDmMJJHY`, https://coders-for-humanity-5xlo4ld9t-clearframeworks-projects.vercel.app. This is the older demonstration site, preserved as a recovery target, not the desired product.

## Delivered

Community home and project rooms; overview, conversations, workboard, knowledge, code and member tabs; seven real founding work briefs; discussion drafts; a device-only handoff notebook with Markdown export; member and inbox interfaces; independent review queue; light/dark/system settings; real public GitHub reads with honest empty/error states.

The harness has defined contribution, automated-check, independent-review, security-review, and release gates. Three database migrations enforce publication and ownership, contributor-only membership, evidence submission, independent current-version review, and denial of stale or self-approved acceptance. Human roles are unstaffed. Task acceptance cannot trigger deployment.

## Verified

- Local production build and TypeScript passed.
- 28 domain, PostgreSQL and review-policy tests passed. Founding seed fields match the source backlog.
- All 12 Chromium acceptance tests passed locally, then all 12 passed against the live public domain (16.8 seconds).
- Live checks covered public routes, six project tabs, task filters, local draft restore/clear, handoff save/edit/export/remove, login and review gating, mobile navigation and seven overflow checks.
- Automated WCAG A/AA checks found no violations on ten working screens in each theme.
- Locked dependency audit reported zero known vulnerabilities; credential-pattern scan found no matches in tracked source.
- Production remote build completed successfully, audited clean, and included all 43 generated pages plus dynamic routes.
- Browser inspection recorded no errors. Vercel's error-filtered log query found no entries for this deployment in the inspected ten-minute window.
- Live light and dark screenshots: `artifacts/community-live-light.png` and `artifacts/community-live-dark.png` (ignored local evidence).

## Deliberate operating limits

This is a deployed public foundation, not an activated multi-user service. Dedicated Supabase organization/cost selection remains pending. No hosted database, OAuth or email setup was created, and shared posting/claims/membership/review writes remain closed. Local drafts are not server records.

Public GitHub source upload and a Git-triggered Vercel connection were not retried after the earlier automatic approval rejection. This production release used the expressly authorized direct Vercel deployment route. No repository push or automatic deployment integration occurred. Provider branch protections and named independent reviewers still require human setup and verification.

No Clear Frameworks domain, unrelated hosting project, shared database, or EVAN/EVE authority flag was changed. No environment file or credential was included in the upload. See HUMAN-TAKEOVER.md for the next owner decisions and contributor work.
