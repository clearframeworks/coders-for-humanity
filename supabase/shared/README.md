# CFH namespaced installation

The approved target is the owner-created dedicated Free Supabase project **Coders for Humanity** (`uinavtzevjoskkymhakx`), organization `javqroqxdnqbgoqkzknt`, West US / Oregon (`us-west-2`). It has its own database and Auth tenant. No pause or upgrade of another project is needed.

The `shared` directory name is historical. The application expects `cfh` for application tables/API functions and unexposed `cfh_private` for authority records, audit logs, rate limits, and notification helpers, even in this dedicated project.

## Verified installation

October 8 preflight confirmed read-only mode off, a 10 MB database, and no CFH schemas, Auth users, or public application tables. The reviewed bundle was successfully installed through the signed-in SQL editor. SQL verification found:

- 33 `cfh` tables, with zero tables lacking RLS across `cfh` and `cfh_private`.
- 35 `cfh` policies, seven founding tasks, zero profiles, and one repository.
- The restricted `cfh_notification_worker` role registered.
- Zero anonymous private-table SELECT grants; no anonymous or authenticated execution of the privileged mail-claim function.
- Anonymous `cfh_private` usage only supports the intentionally granted `public_thread_visible` RLS helper; it does not grant private-table access.

Data API exposure, Auth/SMTP configuration, the Vercel connection, real signup, and delivered founder alerts remain pending verification. Database installation alone is not hosted acceptance.

Use `migrations/20261003150827_shared_cfh_namespace.sql` only for an empty initial installation. `scripts/shared-schema.ts` generates it from five source migrations: institutional foundation, community workspace, founding work, task development/handoffs, and founder notifications. Do not apply `supabase/migrations` directly: those source files create `public`/`private` objects rather than the schemas the current app uses.

The approved target is already installed. Do not replay this initial bundle. Reconcile installed objects/history and prepare incremental changes for subsequent updates.

## Activation sequence

1. Run provider security advisors and verify hosted Data API access. Expose `cfh`; never expose `cfh_private`. Confirm anonymous catalogue reads and blocked private/privileged reads.
2. Configure the dedicated Auth Site URL `https://cfh.retehost.com`, its exact `/auth/callback` redirect, and any exact preview callback used for acceptance testing. Configure the Auth SMTP sender and test real delivery. Do not copy or alter the old shared project's Auth/SMTP settings.
3. Configure only the CFH Vercel project with the dedicated project URL, publishable key, and exact site URL. Rebuild after public environment changes. Keep service-role keys and JWT signing secrets out of the web runtime. CFH uses the `cfh-auth` cookie name; signup metadata is never authorization.
4. Leave GitHub OAuth unavailable until provider configuration is complete and explicitly enabled. Verify email-link signup/callback, profile creation, duplicate usernames, public/private visibility, sign-out, and two-user isolation on the hosted app and Data API.
5. Separately configure and verify founder alerts using [the notification guide](../../docs/founder-notifications.md). Auth email delivery does not establish delivery of founder alerts; queue creation does not establish email receipt.
6. Release through the owner-authority policy after mandatory checks and hosted acceptance pass. Verify production and record its source and rollback coordinate.

## Prior shared-project attempt

On October 3 the owner selected `retehost-cfw` (`msekcqxmwvxxxqcsdpfn`) to avoid another paid project. It reported read-only mode and 1566 MB of data; the migration was rejected. On October 8 it refused SQL connections. That service's EVE/EVAN recovery remains separate. The dedicated CFH target supersedes the shared activation plan; do not apply this task's migrations to the broken shared database or change its runtime authority.
