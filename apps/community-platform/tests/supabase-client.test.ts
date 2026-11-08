import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { Script } from "node:vm";
import ts from "typescript";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import * as authCookies from "../lib/auth-cookies";
import { callbackFailurePath, safeNext } from "../lib/filters";

function load(file: string, dependencies: Record<string, unknown>) {
  const exports: Record<string, any> = {};
  const requireModule = createRequire(import.meta.url);
  const code = ts.transpileModule(readFileSync(resolve(file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Script(code, { filename: file }).runInNewContext({
    exports, process, Error, URL,
    require: (name: string) => dependencies[name] ?? (
      name === "./auth-cookies" || name === "@/lib/auth-cookies" ? authCookies : requireModule(name)
    ),
  });
  return exports;
}

test("server and proxy preserve the CFH schema and existing session cookie", async () => {
  const names = ["CFH_DEMO_MODE", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.CFH_DEMO_MODE = "false";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://cfh.example.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
  const session = {
    access_token: "test-access-token", refresh_token: "test-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: "11111111-1111-4111-8111-111111111111" },
  };
  const cookie = { name: "cfh-auth", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}` };
  const requests: Headers[] = [];
  const makeClient = (url: string, key: string, options: any) => createServerClient(url, key, {
    ...options,
    global: { fetch: async (_input: unknown, init?: RequestInit) => {
      requests.push(new Headers(init?.headers));
      return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    } },
  });
  try {
    const server = load("lib/supabase.ts", {
      "@supabase/ssr": { createServerClient: makeClient },
      "next/headers": { cookies: async () => ({ get: () => undefined, getAll: () => [cookie], set: () => {} }) },
    });
    const db = await server.createClient();
    const restored = await db.auth.getSession();
    assert.equal(restored.data.session?.access_token, session.access_token, "Existing CFH sessions remain readable");
    await db.from("profiles").select("id").limit(0);
    assert.equal(requests[0].get("accept-profile"), "cfh", "Account records must use the deployed CFH schema");
    assert.equal(requests[0].get("authorization"), `Bearer ${session.access_token}`);

    const request = new NextRequest("https://cfh.example.invalid/account", { headers: { cookie: `${cookie.name}=${cookie.value}` } });
    const proxy = load("proxy.ts", {
      "next/server": { NextResponse },
      "@supabase/ssr": { createServerClient: (url: string, key: string, options: any) => {
        const client = makeClient(url, key, options);
        return { auth: { getClaims: async () => {
          const restored = await client.auth.getSession();
          assert.equal(restored.data.session?.access_token, session.access_token, "Proxy must read the same existing cookie");
          await client.from("profiles").select("id").limit(0);
          options.cookies.setAll([{ name: "cfh-auth", value: "refreshed-session", options: { path: "/", httpOnly: true } }]);
          return { data: null, error: null };
        } } };
      } },
    });
    const response = await proxy.proxy(request);
    assert.equal(requests[1].get("accept-profile"), "cfh");
    assert.equal(request.cookies.get("cfh-auth")?.value, "refreshed-session");
    assert.equal(response.cookies.get("cfh-auth")?.value, "refreshed-session");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test("session-only writes remove expiration from session chunks but keep deletion and PKCE options", () => {
  const { authCookieOptions } = authCookies;
  const expires = new Date("2027-01-01T00:00:00Z");
  const durable = { maxAge: 3600, expires, path: "/", httpOnly: true };
  assert.equal(authCookieOptions("cfh-auth", "session", durable, false), durable);
  for (const name of ["cfh-auth", "cfh-auth.0", "cfh-auth.1"]) {
    assert.deepEqual(authCookieOptions(name, "session", durable, true), { path: "/", httpOnly: true });
  }
  const remove = { ...durable, maxAge: 0 };
  assert.equal(authCookieOptions("cfh-auth.0", "", remove, true), remove);
  assert.equal(authCookieOptions("cfh-auth-code-verifier", "verifier", durable, true), durable);
});

test("callback uses the browser preference only after a successful code exchange", async () => {
  for (const [preference, valid] of [[undefined, true], ["0", true], ["1", true], ["1", false]] as const) {
    const writes: any[][] = [];
    const callback = load("app/auth/callback/route.ts", {
      "next/server": { NextResponse },
      "next/headers": { cookies: async () => ({
        get: () => preference === undefined ? undefined : { value: preference },
        set: (...args: any[]) => { writes.push(args); },
      }) },
      "@/lib/filters": { callbackFailurePath, safeNext },
      "@/lib/supabase": {
        isDemo: () => false,
        configured: () => true,
        createClient: async (sessionOnly: boolean) => {
          assert.equal(sessionOnly, preference !== "1");
          return { auth: { exchangeCodeForSession: async (code: string) => {
            assert.equal(code, "synthetic");
            return { error: valid ? null : new Error("Invalid code") };
          } } };
        },
      },
    });
    const request = new NextRequest("https://cfh.example.invalid/auth/callback?code=synthetic&next=%2Faccount");
    const response = await callback.GET(request);
    assert.equal(new URL(response.headers.get("location")).pathname, valid ? "/account" : "/login");
    assert.deepEqual(writes.map(([name, value, options]) => [name, value, options.maxAge]), valid ? [
      [authCookies.sessionOnlyCookie, preference === "1" ? "" : "1", preference === "1" ? 0 : undefined],
      [authCookies.pendingRememberCookie, "", 0],
    ] : []);
  }
});
