import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { Script } from "node:vm";
import ts from "typescript";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

function load(file: string, dependencies: Record<string, unknown>) {
  const exports: Record<string, any> = {};
  const requireModule = createRequire(import.meta.url);
  const code = ts.transpileModule(readFileSync(resolve(file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Script(code, { filename: file }).runInNewContext({
    exports, process, Error,
    require: (name: string) => dependencies[name] ?? requireModule(name),
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
      "next/headers": { cookies: async () => ({ getAll: () => [cookie], set: () => {} }) },
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
