# Production release — September 28, 2026 UTC

Historical report: this demonstration release was superseded by the community workspace. See [community-release-20260928.md](community-release-20260928.md) for the new active deployment and verification.

Owner authorization: “Push live. Cfh.retehost.com”.

- Public URL: https://cfh.retehost.com
- Vercel project: coders-for-humanity
- Project ID: prj_K7Gr8c6SjKw4OtkJClmOcTNWpriB
- Team: clearframeworks-projects
- Active production deployment: dpl_5YhceWkUH4b8h8yPZn5awDmMJJHY
- Immutable deployment URL: https://coders-for-humanity-5xlo4ld9t-clearframeworks-projects.vercel.app
- Status: READY; production domain mapping confirmed through the Vercel alias API.
- Mode: explicitly labelled demonstration catalogue. No database, OAuth, email, or shared submission service activated.

## Baseline and recovery

At the start, cfh.retehost.com had a Vercel DNS CNAME but no Vercel deployment alias; no prior working CFH production deployment was available as a rollback coordinate. A dedicated project was created. The first deployment, dpl_EM7xv5m9ZWej4DvVjQidfsy3eE3s, was superseded immediately because an unanchored upload exclusion omitted app/docs. The exclusion was corrected and the full 74-file deployment inventory verified before the final deployment. The first deployment is not the recommended recovery target.

Use the final immutable deployment above as the known-good recovery coordinate for future releases. No Clear Frameworks site, parent-domain routing, or other hosting project was changed.

## Verification

- TypeScript, 14 domain/database tests, and local production build passed immediately before deployment.
- Vercel production install audited clean and production build generated all routes, including the handbook.
- HTTPS returned 200 with the expected title and security headers.
- Live Chromium checks passed for the homepage, 23 additional public routes, and transparency API.
- Verified theme persistence after reload, contribution filtering, mobile navigation, and no horizontal homepage overflow at 390px.
- No browser runtime/console errors were recorded. Vercel's error-filtered runtime log query returned no entries after verification.
- Domain configuration and ownership were verified by Vercel; the final domain alias resolves to the deployment recorded above.
- Upload inventory excluded .env files, provider tokens, local test output, and screenshots.

Evidence: artifacts/live-verification.json, artifacts/live-light.png, artifacts/live-dark.png, artifacts/live-mobile.png, and artifacts/deployment-inputs.json.

The site is public. Authentication and shared data still require a dedicated Supabase setup and separate staging verification. Existing implementation limits remain documented in architecture.md.
