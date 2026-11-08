import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac, createHash, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

export const fixtureKey = "cfh-loopback-system-test-publishable-key";
export const projectId = "cf000000-0000-4000-8000-000000000001";
export const taskId = "cf100000-0000-4000-8000-000000000004";
export const personas = {
  alice: { id: "10000000-0000-4000-8000-000000000001", email: "alice@example.invalid", name: "TEST Alice" },
  bruno: { id: "10000000-0000-4000-8000-000000000002", email: "bruno@example.invalid", name: "TEST Bruno" },
  chris: { id: "10000000-0000-4000-8000-000000000003", email: "chris@example.invalid", name: "TEST Chris" },
  newcomer: { id: "10000000-0000-4000-8000-000000000004", email: "newcomer@example.invalid", name: "TEST Newcomer" },
};
type Persona = keyof typeof personas;
type Row = Record<string, any>;
const identifier = (value: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error("Unsupported fixture identifier");
  return `"${value}"`;
};
function jwt(persona: Persona) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: personas[persona].id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 7200 })}`;
  return `${unsigned}.${createHmac("sha256", "loopback-fixture-only-never-a-provider-secret").update(unsigned).digest("base64url")}`;
}
export function fixtureSession(persona: Persona) {
  const user = { ...personas[persona], aud: "authenticated", role: "authenticated", email_confirmed_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", app_metadata: { provider: "email" }, user_metadata: {}, identities: [] };
  return { access_token: jwt(persona), token_type: "bearer", expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, refresh_token: `fixture-refresh-${persona}`, user };
}
export function fixtureCookie(persona: Persona) {
  return { name: "cfh-auth", value: `base64-${Buffer.from(JSON.stringify(fixtureSession(persona))).toString("base64url")}`, domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const };
}
function actor(request: IncomingMessage): Persona | undefined {
  const token = request.headers.authorization?.replace(/^Bearer /i, "");
  if (!token) return;
  try {
    const [header, payload, signature] = token.split(".");
    const expected = createHmac("sha256", "loopback-fixture-only-never-a-provider-secret").update(`${header}.${payload}`).digest("base64url");
    if (signature !== expected) return;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (claims.exp < Date.now() / 1000) return;
    return (Object.keys(personas) as Persona[]).find((name) => personas[name].id === claims.sub);
  } catch { return; }
}
// Split PostgREST selections without splitting the fields inside embeddings.
function fields(select: string) {
  let depth = 0, current = "";
  const parts: string[] = [];
  for (const char of select) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) { parts.push(current); current = ""; }
    else current += char;
  }
  if (current) parts.push(current);
  return parts;
}

export async function createFixtureService(port = 54329) {
  const runId = randomUUID();
  let db: PGlite;
  let tables = new Set<string>();
  let columns = new Map<string, Set<string>>();
  let columnTypes = new Map<string, string>();
  let migrationFingerprint = "";
  let constraintNames = new Set<string>();
  let sequence = Promise.resolve();
  const transcript: { method: string; path: string; actor: string; status: number }[] = [];
  let testLink: { code: string; challenge: string } | undefined;
  let failNext: { path: string; method: string; status: 400 | 403 | 503 } | undefined;
  const serial = <T>(operation: () => Promise<T>): Promise<T> => {
    const next = sequence.then(operation);
    sequence = next.then(() => {}, () => {});
    return next;
  };
  async function reset() {
    if (db) await db.close();
    db = new PGlite();
    await db.exec("create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
    const migrationHash = createHash("sha256");
    for (const file of readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort()) {
      const sql = readFileSync(resolve("supabase/migrations", file), "utf8");
      migrationHash.update(file); migrationHash.update(sql);
      await db.exec(sql);
    }
    migrationFingerprint = migrationHash.digest("hex");
    for (const [name, persona] of Object.entries(personas)) {
      await db.query("insert into auth.users(id) values($1)", [persona.id]);
      if (name !== "newcomer") await db.query("insert into public.profiles(id,username,name,bio,availability,is_public) values($1,$2,$3,$4,$5,$6)", [persona.id, `test-${name}`, persona.name, "Synthetic local system test contributor.", "One test session", name !== "chris"]);
    }
    await db.query("insert into public.project_maintainers(project_id,user_id) values($1,$2),($1,$3)", [projectId, personas.alice.id, personas.bruno.id]);
    await db.query("insert into public.notifications(user_id,message) values($1,'TEST notification: your local test workspace is ready.')", [personas.alice.id]);
    tables = new Set((await db.query<{ tablename: string }>("select tablename from pg_tables where schemaname='public'")).rows.map((row) => row.tablename));
    columns = new Map();
    columnTypes = new Map();
    for (const row of (await db.query<{ table_name: string; column_name: string; data_type: string }>("select table_name,column_name,data_type from information_schema.columns where table_schema='public'")).rows) {
      if (!columns.has(row.table_name)) columns.set(row.table_name, new Set());
      columns.get(row.table_name)!.add(row.column_name);
      columnTypes.set(`${row.table_name}.${row.column_name}`, row.data_type);
    }
    constraintNames = new Set((await db.query<{ conname: string }>("select conname from pg_constraint where contype='f'")).rows.map((row) => row.conname));
    transcript.length = 0;
    testLink = undefined;
    failNext = undefined;
  }
  await reset();

  const relations: Record<string, string> = { profiles: "user_id", tasks: "task_id", projects: "project_id", community_posts: "post_id", project_metrics: "metric_id", skills: "skill_id" };
  async function projectRow(tx: any, table: string, row: Row, selection: string): Promise<Row | null> {
    const result: Row = {};
    for (const part of fields(selection)) {
      if (part === "*") { Object.assign(result, row); continue; }
      const embedded = /^([a-z_]+)(?:!([^()]+))?\((.*)\)$/.exec(part);
      if (!embedded) {
        identifier(part);
        if (!columns.get(table)?.has(part)) throw new Error(`Unknown fixture column: ${table}.${part}`);
        result[part] = row[part]; continue;
      }
      const [, relation, hint, nested] = embedded;
      if (!tables.has(relation)) throw new Error(`Unsupported fixture relation: ${relation}`);
      if (hint && hint !== "inner" && !constraintNames.has(hint)) throw new Error(`Unsupported fixture relationship hint: ${hint}`);
      let foreign = relations[relation];
      if (relation === "profiles" && table === "community_posts") foreign = "author_id";
      if (relation === "profiles" && table === "reviews") foreign = "reviewer_id";
      let related: Row[];
      if (relation === "task_assignments" && table === "tasks")
        related = (await tx.query("select * from public.task_assignments where task_id=$1", [row.id])).rows;
      else {
        if (!foreign) throw new Error(`Unsupported fixture relation: ${table}.${relation}`);
        related = row[foreign] == null ? [] : (await tx.query(`select * from public.${identifier(relation)} where id=$1`, [row[foreign]])).rows;
      }
      result[relation] = related[0] ? await projectRow(tx, relation, related[0], nested) : null;
      if (hint === "inner" && !result[relation]) return null;
    }
    return result;
  }
  function where(table: string, params: URLSearchParams, values: unknown[]) {
    const clauses: string[] = [];
    for (const [key, value] of params) {
      if (["select", "order", "limit", "offset"].includes(key) || key.includes(".")) continue;
      const column = identifier(key);
      if (!columns.get(table)?.has(key)) throw new Error(`Unknown fixture column: ${table}.${key}`);
      const dot = value.indexOf(".");
      const operator = value.slice(0, dot), raw = value.slice(dot + 1);
      const typed = (input: string) => {
        if (columnTypes.get(`${table}.${key}`) !== "boolean") return input;
        if (input !== "true" && input !== "false") throw new Error(`Invalid fixture boolean filter: ${key}`);
        return input === "true";
      };
      if (operator === "is" && raw === "null") clauses.push(`${column} is null`);
      else if (operator === "eq" || operator === "neq") { values.push(typed(raw)); clauses.push(`${column}${operator === "eq" ? "=" : "<>"}$${values.length}`); }
      else if (operator === "in" && raw.startsWith("(") && raw.endsWith(")")) {
        const list = raw.slice(1, -1).split(",").map((item) => item.replace(/^"|"$/g, ""));
        clauses.push(list.length ? `${column} in (${list.map((item) => { values.push(typed(item)); return `$${values.length}`; }).join(",")})` : "false");
      } else throw new Error(`Unsupported fixture filter: ${key}=${value}`);
    }
    return clauses.length ? ` where ${clauses.join(" and ")}` : "";
  }
  async function rest(request: IncomingMessage, url: URL, body: Row, persona?: Persona) {
    const route = url.pathname.replace("/rest/v1/", "");
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [persona ? personas[persona].id : ""]);
      await tx.exec(`set local role ${persona ? "authenticated" : "anon"}`);
      if (route.startsWith("rpc/")) {
        if (request.method !== "POST") throw new Error("Fixture RPCs require POST");
        const name = route.slice(4);
        if (!["publish_post", "save_post", "join_project", "claim_task", "update_work", "review_work", "read_notifications", "submit_proposal"].includes(name)) throw new Error("Unsupported fixture RPC");
        const args = Object.entries(body);
        const row = await tx.query<{ result: unknown }>(`select public.${identifier(name)}(${args.map(([key], index) => `${identifier(key)} => $${index + 1}`).join(",")}) as result`, args.map(([, value]) => typeof value === "object" && value !== null ? JSON.stringify(value) : value));
        return { status: 200, data: row.rows[0]?.result ?? null, count: 1 };
      }
      if (!tables.has(route)) throw new Error(`Unsupported fixture table: ${route}`);
      const table = identifier(route), values: unknown[] = [];
      let query: string;
      if (request.method === "GET" || request.method === "HEAD") {
        query = `select * from public.${table}${where(route, url.searchParams, values)}`;
        const order = url.searchParams.get("order");
        if (order) query += ` order by ${order.split(",").map((item) => {
          const [field, direction, extra] = item.split(".");
          if (extra || (direction && !["asc", "desc"].includes(direction))) throw new Error("Unsupported fixture ordering");
          return `${identifier(field)} ${direction === "desc" ? "desc" : "asc"}`;
        }).join(",")}`;
      } else if (request.method === "POST") {
        const entries = Object.entries(body);
        values.push(...entries.map(([, value]) => value));
        query = `insert into public.${table}(${entries.map(([key]) => identifier(key)).join(",")}) values(${entries.map((_, index) => `$${index + 1}`).join(",")}) returning *`;
      } else if (request.method === "PATCH") {
        const entries = Object.entries(body);
        values.push(...entries.map(([, value]) => value));
        query = `update public.${table} set ${entries.map(([key], index) => `${identifier(key)}=$${index + 1}`).join(",")}${where(route, url.searchParams, values)} returning *`;
      } else throw new Error("Unsupported fixture method");
      const rows = (await tx.query<Row>(query, values)).rows;
      const projected: Row[] = [];
      for (const row of rows) {
        const item = await projectRow(tx, route, row, url.searchParams.get("select") || "*");
        if (!item) continue;
        let matches = true;
        for (const [key, value] of url.searchParams) if (key.includes(".")) {
          const actual = key.split(".").reduce((current, field) => current?.[field], item);
          if (!value.startsWith("eq.") || String(actual) !== value.slice(3)) matches = false;
        }
        if (matches) projected.push(item);
      }
      const count = projected.length;
      for (const modifier of ["limit", "offset"]) if (url.searchParams.has(modifier) && !/^\d+$/.test(url.searchParams.get(modifier)!)) throw new Error(`Invalid fixture ${modifier}`);
      const limited = projected.slice(Number(url.searchParams.get("offset") || 0), Number(url.searchParams.get("offset") || 0) + Math.min(Number(url.searchParams.get("limit") || 1000), 1000));
      if (request.headers.accept?.includes("application/vnd.pgrst.object+json")) {
        if (limited.length !== 1) return { status: 406, data: { code: "PGRST116", details: `The result contains ${limited.length} rows`, message: "Cannot coerce the result to a single JSON object" }, count };
        return { status: request.method === "POST" ? 201 : 200, data: limited[0], count };
      }
      return { status: request.method === "POST" ? 201 : 200, data: limited, count };
    });
  }
  function send(response: ServerResponse, status: number, data: unknown) {
    response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(status === 204 ? undefined : JSON.stringify(data));
  }
  const server = createServer((request, response) => {
    void serial(async () => {
      try {
        const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
        if (request.headers.host !== `127.0.0.1:${port}`) return send(response, 403, { message: "Loopback fixture host required" });
        if (url.pathname.startsWith("/__test/")) {
          const allowed = new Set([`http://127.0.0.1:${port}`, "http://127.0.0.1:3101"]);
          const origin = request.headers.origin;
          let refererOrigin: string | undefined;
          if (request.headers.referer) {
            try { refererOrigin = new URL(request.headers.referer).origin; } catch { refererOrigin = "invalid"; }
          }
          if ((origin && !allowed.has(origin)) || (refererOrigin && !allowed.has(refererOrigin))) return send(response, 403, { message: "External origins cannot control local fixtures" });
        }
        let raw = "";
        for await (const chunk of request) { raw += chunk; if (raw.length > 100000) throw new Error("Fixture request too large"); }
        const body = raw ? JSON.parse(raw) : {};
        if (url.pathname === "/__test/console" && request.method === "GET") {
          const links = (Object.keys(personas) as Persona[]).map((name) => `<li><a href="/__test/login?persona=${name}">${personas[name].name}</a><span>${name === "newcomer" ? "No profile yet" : name === "chris" ? "Private profile" : name === "bruno" ? "Independent project reviewer" : "Public contributor and maintainer"}</span></li>`).join("");
          response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'", "x-frame-options": "DENY", "referrer-policy": "same-origin" });
          response.end(readFileSync(resolve("tests/system/console.html"), "utf8").replace("__TEST_PERSONAS__", links));
          return;
        }
        if (url.pathname === "/__test/login" && request.method === "GET") {
          const persona = url.searchParams.get("persona");
          if (persona !== "guest" && (!persona || !(persona in personas))) return send(response, 400, { message: "Select a known local test persona" });
          const cookie = persona === "guest" ? "cfh-auth=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly" : `cfh-auth=${fixtureCookie(persona as Persona).value}; Path=/; SameSite=Lax; HttpOnly`;
          response.writeHead(302, { "set-cookie": cookie, location: `http://127.0.0.1:3101/${persona === "guest" ? "" : "account"}`, "cache-control": "no-store" });
          response.end(); return;
        }
        if (url.pathname === "/__test/health") return send(response, 200, { status: "ready", runId, migrationFingerprint, boundary: "loopback synthetic auth; real PGlite migrations/RLS" });
        if (url.pathname === "/__test/reset" && request.method === "POST") { await reset(); return send(response, 200, { reset: true }); }
        if (url.pathname === "/__test/requests") return send(response, 200, transcript);
        if (url.pathname === "/__test/sign-in-code" && request.method === "GET")
          return testLink ? send(response, 200, { code: testLink.code }) : send(response, 404, { message: "No local sign-in code requested" });
        if (url.pathname === "/__test/fail-next" && request.method === "POST") {
          if (typeof body.path !== "string" || !body.path.startsWith("/rest/v1/") || !["GET", "POST", "PATCH", "HEAD"].includes(body.method)) return send(response, 400, { message: "Provide an exact /rest/v1/ path and supported method" });
          const status = body.status ?? 503;
          if (![400, 403, 503].includes(status)) return send(response, 400, { message: "Fixture failure status must be 400, 403, or 503" });
          failNext = { path: body.path, method: body.method, status };
          return send(response, 200, { armed: failNext });
        }
        if (url.pathname === "/__test/personas") return send(response, 200, Object.fromEntries((Object.keys(personas) as Persona[]).map((name) => [name, { ...personas[name], session: fixtureSession(name), cookie: fixtureCookie(name) }])));
        if (url.pathname === "/auth/v1/settings") return send(response, 200, { external: { email: true, github: false }, disable_signup: false });
        const persona = actor(request);
        if (url.pathname.startsWith("/rest/v1/")) {
          const entry = { method: request.method || "GET", path: url.pathname, actor: persona || "anon", status: 500 };
          transcript.push(entry);
          response.once("finish", () => { entry.status = response.statusCode; });
          if (failNext?.path === url.pathname && failNext.method === request.method) {
            const status = failNext.status;
            failNext = undefined;
            return send(response, status, { code: status === 400 ? "TEST_QUERY_ERROR" : status === 403 ? "TEST_PERMISSION_DENIED" : "TEST_INJECTED_FAILURE", message: status === 503 ? "Synthetic local database connection interrupted" : status === 403 ? "Synthetic local permission denial" : "Synthetic local query failure", details: null, hint: null });
          }
        }
        if (url.pathname === "/auth/v1/user") return persona ? send(response, 200, fixtureSession(persona).user) : send(response, 401, { code: "bad_jwt", message: "Local test identity required" });
        if (url.pathname === "/auth/v1/logout") return send(response, 204, null);
        if (url.pathname === "/auth/v1/otp" && request.method === "POST" && body.email === personas.alice.email) {
          if (body.code_challenge_method !== "s256" || typeof body.code_challenge !== "string")
            return send(response, 400, { message: "The fixture requires PKCE" });
          testLink = { code: randomUUID(), challenge: body.code_challenge };
          return send(response, 200, {});
        }
        if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "pkce" && request.method === "POST") {
          const challenge = typeof body.code_verifier === "string"
            ? createHash("sha256").update(body.code_verifier).digest("base64url")
            : null;
          if (!testLink || body.auth_code !== testLink.code || challenge !== testLink.challenge)
            return send(response, 400, { message: "Invalid local sign-in code or verifier" });
          testLink = undefined;
          return send(response, 200, fixtureSession("alice"));
        }
        if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
          const name = String(body.refresh_token).replace("fixture-refresh-", "") as Persona;
          return name in personas ? send(response, 200, fixtureSession(name)) : send(response, 401, { message: "Unknown fixture session" });
        }
        if (!url.pathname.startsWith("/rest/v1/")) return send(response, 404, { message: "Not implemented by loopback system harness" });
        const schema = request.headers[request.method === "GET" || request.method === "HEAD" ? "accept-profile" : "content-profile"];
        if (schema !== "cfh") return send(response, 400, { message: "Fixture requires the app's explicit cfh schema header" });
        const result = await rest(request, url, body, persona);
        response.setHeader("content-range", `0-${Math.max(0, result.count - 1)}/${result.count}`);
        if (request.method === "HEAD") { response.writeHead(result.status); response.end(); }
        else send(response, result.status, result.data);
      } catch (error) {
        const failure = error as { code?: string; message?: string };
        send(response, failure.code === "42501" ? 403 : 400, { code: failure.code || "FIXTURE_ERROR", message: failure.message || "Local fixture request failed", details: null, hint: null });
      }
    });
  });
  await new Promise<void>((done, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", done); });
  return { server, reset: () => serial(reset), close: async () => { await new Promise<void>((done) => server.close(() => done())); await sequence; await db.close(); } };
}
async function main() {
  const service = await createFixtureService(Number(process.env.CFH_FIXTURE_PORT || 54329));
  console.log("CFH synthetic system backend ready on http://127.0.0.1:54329");
  process.on("SIGINT", () => { void service.close().then(() => process.exit()); });
  process.on("SIGTERM", () => { void service.close().then(() => process.exit()); });
}
if (process.argv[1]?.endsWith("fixture-service.ts")) void main();
