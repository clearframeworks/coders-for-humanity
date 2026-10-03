import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { sharedSchemaMigration } from "../scripts/shared-schema";
import { readFileSync } from "node:fs";

test("checked-in shared migration matches the reviewed schema transformation", () => {
  assert.equal(
    readFileSync(
      "supabase/shared/migrations/20261003150827_shared_cfh_namespace.sql",
      "utf8",
    ).replace(/\r\n/g, "\n"),
    sharedSchemaMigration().replace(/\r\n/g, "\n"),
  );
});

test("shared installation leaves existing applications untouched and isolates CFH profiles", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      create table public.profiles(id text primary key, name text);
      insert into public.profiles values('existing-app','Untouched');
      create schema private; create table private.existing_app(id int);
      insert into auth.users values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');`);
    await db.exec(sharedSchemaMigration());
    assert.deepEqual((await db.query("select * from public.profiles")).rows, [
      { id: "existing-app", name: "Untouched" },
    ]);
    assert.equal(
      (
        await db.query<{ relrowsecurity: boolean }>(
          "select relrowsecurity from pg_class where oid='public.profiles'::regclass",
        )
      ).rows[0].relrowsecurity,
      false,
    );
    assert.equal(
      (
        await db.query(
          "select 1 from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname in ('cfh','cfh_private') and c.relkind='r' and not c.relrowsecurity",
        )
      ).rows.length,
      0,
    );
    await db.exec("set role anon");
    assert.equal((await db.query("select * from cfh.tasks")).rows.length, 7);
    await assert.rejects(
      db.query("select * from cfh_private.institutional_roles"),
    );
    await db.exec(
      "reset role; set role authenticated; select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false)",
    );
    await db.exec(
      "insert into cfh.profiles(id,username,name) values(auth.uid(),'cfh-test','CFH Test')",
    );
    await assert.rejects(
      db.exec(
        "insert into cfh.profiles(id,username,name) values('10000000-0000-4000-8000-000000000002','other-user','Other')",
      ),
    );
    await db.exec(
      "select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false)",
    );
    assert.equal((await db.query("select * from cfh.profiles")).rows.length, 0);
    assert.equal(
      (
        await db.query(
          "update cfh.profiles set name='Unwanted change' returning id",
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.exec(
        "insert into cfh_private.institutional_roles values(auth.uid(),'Board')",
      ),
    );
  } finally {
    await db.close();
  }
});
