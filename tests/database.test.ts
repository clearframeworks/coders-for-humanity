import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const A = "10000000-0000-4000-8000-000000000001",
  B = "10000000-0000-4000-8000-000000000002";
const P = "20000000-0000-4000-8000-000000000001",
  H = "20000000-0000-4000-8000-000000000002",
  T = "30000000-0000-4000-8000-000000000001";
test("PostgreSQL schema, publication isolation, atomic claims, and proposal ownership", async (t) => {
  const db = new PGlite();
  await db.exec(
    `create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260928025534_institutional_foundation.sql",
      "utf8",
    ),
  );
  await db.exec(
    `insert into auth.users values('${A}'),('${B}');insert into public.profiles(id,username,name,is_public) values('${A}','person-a','Person A',true),('${B}','person-b','Person B',false);insert into public.projects(id,slug,name,program_id,summary,problem,objective,published) values('${P}','real-project','Real Project','food','Summary','Problem','Objective',true),('${H}','hidden-project','Hidden','food','Summary','Problem','Objective',false);insert into public.tasks(id,project_id,title,discipline,level,effort,technology,objective,context,acceptance) values('${T}','${P}','Real task','Research','Beginner','1–3 hours','Research','Objective','Context','Acceptance');`,
  );
  const asRole = async (role: string, id = "") => {
    await db.exec(
      `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role ${role};`,
    );
  };
  await t.test("all exposed tables have RLS enabled", async () => {
    await db.exec("reset role");
    const r = await db.query(
      "select relname from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r' and not relrowsecurity",
    );
    assert.equal(r.rows.length, 0);
  });
  await t.test(
    "anonymous reads exclude private profiles and unpublished projects",
    async () => {
      await asRole("anon");
      assert.equal(
        (await db.query("select * from public.projects")).rows.length,
        1,
      );
      assert.equal(
        (await db.query("select * from public.profiles")).rows.length,
        1,
      );
      assert.equal(
        (await db.query("select * from public.proposals")).rows.length,
        0,
      );
      await assert.rejects(db.query(`select public.claim_task('${T}')`));
    },
  );
  await t.test(
    "users cannot edit another profile or set authority fields",
    async () => {
      await asRole("authenticated", B);
      const r = await db.query(
        `update public.profiles set name='Attack' where id='${A}' returning id`,
      );
      assert.equal(r.rows.length, 0);
      await assert.rejects(
        db.query(`update public.profiles set is_demo=true where id='${B}'`),
      );
      await assert.rejects(
        db.query(
          `insert into private.institutional_roles values('${B}','Board')`,
        ),
      );
    },
  );
  await t.test("claim assigns once and rejects a second claimant", async () => {
    await asRole("authenticated", A);
    await db.query(`select public.claim_task('${T}')`);
    assert.equal(
      (
        await db.query<{ status: string }>(
          `select status from public.tasks where id='${T}'`,
        )
      ).rows[0].status,
      "CLAIMED",
    );
    await asRole("authenticated", B);
    await assert.rejects(db.query(`select public.claim_task('${T}')`));
    await db.exec("reset role");
    assert.equal(
      (await db.query("select * from public.task_assignments")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from private.audit_log")).rows.length,
      1,
    );
  });
  const payload = {
    title: "Research the coordination gap",
    ...Object.fromEntries(
      [
        "problem",
        "evidence",
        "existing_solutions",
        "people_affected",
        "intervention",
        "technology_rationale",
        "risks",
        "expertise",
        "deployment",
        "measurement",
      ].map((k) => [
        k,
        "A substantive explanation of the proposed research, limitations, and important constraints.",
      ]),
    ),
    sources: ["https://example.org/evidence"],
  };
  await t.test(
    "proposal and evidence are atomic and visible only to the author",
    async () => {
      await asRole("authenticated", A);
      await db.query("select public.submit_proposal($1::jsonb)", [
        JSON.stringify(payload),
      ]);
      assert.equal(
        (await db.query("select * from public.proposals")).rows.length,
        1,
      );
      assert.equal(
        (await db.query("select * from public.proposal_sources")).rows.length,
        1,
      );
      await assert.rejects(
        db.query("select public.submit_proposal($1::jsonb)", [
          JSON.stringify({
            ...payload,
            title: "Another proposed intervention",
            sources: ["javascript:alert(1)"],
          }),
        ]),
      );
      assert.equal(
        (await db.query("select * from public.proposals")).rows.length,
        1,
      );
      await asRole("authenticated", B);
      assert.equal(
        (await db.query("select * from public.proposals")).rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from public.proposal_sources")).rows.length,
        0,
      );
    },
  );
  await t.test(
    "duplicate proposal title cannot create duplicate work",
    async () => {
      await asRole("authenticated", A);
      await assert.rejects(
        db.query("select public.submit_proposal($1::jsonb)", [
          JSON.stringify(payload),
        ]),
      );
    },
  );
  await t.test("proposal rate limit is enforced in the database", async () => {
    await asRole("authenticated", A);
    for (let i = 0; i < 4; i++)
      await db.query("select public.submit_proposal($1::jsonb)", [
        JSON.stringify({
          ...payload,
          title: `Additional research proposal ${i}`,
        }),
      ]);
    await assert.rejects(
      db.query("select public.submit_proposal($1::jsonb)", [
        JSON.stringify({ ...payload, title: "Rate limited research proposal" }),
      ]),
    );
  });
  await db.close();
});
