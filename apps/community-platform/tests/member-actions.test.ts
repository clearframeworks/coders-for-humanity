import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";
import { profileSchema, proposalSchema } from "../lib/validation";
import { safeNext } from "../lib/filters";
import * as authCookies from "../lib/auth-cookies";

// Exercise the actual server actions; substitute only the framework and network boundaries.
function actions(db: any, github = false, setCookie = (..._args: any[]) => {}) {
  const exports: Record<string, any> = {};
  const dependencies: Record<string, unknown> = {
    "next/headers": { headers: async () => new Headers({ origin: "https://cfh.test" }), cookies: async () => ({ set: setCookie }) },
    "next/navigation": { redirect: (url: string) => { throw new Error(`redirect:${url}`); } },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/supabase": { createClient: async () => db, configured: () => true, isDemo: () => false, githubAuthEnabled: () => github },
    "@/lib/validation": { profileSchema, proposalSchema },
    "@/lib/filters": { safeNext },
    "@/lib/auth-cookies": authCookies,
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

test("remember choice is saved only for a successful request and cleared on local sign-out", async () => {
  let failure = true;
  const writes: any[][] = [];
  const app = actions({ auth: {
    signInWithOtp: async () => ({ error: failure ? { code: "failed" } : null }),
    signOut: async (options: { scope: string }) => {
      assert.equal(options.scope, "local");
      return { error: null };
    },
  } }, false, (...args) => { writes.push(args); });
  const form = new FormData();
  form.set("email", "member@example.invalid");
  form.set("remember", "on");
  assert.ok((await app.signIn({}, form)).error);
  assert.equal(writes.length, 0);
  failure = false;
  assert.ok((await app.signIn({}, form)).message);
  form.delete("remember");
  assert.ok((await app.signIn({}, form)).message);
  assert.deepEqual(writes.map(([name, value]) => [name, value]), [
    [authCookies.pendingRememberCookie, "1"], [authCookies.pendingRememberCookie, "0"],
  ]);
  assert.equal(writes[0][2].httpOnly, true);
  assert.equal(writes[0][2].secure, true);
  await assert.rejects(app.signOut(), /redirect:\//);
  assert.deepEqual(writes.slice(2).map(([name, value, options]) => [name, value, options.maxAge]), [
    [authCookies.pendingRememberCookie, "", 0], [authCookies.sessionOnlyCookie, "", 0],
  ]);
});
