import { cache } from "react";
import { demoCatalog } from "./demo";
import { createClient, isDemo, configured } from "./supabase";
import { foundingCatalog } from "./founding";
import { pcBridgeProject } from "./pc-bridge";
import type { Catalog } from "./types";
function withLocalProjects(catalog: Catalog): Catalog {
  // A database record takes precedence if this project is later published there.
  if (catalog.projects.some((project) => project.slug === pcBridgeProject.slug || project.id === pcBridgeProject.id)) return catalog;
  return { ...catalog, projects: [...catalog.projects, pcBridgeProject] };
}
export const getCatalog = cache(async (): Promise<Catalog> => {
  if (isDemo()) return demoCatalog;
  if (!configured()) return withLocalProjects(foundingCatalog);
  const db = await createClient();
  const tables = [
    "programs",
    "projects",
    "tasks",
    "problems",
    "profiles",
    "decisions",
  ] as const;
  const results = await Promise.all(
    tables.map((t) => db.from(t).select("*").limit(1000)),
  );
  if (results.some((r) => r.error))
    throw new Error(
      "The public catalogue could not be loaded. Please try again.",
    );
  return withLocalProjects(Object.fromEntries([
    ...tables.map((t, i) => [t, results[i].data]),
    ["demo", false],
  ]) as Catalog);
});
