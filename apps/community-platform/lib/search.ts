import type { Catalog } from "./types";
import { docs, institution } from "./content";
export function searchCatalog(c: Catalog, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const entries = [
    ...c.projects.map((p) => ({
      type: "Project",
      title: p.name,
      text: p.summary,
      url: `/projects/${p.slug}`,
    })),
    ...c.problems.map((p) => ({
      type: "Problem",
      title: p.title,
      text: p.description,
      url: `/problems/${p.slug}`,
    })),
    ...c.tasks.map((t) => ({
      type: "Task",
      title: t.title,
      text: `${t.objective} ${t.discipline} ${t.technology}`,
      url: `/work/${t.id}`,
    })),
    ...c.programs.map((p) => ({
      type: "Program",
      title: p.name,
      text: p.description,
      url: `/programs/${p.slug}`,
    })),
    ...c.profiles.map((p) => ({
      type: "Person",
      title: p.name,
      text: p.bio,
      url: `/people/${p.username}`,
    })),
    ...Object.entries(docs).map(([slug, d]) => ({
      type: "Documentation",
      title: d.title,
      text: d.intro,
      url: `/docs/${slug}`,
    })),
    ...Object.entries(institution).map(([slug, d]) => ({
      type: "Institution",
      title: d.title,
      text: d.intro,
      url: `/${slug}`,
    })),
  ];
  return entries.filter((e) =>
    `${e.title} ${e.text}`.toLowerCase().includes(q),
  );
}
