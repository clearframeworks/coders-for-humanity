import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("native Cron commits leases before bounded synchronous mail and preserves privacy/retries", async () => {
 const db = new PGlite();
 const run = async () => { await db.exec("call cfh_private.dispatch_founder_mail()"); return (await db.query<{last_status:string}>("select last_status from cfh_private.native_mail_settings")).rows[0].last_status; };
 const outbox = async () => (await db.query<{id:string;lease_id:string;status:string;attempts:number;last_error:string;delayed:boolean}>("select *,next_attempt_at>now() delayed from cfh_private.founder_notification_outbox order by created_at desc limit 1")).rows[0];
 const addProfile = async (n:number) => {
  const id = `10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
  await db.exec(`insert into auth.users values('${id}'); insert into cfh.profiles(id,username,name,is_public) values('${id}','private-${n}','Secret ${n}',false)`);
 };
 try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role authenticator nologin;
   create schema auth; create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  await db.exec(readFileSync("supabase/shared/migrations/20261003150827_shared_cfh_namespace.sql","utf8"));
  const nativeMigration = readFileSync("supabase/shared/migrations/20261008220708_cfh_native_mail_dispatch.sql","utf8");
  await assert.rejects(db.exec(nativeMigration),/Install the http extension/);
  await db.exec("rollback");
  assert.equal((await db.query<{name:string|null}>("select to_regclass('cfh_private.native_mail_settings') name")).rows[0].name,null,"Missing prerequisite leaves no partial installation");
  // SQL mock of the documented http1.6 composite interface: no network requests.
  await db.exec(`create schema extensions; create schema vault; create schema cron;
   create type extensions.http_header as (field varchar,value varchar);
   create type extensions.http_request as (method varchar,uri varchar,headers extensions.http_header[],content_type varchar,content varchar);
   create type extensions.http_response as (status integer,content_type varchar,headers extensions.http_header[],content varchar);
   create table extensions.test_control(status integer,content text,fail boolean,fail_options boolean);
   insert into extensions.test_control values(200,'{"id":"receipt"}',false,false);
   create table extensions.test_options(curlopt text primary key,value text);
   insert into extensions.test_options values('CURLOPT_USERAGENT','original-operator-option');
   create table extensions.test_calls(request extensions.http_request);
   create function extensions.http_list_curlopt() returns table(curlopt text,value text) language sql as $$select * from extensions.test_options$$;
   create function extensions.http_reset_curlopt() returns boolean language plpgsql as $$begin delete from extensions.test_options; return true; end$$;
   create function extensions.http_set_curlopt(option_name varchar,option_value varchar) returns boolean language plpgsql as $$begin
    if (select fail_options from extensions.test_control) and option_name='CURLOPT_TIMEOUT_MS' then return false; end if;
    insert into extensions.test_options values(option_name,option_value) on conflict(curlopt) do update set value=excluded.value; return true; end$$;
   create function extensions.http(request extensions.http_request) returns extensions.http_response language plpgsql as $$declare result extensions.http_response; begin
    if (select fail from extensions.test_control) then raise exception 'sensitive-provider-body'; end if;
    if current_setting('http.timeout_msec')<>'10000' then raise exception 'Legacy timeout GUC not bounded'; end if;
    if (select value from extensions.test_options where curlopt='CURLOPT_TIMEOUT_MS')<>'10000' then raise exception 'Timeout not configured'; end if;
    if (select value from extensions.test_options where curlopt='CURLOPT_SSL_VERIFYPEER')<>'1' then raise exception 'TLS verification not configured'; end if;
    insert into extensions.test_calls values(request);
    select status,'application/json',null,content into result from extensions.test_control; return result; end$$;
   create table vault.decrypted_secrets(name text primary key,decrypted_secret text);
   create table cron.job(jobid bigint generated always as identity primary key,jobname text unique,schedule text,command text,active boolean default true);
   create table cron.job_run_details(runid bigint generated always as identity primary key,jobid bigint,end_time timestamptz);
   create function cron.schedule(job_name text,job_schedule text,job_command text) returns bigint language plpgsql as $$declare result bigint; begin
    insert into cron.job(jobname,schedule,command) values(job_name,job_schedule,job_command) on conflict(jobname) do update set active=true returning jobid into result; return result; end$$;
   create function cron.alter_job(job_id bigint,active boolean) returns void language sql as $$update cron.job set active=alter_job.active where jobid=job_id$$;`);
  await db.exec(nativeMigration);
  assert.equal(await run(),"paused","Installed HTTP prerequisite does not enable mail");
  assert.equal((await db.query("select * from cron.job")).rows.length,0);
  assert.equal((await db.query("select * from extensions.test_calls")).rows.length,0,"Installer warm-up performs no HTTP request");
  assert.deepEqual((await db.query("select * from extensions.test_options")).rows,[{curlopt:"CURLOPT_USERAGENT",value:"original-operator-option"}],"Warm-up leaves existing curl options unchanged");
  await assert.rejects(db.exec("select cfh_private.enable_native_founder_mail('accounts@example.invalid')"),/Configure http/);
  for (const role of ["anon","authenticated","cfh_notification_worker"]) {
   await db.exec(`set role ${role}`);
   await assert.rejects(db.exec("call cfh_private.dispatch_founder_mail()"));
   await assert.rejects(db.exec("select cfh_private.enable_native_founder_mail('accounts@example.invalid')"));
   await assert.rejects(db.exec("select cfh_private.send_native_founder_mail(gen_random_uuid(),gen_random_uuid())"));
   await assert.rejects(db.query("select * from cfh_private.native_mail_settings"));
   await db.exec("reset role");
  }
  await addProfile(1);
  await db.exec("insert into cfh_private.founder_notification_settings(user_id,email) values('10000000-0000-4000-8000-000000000001','founder@example.invalid')");
  await assert.rejects(db.exec("select cfh_private.enable_native_founder_mail('accounts@example.invalid')"),/Configure http/);
  await db.exec("insert into vault.decrypted_secrets values('cfh_resend_sending_key','mock-only-not-a-real-key'); grant select on vault.decrypted_secrets to public");
  await assert.rejects(db.exec("select cfh_private.enable_native_founder_mail('accounts@example.invalid')"),/Configure http/);
  await db.exec("revoke select on vault.decrypted_secrets from public; select cfh_private.enable_native_founder_mail('accounts@example.invalid')");
  await db.exec("set role cfh_notification_worker");
  await assert.rejects(db.exec("select cfh.claim_founder_email('accounts@example.invalid')"),/permission denied/);
  await db.exec("reset role; grant select on vault.decrypted_secrets to authenticated");
  assert.equal(await run(),"not_ready","Runtime Vault privilege regression fails closed before claiming/sending");
  assert.equal((await outbox()).attempts,0);
  await db.exec("revoke select on vault.decrypted_secrets from authenticated");
  await db.exec("set http.timeout_msec='999999'");
  // Force post-claim failure outside transport to prove COMMIT survives it.
  await db.exec("alter function extensions.http_list_curlopt() rename to http_list_curlopt_saved");
  await assert.rejects(run(),/http_list_curlopt/);
  assert.equal((await outbox()).status,"inflight","Claim is durably committed before HTTP");
  assert.equal((await outbox()).attempts,1);
  await db.exec("alter function extensions.http_list_curlopt_saved() rename to http_list_curlopt");
  assert.equal(await run(),"idle","Live lease cannot be claimed twice");
  await db.exec("update cfh_private.founder_notification_outbox set leased_at=now()-interval '3 minutes'; update extensions.test_control set content='not-json'");
  assert.equal(await run(),"retry");
  assert.equal((await outbox()).last_error,"provider_missing_receipt");
  assert.equal((await outbox()).delayed,true);
  const firstCall = (await db.query<{body:string;headers:unknown}>("select (request).content body,(request).headers headers from extensions.test_calls")).rows[0];
  assert.equal(JSON.parse(firstCall.body).text,"A contributor created a private CFH profile.");
  assert.ok(!firstCall.body.includes("Secret"));
  await db.exec("update cfh_private.founder_notification_outbox set next_attempt_at=now(); update cfh_private.native_mail_settings set sender_email='changed@example.invalid'; update extensions.test_control set status=429,content='sensitive-provider-body'");
  assert.equal(await run(),"retry");
  assert.equal((await outbox()).last_error,"provider_http_429");
  const retryCalls = (await db.query<{body:string;headers:unknown}>("select (request).content body,(request).headers headers from extensions.test_calls")).rows;
  assert.deepEqual(retryCalls[1],firstCall,"Frozen payload and provider idempotency key survive retry and sender reconfiguration");
  assert.deepEqual((await db.query("select * from extensions.test_options")).rows,[{curlopt:"CURLOPT_USERAGENT",value:"original-operator-option"}]);
  assert.equal((await db.query<{value:string}>("select current_setting('http.timeout_msec') value")).rows[0].value,"999999","Function-local legacy timeout override restores the caller GUC");
  await db.exec("update cfh_private.founder_notification_outbox set next_attempt_at=now(); update extensions.test_control set fail_options=true");
  assert.equal(await run(),"retry");
  assert.equal((await outbox()).last_error,"transport_failed_P0001");
  assert.equal((await db.query("select * from extensions.test_calls")).rows.length,2,"Failed curl setup cannot pass headers to HTTP");
  await db.exec("update cfh_private.founder_notification_outbox set next_attempt_at=now(); update extensions.test_control set fail_options=false,fail=true");
  assert.equal(await run(),"retry");
  assert.equal((await outbox()).last_error,"transport_failed_P0001","Raw provider/error content is never persisted");
  await db.exec("update cfh_private.founder_notification_outbox set next_attempt_at=now(); update extensions.test_control set fail=false,status=200,content='{\"id\":\"provider-receipt\"}'");
  assert.equal(await run(),"accepted");
  assert.equal((await outbox()).status,"sent");
  await addProfile(2);
  await db.exec("update extensions.test_control set status=401,content='private-detail'");
  assert.equal(await run(),"needs_review");
  await addProfile(3);
  await db.exec("update extensions.test_control set status=302");
  assert.equal(await run(),"needs_review","A returned 3xx is not a receipt; mock does not assert real redirect prevention");
  await addProfile(4);
  const expired = (await db.query<{item:{id:string;lease_id:string}}>("select cfh_private.claim_founder_email('accounts@example.invalid') item")).rows[0].item;
  await db.exec("update cfh_private.founder_notification_outbox set first_attempt_at=now()-interval '21 hours' where status='inflight'");
  assert.equal((await db.query<{result:string}>(`select cfh_private.send_native_founder_mail('${expired.id}','${expired.lease_id}') result`)).rows[0].result,"needs_review");
  assert.equal((await db.query<{result:string}>(`select cfh_private.send_native_founder_mail('${expired.id}',gen_random_uuid()) result`)).rows[0].result,"superseded");
  await db.exec(`select cfh_private.pause_native_founder_mail();
   insert into cron.job(jobname,schedule,command) values('other','* * * * *','select 1');
   insert into cron.job_run_details(jobid,end_time) select jobid,now()-interval '8 days' from cron.job;`);
  assert.equal(await run(),"paused");
  assert.equal((await db.query("select * from cron.job_run_details")).rows.length,1,"History retention touches only CFH's exact Cron command");
  assert.equal((await db.query<{active:boolean}>("select active from cron.job where jobname='cfh_founder_mail_dispatch'")).rows[0].active,false);
 } finally { await db.close(); }
});
