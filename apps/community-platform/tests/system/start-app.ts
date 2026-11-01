import { cp, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fixtureKey } from "./fixture-service";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { runtimeInventory, migrationFingerprint } from "./runtime-inventory";

async function main() {
  const backend = "http://127.0.0.1:54329";
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== backend)
    throw new Error("System tests refuse an inherited external backend. Clear NEXT_PUBLIC_SUPABASE_URL before starting.");
  if (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== fixtureKey)
    throw new Error("System tests refuse an inherited provider key. Clear NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY before starting.");
  const original = process.cwd();
  const backendHealth = await (await fetch(`${backend}/__test/health`)).json();
  if (backendHealth.status !== "ready" || !backendHealth.runId || backendHealth.boundary !== "loopback synthetic auth; real PGlite migrations/RLS") throw new Error("Expected an attested local fixture backend");
  const stage = await mkdtemp(join(tmpdir(), "cfh-system-app-"));
  const excluded = new Set(["node_modules", ".next", ".git", ".vercel", "test-results", "playwright-report", "output", "outputs"]);
  await cp(original, stage, { recursive: true, filter: (path) => !excluded.has(basename(path)) && !basename(path).startsWith(".env") });
  const inventory = await runtimeInventory(stage);
  const migrations = await migrationFingerprint(stage);
  if (migrations !== backendHealth.migrationFingerprint) throw new Error("Fixture database migrations differ from the staged app source; restart/reset the fixture backend.");
  const manifest = { fixture: "cfh-loopback-system", mode: "production-build", runId: randomUUID(), backendRunId: backendHealth.runId, sourceFingerprint: inventory.fingerprint, runtimeFiles: inventory.files, migrationFingerprint: migrations, sourceGitHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: original, encoding: "utf8" }).trim(), appOrigin: "http://127.0.0.1:3101", backendOrigin: backend, boundary: "synthetic auth; actual Next app and canonical PostgreSQL migrations/RLS", createdAt: new Date().toISOString() };
  await writeFile(join(stage, "public/__cfh-system-fixture.json"), JSON.stringify(manifest, null, 2));
  await symlink(resolve(original, "node_modules"), join(stage, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/SUPABASE|GITHUB|VERCEL|OPENAI|TOKEN|SECRET|PASSWORD|API_KEY|DATABASE_URL|NODE_OPTIONS/i.test(key)));
  console.log(`CFH system app snapshot: ${stage}; auth/data remain on loopback only.`);
  const environment: NodeJS.ProcessEnv = {
      ...inherited, NODE_ENV: "production", CFH_DEMO_MODE: "false", CFH_GITHUB_AUTH_ENABLED: "false",
      NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3101", NEXT_PUBLIC_SUPABASE_URL: backend,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: fixtureKey, NEXT_TELEMETRY_DISABLED: "1",
      NODE_OPTIONS: `--require="${resolve(original, "tests/system/block-external.cjs").replaceAll("\\", "/")}"`,
  };
  const next = resolve(original, "node_modules/next/dist/bin/next");
  let activeChild = spawn(process.execPath, [next, "build", "--webpack"], { cwd: stage, stdio: "inherit", env: environment });
  process.on("SIGINT", () => activeChild.kill("SIGINT"));
  process.on("SIGTERM", () => activeChild.kill("SIGTERM"));
  await new Promise<void>((done, reject) => {
    activeChild.on("error", reject);
    activeChild.on("exit", (code) => code === 0 ? done() : reject(new Error(`System app production build failed (${code})`)));
  });
  activeChild = spawn(process.execPath, [next, "start", "--hostname", "127.0.0.1", "--port", "3101"], { cwd: stage, stdio: "inherit", env: environment });
  activeChild.on("exit", (code) => process.exit(code ?? 1));
}
void main();
