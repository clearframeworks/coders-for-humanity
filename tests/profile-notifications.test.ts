import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("CFH profile events survive missing founder setup, notify once and stay private", async () => {
  const db = new PGlite();
  const founder = "10000000-0000-4000-8000-000000000001";
  const member = "10000000-0000-4000-8000-000000000002";
  const other = "10000000-0000-4000-8000-000000000003";
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create role authenticator nologin;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated;
      grant execute on function auth.uid() to anon,authenticated;
      insert into auth.users values('${founder}'),('${member}'),('${other}');`);
    for (const file of [
      "20260928025534_institutional_foundation.sql",
      "20260928034553_community_workspace.sql",
      "20260928040326_founding_human_work.sql",
      "20261008173918_cfh_profile_notifications.sql",
    ]) await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    // Founder identity exists before activation; creating a global auth identity
    // alone never produces a CFH membership event.
    assert.equal((await db.query("select * from private.profile_events")).rows.length, 0);
    await db.exec(`insert into public.profiles(id,username,name) values('${founder}','founder','Founder');
      set role authenticated; select set_config('request.jwt.claim.sub','${member}',false);
      insert into public.profiles(id,username,name,is_public) values(auth.uid(),'new-member','New member',false);`);
    await assert.rejects(db.query("select * from private.profile_events"));
    await assert.rejects(db.exec(`insert into private.founder_notification_settings(user_id,email) values('${member}','attacker@example.invalid')`));
    await assert.rejects(db.query("select private.route_profile_event(gen_random_uuid())"));
    await assert.rejects(db.query("select public.claim_founder_email('notifications@example.invalid')"));
    await db.exec("reset role");
    assert.equal((await db.query("select * from private.profile_events")).rows.length, 2);
    assert.equal((await db.query("select * from private.founder_notification_outbox")).rows.length, 0);
    await db.exec(`insert into private.founder_notification_settings(user_id,email) values('${founder}','founder@example.invalid')`);
    const outbox = (await db.query<{ status: string; recipient_email: string; message: string }>("select * from private.founder_notification_outbox")).rows;
    assert.equal(outbox.length, 2);
    assert.ok(outbox.every((row) => row.status === "requires_sender" && row.recipient_email === "founder@example.invalid"));
    assert.ok(outbox.every((row) => row.message === "A contributor created a private CFH profile."));
    assert.ok(outbox.every((row) => !row.message.includes("new-member") && !row.message.includes("New member")));
    await db.exec(`update private.founder_notification_settings set email='founder@example.invalid';
      set role authenticated; select set_config('request.jwt.claim.sub','${member}',false);
      update public.profiles set name='Edited name' where id=auth.uid();`);
    assert.equal((await db.query("select * from public.notifications")).rows.length, 0);
    await db.exec(`select set_config('request.jwt.claim.sub','${founder}',false)`);
    assert.equal((await db.query("select * from public.notifications")).rows.length, 2);
    await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);
      begin; insert into public.profiles(id,username,name) values(auth.uid(),'rolled-back','Rolled back'); rollback;
      reset role;`);
    assert.equal((await db.query("select * from private.profile_events")).rows.length, 2);
    assert.equal((await db.query("select * from private.founder_notification_outbox")).rows.length, 2);
    await assert.rejects(db.exec("update private.founder_notification_outbox set status='sent'"));
    // A later member routes immediately when founder setup already exists.
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${other}',false);
      insert into public.profiles(id,username,name,is_public) values(auth.uid(),'public-member','Public member',true);
      reset role;`);
    assert.equal((await db.query("select * from private.founder_notification_outbox")).rows.length, 3);
    assert.match((await db.query<{ message: string }>("select message from private.founder_notification_outbox where message like '%@public-member%'")).rows[0].message, /https:\/\/cfh.retehost.com\/people\/public-member/);
    await db.exec("set role cfh_notification_worker");
    await assert.rejects(db.query("select * from public.profiles"));
    await assert.rejects(db.query("select * from private.founder_notification_settings"));
    const claim = async () => (await db.query<{ item: { id: string; lease_id: string } | null }>("select public.claim_founder_email('notifications@example.invalid') as item")).rows[0].item;
    const first = (await claim())!;
    const second = (await claim())!;
    assert.notEqual(first.id, second.id, "A live lease cannot be claimed twice");
    await db.exec(`select public.finish_founder_email('${first.id}','${first.lease_id}',null,'provider_http_429',true)`);
    await db.exec("reset role");
    const retry = (await db.query<{ status: string; delayed: boolean }>(`select status,next_attempt_at>now() as delayed from private.founder_notification_outbox where id='${first.id}'`)).rows[0];
    assert.equal(retry.status, "pending");
    assert.equal(retry.delayed, true);
    await db.exec(`update private.founder_notification_outbox set leased_at=now()-interval '3 minutes' where id='${second.id}'; set role cfh_notification_worker`);
    const recovered = (await claim())!;
    assert.equal(recovered.id, second.id);
    assert.notEqual(recovered.lease_id, second.lease_id);
    await assert.rejects(db.exec(`select public.finish_founder_email('${second.id}','${second.lease_id}','old-provider',null,false)`));
    await db.exec(`select public.finish_founder_email('${recovered.id}','${recovered.lease_id}','provider-receipt',null,false); reset role`);
    assert.equal((await db.query<{ status: string }>(`select status from private.founder_notification_outbox where id='${second.id}'`)).rows[0].status, "sent");
    await db.exec(`update private.founder_notification_outbox set first_attempt_at=now()-interval '21 hours',next_attempt_at=now() where id='${first.id}'; set role cfh_notification_worker`);
    const last = (await claim())!;
    await db.exec(`select public.finish_founder_email('${last.id}','${last.lease_id}',null,'provider_http_403',false); reset role`);
    assert.equal((await db.query<{ status: string }>(`select status from private.founder_notification_outbox where id='${first.id}'`)).rows[0].status, "needs_review");
    assert.equal((await db.query<{ status: string }>(`select status from private.founder_notification_outbox where id='${last.id}'`)).rows[0].status, "needs_review");
  } finally {
    await db.close();
  }
});
