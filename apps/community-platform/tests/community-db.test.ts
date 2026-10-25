import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { humanWork, foundingWorkId } from "../lib/harness";
const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const C = "10000000-0000-4000-8000-000000000003";
const P = "cf000000-0000-4000-8000-000000000001";
const H = "20000000-0000-4000-8000-000000000002";
const T = "30000000-0000-4000-8000-000000000001";
test("Community authorization, thread isolation, and independent work acceptance", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`,
    );
    for (const migration of [
      "20260928025534_institutional_foundation.sql",
      "20260928034553_community_workspace.sql",
      "20260928040326_founding_human_work.sql",
    ]) {
      await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
    }
    await db.exec(
      `insert into auth.users values('${A}'),('${B}'),('${C}'); insert into public.profiles(id,username,name,is_public) values('${A}','alice','Alice',true),('${B}','bruno','Bruno',true),('${C}','chris','Chris',false); insert into public.projects(id,slug,name,program_id,summary,problem,objective,published) values('${H}','hidden-project','Hidden project','food','Summary','Problem','Objective',false); insert into public.tasks(id,project_id,title,discipline,level,effort,technology,objective,context,acceptance) values('${T}','${P}','Review the boundaries','Security','Advanced','1–3 hours','Postgres','Objective','Context','Acceptance'); insert into public.project_maintainers(project_id,user_id) values('${P}','${A}'),('${P}','${B}');`,
    );
    const asRole = async (
      role: "anon" | "authenticated" | "postgres",
      id = "",
    ) => {
      await db.exec(
        `reset role; select set_config('request.jwt.claim.sub','${id}',false);${role === "postgres" ? "" : `set role ${role};`}`,
      );
    };
    const publish = async (
      title: string,
      project: string | null = null,
      parent: string | null = null,
    ) =>
      (
        await db.query<{
          id: string;
        }>("select public.publish_post($1,$2,$3,$4,$5) as id", [
          title,
          "Useful community context.",
          "discussion",
          project,
          parent,
        ])
      ).rows[0].id;
    let root = "",
      reply = "";
    await t.test(
      "hosted founding tasks exactly match the public handoff and stable UUIDs",
      async () => {
        const { rows } = await db.query(
          "select id,project_id,title,discipline,level,effort,technology,objective,context,acceptance,dependencies,reviewer,assignee,issue_url,status,is_demo from public.tasks where id::text like $1 order by id",
          ["cf100000-%"],
        );
        assert.equal(rows.length, 7);
        assert.deepEqual(
          rows,
          [...humanWork].sort((a, b) => a.id.localeCompare(b.id)),
        );
        assert.equal(
          foundingWorkId("cfh-harness"),
          "cf100000-0000-4000-8000-000000000001",
        );
        // PostgREST discovers the embedding as one-to-one from this PK/FK.
        const uniqueAssignment = await db.query(
          "select pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.task_assignments'::regclass and contype='p'",
        );
        assert.deepEqual(uniqueAssignment.rows, [
          { definition: "PRIMARY KEY (task_id)" },
        ]);
      },
    );
    await t.test(
      "anonymous and authenticated callers cannot bypass write RPCs",
      async () => {
        for (const role of ["anon", "authenticated"] as const) {
          await asRole(role, role === "anon" ? "" : A);
          await assert.rejects(
            db.query(
              `insert into public.community_posts(author_id,kind,title,body) values('${B}','discussion','Forged post','Forged author')`,
            ),
          );
          await assert.rejects(
            db.query(
              `insert into public.project_maintainers(project_id,user_id) values('${P}','${C}')`,
            ),
          );
          await assert.rejects(
            db.query(
              `update public.tasks set status='COMPLETE' where id='${T}'`,
            ),
          );
        }
        await asRole("anon");
        await assert.rejects(publish("Anonymous post"));
        await assert.rejects(db.query(`select public.join_project('${P}')`));
      },
    );
    await t.test(
      "posting requires a public profile and published project",
      async () => {
        await asRole("authenticated", C);
        await assert.rejects(publish("Private profile"));
        await asRole("authenticated", A);
        await assert.rejects(publish("Private project", H));
        root = await publish("A real discussion", P);
        await asRole("authenticated", B);
        reply = await publish("", null, root);
        await assert.rejects(publish("", null, reply));
        await assert.rejects(
          publish("Bad content", null, "ffffffff-ffff-4fff-8fff-ffffffffffff"),
        );
      },
    );
    await t.test(
      "hiding a thread also hides replies and prevents saving or replying",
      async () => {
        await asRole("authenticated", B);
        await db.query("select public.save_post($1,true)", [reply]);
        await asRole("postgres");
        await db.query(
          "update public.community_posts set hidden=true where id=$1",
          [root],
        );
        for (const role of ["anon", "authenticated"] as const) {
          await asRole(role, A);
          assert.equal(
            (await db.query("select * from public.community_posts")).rows
              .length,
            0,
          );
        }
        await asRole("authenticated", B);
        await assert.rejects(
          db.query("select public.save_post($1,true)", [reply]),
        );
        await assert.rejects(publish("", null, root));
        await db.query("select public.save_post($1,false)", [reply]);
        assert.equal(
          (await db.query("select * from public.saved_posts")).rows.length,
          0,
        );
        await asRole("postgres");
        await db.query(
          "update public.community_posts set hidden=false where id=$1",
          [root],
        );
        await db.query(
          "update public.projects set published=false where id=$1",
          [P],
        );
        await asRole("anon");
        assert.equal(
          (await db.query("select * from public.community_posts")).rows.length,
          0,
        );
        await asRole("authenticated", B);
        await assert.rejects(publish("", null, root));
        await asRole("postgres");
        await db.query(
          "update public.projects set published=true where id=$1",
          [P],
        );
      },
    );
    await t.test(
      "saved conversations and notifications stay private",
      async () => {
        await asRole("authenticated", A);
        await db.query("select public.save_post($1,true)", [root]);
        assert.equal(
          (await db.query("select * from public.notifications")).rows.length,
          1,
        );
        await asRole("authenticated", B);
        assert.equal(
          (await db.query("select * from public.saved_posts")).rows.length,
          0,
        );
        assert.equal(
          (await db.query("select * from public.notifications")).rows.length,
          0,
        );
        await db.query("select public.read_notifications()");
        await asRole("authenticated", A);
        assert.equal(
          (
            await db.query<{
              read_at: string | null;
            }>("select read_at from public.notifications")
          ).rows[0].read_at,
          null,
        );
        await db.query("select public.read_notifications()");
        assert.ok(
          (
            await db.query<{
              read_at: string | null;
            }>("select read_at from public.notifications")
          ).rows[0].read_at,
        );
      },
    );
    await t.test(
      "joining is idempotent and never grants maintainer authority",
      async () => {
        await asRole("authenticated", C);
        await assert.rejects(db.query(`select public.join_project('${P}')`));
        await asRole("authenticated", A);
        await assert.rejects(db.query(`select public.join_project('${H}')`));
        await db.query(`select public.join_project('${P}')`);
        await db.query(`select public.join_project('${P}')`);
        const members = await db.query<{
          role: string;
        }>(`select role from public.project_members where user_id='${A}'`);
        assert.deepEqual(members.rows, [{ role: "Contributor" }]);
      },
    );
    await t.test(
      "submission needs evidence; self review and self acceptance are denied",
      async () => {
        await asRole("authenticated", A);
        await db.query(`select public.claim_task('${T}')`);
        await assert.rejects(
          db.query(`select public.update_work('${T}','REVIEW')`),
        );
        await db.query(`select public.update_work('${T}','IN PROGRESS')`);
        await assert.rejects(
          db.query(`select public.update_work('${T}','REVIEW')`),
        );
        await db.query(
          `select public.update_work('${T}','REVIEW','https://github.com/clearframeworks/coders-for-humanity/pull/1')`,
        );
        await assert.rejects(
          db.query(
            `select public.review_work('${T}','APPROVED','I approve my own changes without review',1)`,
          ),
        );
        await assert.rejects(
          db.query(`select public.update_work('${T}','COMPLETE',null,1)`),
        );
        await asRole("authenticated", C);
        await assert.rejects(
          db.query(
            `select public.review_work('${T}','APPROVED','I am not the project maintainer',1)`,
          ),
        );
        await asRole("authenticated", B);
        await assert.rejects(
          db.query(`select public.update_work('${T}','COMPLETE',null,1)`),
        );
      },
    );
    await t.test("changed submissions invalidate prior approval", async () => {
      await asRole("authenticated", B);
      await db.query(
        `select public.review_work('${T}','APPROVED','Reviewed the evidence and authorization checks',1)`,
      );
      await db.query(
        `select public.review_work('${T}','CHANGES REQUESTED','Found an edge case that requires a new submission',1)`,
      );
      await asRole("authenticated", A);
      await db.query(
        `select public.update_work('${T}','REVIEW','https://github.com/clearframeworks/coders-for-humanity/pull/1#new-evidence')`,
      );
      await asRole("authenticated", B);
      await assert.rejects(
        db.query(`select public.update_work('${T}','COMPLETE',null,2)`),
      );
      await assert.rejects(
        db.query(
          `select public.review_work('${T}','APPROVED','Stale browser tab reviewing the previous submission',1)`,
        ),
      );
      await db.query(
        `select public.review_work('${T}','APPROVED','Verified the revised evidence and all regression checks',2)`,
      );
      await assert.rejects(
        db.query(`select public.update_work('${T}','COMPLETE',null,1)`),
      );
      await db.query(`select public.update_work('${T}','COMPLETE',null,2)`);
      assert.equal(
        (
          await db.query<{
            status: string;
          }>(`select status from public.tasks where id='${T}'`)
        ).rows[0].status,
        "COMPLETE",
      );
      await assert.rejects(
        db.query(`select public.update_work('${T}','IN PROGRESS')`),
      );
    });
    await t.test(
      "rate limits and exposed table RLS remain enforced",
      async () => {
        await asRole("authenticated", A);
        for (let i = 0; i < 19; i++) await publish(`Discussion number ${i}`);
        await assert.rejects(publish("The rate limited conversation"));
        await asRole("postgres");
        assert.equal(
          (
            await db.query(
              "select relname from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r' and not relrowsecurity",
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef",
            )
          ).rows.length,
          0,
        );
      },
    );
  } finally {
    await db.close();
  }
});
