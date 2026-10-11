import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const C = "10000000-0000-4000-8000-000000000003";
const P = "cf000000-0000-4000-8000-000000000001";
const H = "20000000-0000-4000-8000-000000000002";

test("Task development preserves project authority, dependency gates, and recoverable claims", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
    for (const migration of ["20260928025534_institutional_foundation.sql", "20260928034553_community_workspace.sql", "20260928040326_founding_human_work.sql", "20261008173854_task_development.sql"])
      await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
    await db.exec(`insert into auth.users values('${A}'),('${B}'),('${C}');
      insert into public.profiles(id,username,name,is_public) values('${A}','alice','Alice',true),('${B}','bruno','Bruno',true),('${C}','chris','Chris',true);
      insert into public.project_maintainers(project_id,user_id) values('${P}','${A}'),('${P}','${B}');
      insert into public.projects(id,slug,name,program_id,summary,problem,objective,published) values('${H}','other-project','Other project','food','Summary','Problem','Objective',true);`);
    const as = async (id?: string, anonymous = false) => db.exec(`reset role; select set_config('request.jwt.claim.sub','${id ?? ""}',false);${id || anonymous ? `set role ${anonymous ? "anon" : "authenticated"};` : ""}`);
    const brief = { project_id: P, reviewer_id: B, title: "Verify one useful contribution", discipline: "Testing", level: "Beginner", effort: "1–3 hours", technology: "Browser and test fixtures", objective: "Prove the complete contribution flow works.", context: "Use isolated data and document each step taken.", acceptance: "The report includes positive and negative permission checks.", dependency_ids: [] as string[] };
    const create = async (changes: Record<string, unknown> = {}) => (await db.query<{ id: string }>("select public.create_task_brief($1::jsonb) as id", [JSON.stringify({ ...brief, ...changes })])).rows[0].id;
    let first = "", dependent = "";

    await t.test("only maintainers can create tasks in their active project", async () => {
      await as(undefined, true);
      await assert.rejects(create());
      await as(C);
      await assert.rejects(create());
      await as(A);
      await assert.rejects(create({ project_id: H }));
      await assert.rejects(create({ reviewer_id: C }));
      await assert.rejects(create({ acceptance: "" }));
      await assert.rejects(create({ dependency_ids: ["30000000-0000-4000-8000-000000000009"] }));
      first = await create();
      dependent = await create({ title: "Verify the follow-up contribution", dependency_ids: [first, first] });
      assert.equal((await db.query("select * from public.task_dependencies where task_id=$1", [dependent])).rows.length, 1);
      assert.equal((await db.query<{ status: string }>("select status from public.tasks where id=$1", [first])).rows[0].status, "OPEN");
      await assert.rejects(db.query("insert into public.tasks(project_id,title) values($1,'Bypass')", [P]));
    });

    await t.test("dependencies and one-assignee ownership remain enforced", async () => {
      await as(C);
      await assert.rejects(db.query("select public.claim_task($1)", [dependent]));
      await db.query("select public.claim_task($1)", [first]);
      await as(B);
      await assert.rejects(db.query("select public.claim_task($1)", [first]));
      await assert.rejects(db.query("select public.release_task_claim($1,$2)", [first, "A stranger must never be able to release work."]));
      await assert.rejects(db.query("insert into public.task_handoffs(task_id,author_id,body) values($1,$2,$3)", [first, C, "A forged handoff must never be saved."]));
    });

    await t.test("release retains useful handoff and invalidates prior submission versions", async () => {
      await as(C);
      await assert.rejects(db.query("select public.release_task_claim($1,'short')", [first]));
      await db.query("select public.release_task_claim($1,$2)", [first, "Checked the first screen. The next contributor should test the callback."]);
      const state = (await db.query("select status,submission_version,submission_evidence from public.tasks where id=$1", [first])).rows[0];
      assert.deepEqual(state, { status: "OPEN", submission_version: 1, submission_evidence: null });
      assert.equal((await db.query("select * from public.task_assignments where task_id=$1", [first])).rows.length, 0);
      assert.equal((await db.query("select * from public.task_handoffs where task_id=$1", [first])).rows.length, 1);
      await assert.rejects(db.query("select public.release_task_claim($1,$2)", [first, "Repeated submission should not create a duplicate handoff."]));
      await as(B);
      await db.query("select public.claim_task($1)", [first]);
      await db.query("select public.update_work($1,'IN PROGRESS')", [first]);
      await db.query("select public.update_work($1,'REVIEW','https://github.com/clearframeworks/coders-for-humanity/pull/1')", [first]);
      await assert.rejects(db.query("select public.release_task_claim($1,$2)", [first, "A pending review cannot be silently abandoned."]));
      await as(A);
      await assert.rejects(db.query("select public.review_work($1,'APPROVED',$2,1)", [first, "The prior version must never authorize this new contribution."]));
      await db.query("select public.review_work($1,'APPROVED',$2,2)", [first, "Checked the acceptance criteria and the linked evidence carefully."]);
      await db.query("select public.update_work($1,'COMPLETE',null,2)", [first]);
      await as(C);
      await db.query("select public.claim_task($1)", [dependent]);
    });

    await t.test("public handoffs disappear with hidden projects and archived projects cannot be claimed", async () => {
      await as(undefined, true);
      assert.equal((await db.query("select * from public.task_handoffs where task_id=$1", [first])).rows.length, 1);
      await as();
      await db.query("update public.projects set published=false where id=$1", [P]);
      await as(undefined, true);
      assert.equal((await db.query("select * from public.task_handoffs where task_id=$1", [first])).rows.length, 0);
      await as();
      await db.query("update public.projects set published=true,status='ARCHIVED' where id=$1", [P]);
      await as(A);
      await assert.rejects(create());
      await assert.rejects(db.query("select public.claim_task($1)", ["cf100000-0000-4000-8000-000000000001"]));
    });
  } finally {
    await db.close();
  }
});
