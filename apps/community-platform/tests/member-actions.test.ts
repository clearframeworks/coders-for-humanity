import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";
import { profileSchema, proposalSchema } from "../lib/validation";
import { safeNext } from "../lib/filters";

// Exercise the actual server actions; substitute only the framework and network boundaries.
function actions(db: any, github = false) {
  const exports: Record<string, any> = {};
  const dependencies: Record<string, unknown> = {
    "next/headers": { headers: async () => new Headers({ origin: "https://cfh.test" }) },
    "next/navigation": { redirect: (url: string) => { throw new Error(`redirect:${url}`); } },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/supabase": { createClient: async () => db, configured: () => true, isDemo: () => false, githubAuthEnabled: () => github },
    "@/lib/validation": { profileSchema, proposalSchema },
    "@/lib/filters": { safeNext },
  };
  const code = ts.transpileModule(readFileSync("app/actions.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Script(code).runInNewContext({ exports, Error, URL, process: { env: { NEXT_PUBLIC_SITE_URL: "https://cfh.test" } }, require: (name: string) => dependencies[name] });
  return exports;
}
const profile = { username: "member", name: "Member", bio: "", location: "", availability: "", github_url: "", website_url: "", is_public: false };

test("invalid profile fields return actionable field feedback before authentication or writes", async () => {
  const db = { auth: { getUser: () => { throw new Error("Invalid profile must not reach authentication"); } } };
  const result = await actions(db).saveProfile({ ...profile, username: "Wrong Name" });
  assert.equal(result.field, "username");
  assert.match(result.error, /3–40 lowercase letters/);
  assert.equal(result.message, undefined);
});

test("profile success requires a returned own row; silent denied updates never succeed", async () => {
  for (const existing of [true, false]) {
    for (const saved of [null, { id: "other", username: "member", is_public: false }, { id: "self", username: "member", is_public: false }]) {
      const db = {
        auth: { getUser: async () => ({ data: { user: { id: "self" } } }) },
        from: (table: string) => {
          assert.equal(table, "profiles");
          const chain: any = {
            select: () => chain,
            eq: (key: string, value: string) => { assert.equal(key, "id"); assert.equal(value, "self"); return chain; },
            maybeSingle: async () => ({ data: existing ? { id: "self" } : null }),
            update: (values: unknown) => { assert.ok(existing); assert.equal((values as any).is_public, false); return chain; },
            insert: (values: any) => { assert.ok(!existing); assert.equal(values.id, "self"); return chain; },
            single: async () => ({ data: saved, error: null }),
          };
          return chain;
        },
      };
      const result = await actions(db).saveProfile(profile);
      assert.equal(Boolean(result.message), saved?.id === "self");
      assert.equal(Boolean(result.error), saved?.id !== "self");
    }
  }
});

test("disabled GitHub cannot start OAuth; email registration keeps its safe return path", async () => {
  let sent = false;
  const db = { auth: {
    signInWithOAuth: () => { throw new Error("Disabled provider was called"); },
    signInWithOtp: async (request: any) => {
      sent = true;
      assert.equal(request.options.shouldCreateUser, true);
      assert.equal(request.options.emailRedirectTo, "https://cfh.test/auth/callback?next=%2Fjoin");
      return { error: null };
    },
  } };
  const form = new FormData();
  form.set("provider", "github");
  assert.match((await actions(db).signIn({}, form)).error, /Use your email/);
  form.set("provider", "email");
  form.set("email", "member@example.invalid");
  form.set("intent", "signup");
  form.set("next", "/join");
  assert.match((await actions(db).signIn({}, form)).message, /Check your email/);
  assert.equal(sent, true);
});
