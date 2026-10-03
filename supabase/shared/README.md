# CFH in retehost-cfw

The owner authorized the existing `retehost-cfw` project (`msekcqxmwvxxxqcsdpfn`)
on October 3, 2026 to avoid another paid project. CFH uses the `cfh` schema for
application tables and API functions, and the unexposed `cfh_private` schema for
roles, audit records, rate limits, and privileged helpers. Auth identities and
project capacity are shared; this is data separation, not an independent Auth
tenant. An existing Retehost identity still needs to create a CFH profile.

**Do not apply `supabase/migrations` directly to the shared project.** Those are
the historical dedicated-project migrations and contain public-schema grant/RLS
loops. Apply only this directory's generated migration. `scripts/shared-schema.ts`
translates all schema references and schema-scoped loops; tests verify unrelated
public/private tables remain untouched and cross-user CFH edits are rejected.

## Current blocker

On October 3, 2026 the live database reported `default_transaction_read_only=on`
from its server configuration and a database size of 1566 MB. The migration tool
rejected the operation before creating its history table. Both CFH schemas remain
absent. No remote schema changes or production environment changes were applied.

The largest relations were existing EVE gateway attestations (634 MB), device
signature assertions (364 MB), command receipts (290 MB), and claim commands
(196 MB). These are existing application records, not disposable CFH test data.
Do not disable read-only protection, delete these records, or purchase capacity
without a separately scoped owner instruction and a verified recovery plan.

## Activation sequence

1. Resolve the shared database's read-only state through the approved capacity or
   retention procedure. Confirm it accepts writes without overriding protection.
2. Apply `migrations/20261003150827_shared_cfh_namespace.sql`. Run advisors and
   confirm CFH RLS, explicit grants, and seven founding tasks.
3. Append `cfh` to the existing exposed API schemas; preserve all current entries.
   Never expose `cfh_private`.
4. Append the exact CFH auth callback to allowed redirects, preserving every
   existing application's redirects and the shared Site URL. Inspect the existing
   email sender/hook first; do not replace it with a CFH-only implementation.
5. Configure only the CFH Vercel project with the shared project URL and publishable
   key. Never put a service-role key in the app. CFH uses its own `cfh-auth` cookie
   name. Signup metadata identifies `coders-for-humanity` for mail routing only;
   it is never an authorization claim.
6. Verify delivered email, callback, profile creation, duplicate usernames,
   private/public visibility, sign-out, and two-user isolation against the hosted
   API. Hide any social provider that is not actually configured.
7. Release through the owner-authority policy after CI passes; verify public signup
   on the production domain. Until then, leave production unconfigured so it
   continues to identify browser drafts honestly.

Dashboard sign-in is also needed: the connected database tools do not expose auth
configuration, the local CLI has no management access token, and the opened
Supabase dashboard required sign-in. Do not commit downloaded provider config or
credentials. Current local unit/database and TypeScript tests are not a hosted
signup acceptance result.
