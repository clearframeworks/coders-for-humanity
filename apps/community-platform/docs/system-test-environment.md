# Local CFH system environment

This environment runs a snapshot of the actual Next application against a loopback HTTP adapter and in-memory PostgreSQL. It does not connect to the hosted CFH database or create production profiles.

## Run

From `apps/community-platform`:

```sh
npm ci
npx playwright install chromium
npm run test:system:backend
npm run test:system
```

`CFH_CHROMIUM_PATH` can point to an already installed Chromium executable. The system Playwright configuration runs desktop (1440px) and touch/mobile (390px) projects sequentially with one worker. Tests must reset state before each independent scenario. Do not enable parallel workers: the local database is shared across browser contexts so one persona can hand work to another.

To investigate interactively, start `npm run system:backend` and `npm run system:app` in separate terminals. Then set `CFH_SYSTEM_REUSE=true` for the Playwright invocation. Close those helpers when finished. The app runner copies current source into a uniquely named `cfh-system-app-*` temporary directory, excludes `.env*`, `.vercel`, existing build output and dependencies, and links the existing installed dependencies. It builds this snapshot in production mode, then starts the actual production server; development overlays cannot hide the application's recovery UI. Restart it after changing app source. The snapshot remains available for failure inspection; it contains no copied environment files.

The app listens at `http://127.0.0.1:3101`. The backend listens at `http://127.0.0.1:54329`. A runner rejects inherited external Supabase URLs or provider keys, supplies only the fixture URL/key, strips provider credentials from the child environment, and preloads a fetch guard allowing only loopback destinations. The browser suite must also reject external requests. These are application test controls, not an operating-system network sandbox.

For manual use, open **http://127.0.0.1:54329/__test/console**. Choose a synthetic contributor to enter the real app, switch to an independent reviewer, browse as a guest, or reset local changes using the confirmation button. Persona selection sets the existing local `cfh-auth` session cookie and redirects only to the loopback app. Controls reject external Origin/Referer headers and unexpected Host headers. These helpers have no production route or hosted authority.

## Personas and controls

All names and emails are labelled synthetic; addresses use `example.invalid`.

| Persona | Initial state |
| --- | --- |
| `alice` | Public contributor and project maintainer; can claim work but cannot review her own submission |
| `bruno` | Public contributor and independent project maintainer |
| `chris` | Private profile |
| `newcomer` | Test auth identity without a contributor profile |

- `GET /__test/health` reports readiness and the integration boundary.
- `POST /__test/reset` recreates PostgreSQL, applies canonical migrations in order, and seeds only local personas/maintainer appointments/one notification. This clears fault injection and the transcript.
- `GET /__test/personas` returns persona IDs, synthetic sessions, and complete Playwright cookie descriptors. Use `context.addCookies([personas.alice.cookie])`; the `cfh-auth` cookie uses the actual Supabase SSR base64 session format. These sessions have no authority outside this adapter.
- `POST /__test/fail-next` with `{"path":"/rest/v1/profiles","method":"PATCH"}` returns a synthetic 503 for the next matching data request, then returns to normal behavior. This tests recoverable UI failures without changing application code.
- `GET /__test/requests` returns sanitized `{method,path,actor,status}` entries. It excludes query values, request bodies, cookies, bearer tokens and profile content.

The canonical founding project is `cf000000-0000-4000-8000-000000000001`. A claimable task is `cf100000-0000-4000-8000-000000000004`.

The isolated app serves `/__cfh-system-fixture.json` with its run ID, backend run ID, migration fingerprint, source Git HEAD at capture time, and hashes of every runtime source/asset/config file. This file is written only into the temporary snapshot. Before mutating fixtures, browser tests must verify the manifest origins and matching backend run ID. Run `npm run system:verify` before and after acceptance tests: it compares the running inventory against current source and the backend's actual loaded migrations, returning nonzero on drift. After committing an unchanged candidate, `boundToCurrentCommit:true` binds the exercised runtime files to that Git HEAD; a snapshot started before the commit is reported honestly using its original capture HEAD. Tests, documentation and generated Next build files are excluded from runtime inventory. Changes to those files do not pretend to change the exercised application source.

## What is real and what is substituted

Browser interactions use actual Next pages, components, Server Actions, Supabase SSR cookies and the installed Supabase SDK. HTTP data requests run against actual PGlite PostgreSQL with the repository's unmodified migrations, roles, grants, row policies and RPC functions. Each request sets its actor using `auth.uid()` inside a transaction and switches to `anon` or `authenticated`; requests serialize so one actor cannot leak into another request. The adapter maps the app's explicit `cfh` schema header to the canonical migrations' `public` schema. Database decisions are executed by PostgreSQL, not reimplemented as JavaScript authorization checks.

The HTTP adapter implements only the PostgREST subset the application uses: GET/HEAD, profile INSERT/UPDATE, explicit projections, known relationship embeddings, equality/inequality/null/in-list filters, ordering/limits, object responses and named work/community RPCs. Unsupported tables, schemas, routes, operators and RPCs fail visibly. This is not the production PostgREST server.

Authentication is synthetic: the adapter recognizes only locally issued signed test tokens, serves `/auth/v1/user`, refreshes test sessions and accepts logout. Cookie bootstrap deliberately bypasses email delivery, PKCE and GitHub OAuth. Those provider flows remain separate acceptance work. External GitHub fetches are blocked, so the application's real unavailable-activity state should appear. No email, GitHub write, payment, deployment or production data operation is exercised by this harness.

The backend regression covers real SDK HTTP requests, private-profile isolation, denied cross-user edits, duplicate usernames, profile publication, project joining, task claim/status/evidence, self-review and stale-review denial, independent acceptance, discussion/reply/save, inbox read state, and proposal ownership. Browser results establish only the scenarios actually run. Local database evidence does not establish hosted Supabase configuration, real member authentication or physical-device acceptance.
