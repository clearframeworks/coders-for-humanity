import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Script } from "node:vm";
import ts from "typescript";

function helper({ connected = true, failure = false, joined = true } = {}) {
  const queries: { table: string; selection: string; filters: [string, string | boolean][] }[] = [];
  const data = { id: "membership-id", role: "Contributor", profiles: { name: "TEST Contributor", username: "test-contributor" } };
  const db = { from(table: string) { return { select(selection: string) {
    const query = { table, selection, filters: [] as [string, string | boolean][] };
    queries.push(query);
    const result = () => ({ data: query.selection === "id" ? joined ? { id: data.id } : null : [data], error: failure ? { message: "unavailable" } : null });
    const builder = {
      eq(field: string, value: string | boolean) { query.filters.push([field, value]); return builder; },
      maybeSingle: async () => result(),
      then(resolveResult: (value: unknown) => unknown, reject: (error: unknown) => unknown) { return Promise.resolve(result()).then(resolveResult, reject); },
    };
    return builder;
  } }; } };
  const exports: Record<string, any> = {};
  const code = ts.transpileModule(readFileSync(resolve("lib/project-people.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Script(code).runInNewContext({ exports, require: (name: string) => name === "./community" ? { communityReady: () => connected } : { createClient: async () => db } });
  return { load: exports.getProjectPeople, queries };
}

test("project directory queries retain profile visibility joins and project/actor scope", async () => {
  const { load, queries } = helper();
  const result = await load("project-a", Promise.resolve("member-a"));
  assert.equal(result.status, "ready");
  assert.equal(result.joined, true);
  assert.equal(result.members[0].profiles.username, "test-contributor");
  assert.equal(result.maintainers.length, 1);
  assert.equal(queries.length, 3);
  assert.ok(queries.every((query) => query.filters.some(([field, value]) => field === "project_id" && value === "project-a")));
  assert.ok(queries.slice(0, 2).every((query) => query.selection === "id,role,profiles!inner(name,username,is_public)"));
  assert.ok(queries.slice(0, 2).every((query) => query.filters.some(([field, value]) => field === "profiles.is_public" && value === true)));
  assert.ok(queries[2].filters.some(([field, value]) => field === "user_id" && value === "member-a"));
});

test("anonymous directories do not invent a membership and failures are distinct from empty lists", async () => {
  const guest = helper();
  assert.equal((await guest.load("project-a")).joined, false);
  assert.equal(guest.queries.length, 2);
  const failing = helper({ failure: true });
  assert.equal((await failing.load("project-a", "member-a")).status, "unavailable");
  const disconnected = helper({ connected: false });
  assert.equal((await disconnected.load("project-a")).status, "disconnected");
  assert.equal(disconnected.queries.length, 0);
});
