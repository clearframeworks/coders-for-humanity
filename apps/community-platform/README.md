# CFH community platform

The website, community application and software landing pages for Coders for Humanity.

From this directory, use `npm ci`, then `npm run dev`. Open http://localhost:3100.
For a production build, run `npm run build` and `npm start`.

Run `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` and `npm audit` before release. Browser tests need `npx playwright install chromium` first.

The [development guide](../../docs/community-platform.md) covers provider setup, operating limits and architecture. The Vercel project `coders-for-humanity` uses this directory as its project root. Downloadable apps live separately under [products](../../products/).
