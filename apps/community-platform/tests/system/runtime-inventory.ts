import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

export const runtimePaths = ["app", "components", "lib", "public", "proxy.ts", "next.config.ts", "package.json", "package-lock.json", "tsconfig.json", "supabase/migrations"];
export type RuntimeFile = { path: string; sha256: string };
export async function runtimeInventory(root: string) {
  const files: RuntimeFile[] = [];
  async function visit(relative: string) {
    if (relative === "public/__cfh-system-fixture.json") return;
    const full = join(root, relative);
    if ((await stat(full)).isDirectory()) {
      for (const entry of (await readdir(full)).sort()) await visit(`${relative}/${entry}`);
    } else files.push({ path: relative, sha256: createHash("sha256").update(await readFile(full)).digest("hex") });
  }
  for (const path of runtimePaths) await visit(path);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, fingerprint: createHash("sha256").update(JSON.stringify(files)).digest("hex") };
}
export async function migrationFingerprint(root: string) {
  const hash = createHash("sha256");
  for (const file of (await readdir(join(root, "supabase/migrations"))).filter((name) => name.endsWith(".sql")).sort()) {
    hash.update(file); hash.update(await readFile(join(root, "supabase/migrations", file)));
  }
  return hash.digest("hex");
}
