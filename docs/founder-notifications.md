# CFH founder notifications

Saving a CFH profile creates a durable `profile.created` event in the same transaction. Auth account creation alone is not a CFH membership event. Public profiles include the chosen name and profile link; profiles private at creation produce only “A contributor created a private CFH profile.” Updates do not repeat the event. The founder receives one private `/inbox` item and one durable email outbox entry per event.

The trusted founder UUID and verified recipient address are configured by the operator in `cfh_private.founder_notification_settings`. Browser roles cannot read or change this configuration. A handle, email in user-editable metadata, or profile field never grants founder authority. The founder must first sign in, confirm their email, and save a CFH profile. Setting the recipient routes already-captured events once each; profiles predating the original profile-event migration are not backfilled. Recipient, message and subject freeze at routing; sender freezes on the first claim.

## Native worker

The incremental migration `supabase/shared/migrations/20261008220708_cfh_native_mail_dispatch.sql` adds the preferred worker. Apply it after the already-deployed `20261003150827_shared_cfh_namespace.sql`; do not regenerate or reapply that initial bundle. Installing the incremental file creates no schedule, installs no extension or credential, and leaves delivery disabled.

Supabase Cron calls an operator-only procedure once a minute. It commits one lease before making a synchronous, fixed-URL Resend request through the `http` extension, then records the result. The commit preserves the first-attempt time, immutable sender and lease even if the database connection dies after provider acceptance. A live lease is not reclaimed for two minutes. Claims use row locking; a second operator call cannot send the same live lease. Cron itself serializes runs of the same job.

Only a successful 2xx response containing a nonempty string provider ID marks the row `sent`. This means provider acceptance, not inbox delivery. Missing/malformed receipts, transport errors, 408/409/429 and 5xx responses retry with exponential backoff capped at one hour. Permanent errors enter `needs_review`. Attempts stop at 12 or 20 hours from the original committed claim, inside Resend's 24-hour idempotency window. Every retry uses `cfh-profile-<outbox UUID>` and the same payload. Never reset an uncertain expired item without first checking its provider receipt.

The transport uses TLS verification, a three-second connection timeout and ten-second total timeout, including a function-local override of http 1.6's deprecated timeout GUC. It saves and restores the operator session's curl options. The initial URL is fixed to Resend; http 1.6 can follow up to five provider redirects and exposes no option to disable that behavior. Provider-controlled redirects remain inside the trusted transport boundary. A 3xx response actually returned to the worker enters review; mocked 3xx tests do not prove that real redirects are prevented. Keys and response bodies are not stored in a general HTTP queue or logs by this worker; recorded failures contain short status codes only. Private outbox content remains accessible only to trusted database operators.

This worker deliberately uses synchronous `http`, not `pg_net`. Hosted pg_net gives PUBLIC access to its queue, including Authorization headers, and Supabase does not support revoking those grants per project. No pg_net extension, queue, or credentials are needed here. [Supabase constraint](https://supabase.com/docs/guides/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16). The native worker needs no worker JWT, signing secret, service-role key, Vercel Cron, or paid minute-level Vercel schedule.

## Operator setup — dedicated CFH project only

Target project: `uinavtzevjoskkymhakx`. The following is a setup runbook, not evidence that activation has happened. Installing code, configuring signup SMTP, and enabling founder notification delivery are separate actions. Obtain the owner's approval for the founder recipient, worker sending credential and activation before those writes.

1. The initial CFH schema must already exist. Inspect extension availability, then install `http` in `extensions` before the incremental migration. The October 8 hosted check found http 1.6 and pg_cron 1.6.4 available, with supabase_vault 0.3.1 installed. Recheck installation state before acting.

```sql
select name, default_version, installed_version
from pg_available_extensions
where name in ('http','pg_cron','supabase_vault');

-- Explicit dependency installation after approval; creates no mail job.
create extension if not exists http with schema extensions;

select e.extname,e.extversion,n.nspname
from pg_extension e join pg_namespace n on n.oid=e.extnamespace
where e.extname in ('http','pg_cron','supabase_vault');
select to_regprocedure('extensions.http(extensions.http_request)');
```

2. Apply only the incremental migration as `postgres`, then confirm `enabled=false`. Its opening prerequisite check calls `http_list_curlopt()` in the same session, loading the HTTP library without making a network request or changing options. This registers `http.timeout_msec` as user-settable before PostgreSQL validates the function's SET clause. An unloaded placeholder is rejected by hosted PostgreSQL; do not grant broader parameter privileges or remove the timeout. The migration fails clearly before creating application objects if HTTP is absent. Keep the whole migration in one SQL batch, including its warm-up. Later, before approved activation, install Cron and verify Vault:

```sql
create extension if not exists pg_cron with schema pg_catalog;
select to_regprocedure('cron.schedule(text,text,text)'),
       to_regclass('vault.decrypted_secrets');
select enabled from cfh_private.native_mail_settings;
```

Keep `cfh_private`, `vault`, `cron` and `extensions` out of Data API exposed schemas. Do not expose `net` if it exists for another purpose. Inspect effective Vault privileges without reading secrets:

```sql
select r.rolname,
       has_table_privilege(r.rolname,'vault.decrypted_secrets','SELECT') as can_read_vault
from pg_roles r where r.rolname in ('anon','authenticated','cfh_notification_worker');

-- Dedicated-project hardening if needed, executed by the object/grant owner:
revoke all on vault.decrypted_secrets from public,anon,authenticated,cfh_notification_worker;
```

Every result must be false before activating. Re-run the SELECT after REVOKE: a command that completes with a warning may not have changed effective privileges. If grants cannot be removed, stop and resolve them with the provider; do not weaken the guard. The worker rechecks Vault privileges before each claim and send.

3. Review the founder's actual confirmed Auth identity and saved profile privately:

```sql
select u.id,u.email,u.email_confirmed_at,p.username,p.created_at
from auth.users u join cfh.profiles p on p.id=u.id
where u.email_confirmed_at is not null
order by p.created_at;
```

Choose the exact verified UUID with the owner; do not infer authority from a username. The following **psql** snippet prompts for approved values, verifies the exact confirmed UUID/email pair, and fails without a match. It does not mint authority from profile metadata:

```sql
\prompt 'Verified founder Auth UUID: ' verified_founder_uuid
\prompt 'Owner-approved verified recipient email: ' verified_founder_email
begin;
create temporary table cfh_founder_bootstrap on commit drop as
select u.id,u.email
from auth.users u join cfh.profiles p on p.id=u.id
where u.id=:'verified_founder_uuid'::uuid
  and lower(u.email)=lower(:'verified_founder_email')
  and u.email_confirmed_at is not null;
do $$begin
 if (select count(*) from cfh_founder_bootstrap)<>1 then
  raise exception 'Expected exactly one owner-verified confirmed CFH profile';
 end if;
end$$;
insert into cfh_private.founder_notification_settings(singleton,user_id,email)
select true,id,email from cfh_founder_bootstrap;
commit;
```

An existing founder setting causes the insert to fail; changing an existing recipient requires a separately reviewed update. Confirm the correct founder sees their in-app inbox before enabling email. Record the verified UUID, operator approval and time privately, not credentials or session tokens.

4. Create a dedicated Resend **sending-only** key restricted to the approved CFH sender domain. Store it through the Supabase Vault dashboard as `cfh_resend_sending_key`. Do not paste a key into saved SQL Editor text, chat, migration files, shell arguments or logs. Do not copy the signup SMTP credential for a new purpose without authorization. Verify the key exists without selecting its value:

```sql
select name from vault.secrets where name='cfh_resend_sending_key';
select cfh_private.native_mail_ready();
```

5. After approval, activate with the verified CFH sender. The sender below is the domain-specific address verified for signup SMTP; its worker key still needs the separate step above.

```sql
select cfh_private.enable_native_founder_mail('accounts@cfh.retehost.com');
select jobid,jobname,schedule,command,active,username
from cron.job where jobname='cfh_founder_mail_dispatch';
```

The job must run as `postgres` and its command must be exactly `call cfh_private.dispatch_founder_mail();`. Activation revokes the legacy JWT worker's claim/finish permissions so two delivery transports do not compete. Keep `CFH_EMAIL_NOTIFICATIONS_ENABLED=false` in Vercel.

For an approved manual run, issue the following as the **single top-level statement in a fresh database connection**. Do not put it inside BEGIN/COMMIT, a function, a transaction-wrapped migration, or a multi-statement SQL Editor request:

```sql
call cfh_private.dispatch_founder_mail();
```

The procedure is SECURITY INVOKER and intentionally has no SET clause: PostgreSQL forbids its transaction control otherwise. Its helpers are private and revoked from browser and legacy worker roles. Local tests execute the actual top-level CALL and force a post-commit failure to verify the lease survives. Mock transport tests do not prove hosted extension/SMTP behavior; verify one approved owner's event and actual inbox receipt after activation.

## Monitoring, pause and limits

```sql
select enabled,last_run_at,last_status from cfh_private.native_mail_settings;
select status,count(*) from cfh_private.founder_notification_outbox group by status;
select id,status,attempts,first_attempt_at,next_attempt_at,provider_id,last_error
from cfh_private.founder_notification_outbox
where status<>'sent' order by created_at limit 25;
select cfh_private.pause_native_founder_mail();
```

Pause disables future scheduled sends; a synchronous send already in progress may complete. An unfinished lease remains durable for review or recovery on reactivation. Manual CALL while paused records `paused` without sending. The worker prunes at most 1,000 Cron history rows older than seven days per invocation, scoped to its exact job name and command. It preserves outbox receipts and all unrelated jobs. There is no per-idle-call application ledger or HTTP queue; the singleton status row is updated in place. If this project is paused, its database unavailable, or Resend quota exhausted, alerts will not be immediate; the durable queue retains work. This is bounded retry delivery, not an unconditional exactly-once guarantee.

## Legacy HTTP worker

`/api/internal/founder-notifications` remains an alternative implementation but should stay disabled when native delivery is used. It requires a server-only scoped worker JWT, custom `CFH_NOTIFICATION_CRON_SECRET`, verified sender and sending-only key. Native Vercel Cron uses `CRON_SECRET`, not that custom name; a plain Vercel cron entry is therefore not sufficient. Native Supabase scheduling removes the expiring-token provisioning problem. Never place a shared service-role key or JWT signing secret in the web app.

These changes do not alter signup SMTP, other apps, EVE/EVAN authority, or production Vercel configuration. Tests mock the HTTP extension and verify permissions, pre-send committed leases, private payloads, stable retries, receipt handling, curl setup failures/restoration, retry expiry, pause and scoped history retention.
