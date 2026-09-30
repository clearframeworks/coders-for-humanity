import type { Catalog, Task } from "./types";
export type Filters = {
  q?: string;
  discipline?: string;
  level?: string;
  effort?: string;
  project?: string;
  program?: string;
  technology?: string;
  status?: string;
};
export function filterTasks(
  tasks: Task[],
  filters: Filters,
  catalog: Pick<Catalog, "projects">,
) {
  return tasks.filter((t) => {
    const p = catalog.projects.find((p) => p.id === t.project_id);
    return (
      (!filters.q ||
        `${t.title} ${t.objective} ${t.discipline} ${t.technology} ${p?.name}`
          .toLowerCase()
          .includes(filters.q.toLowerCase())) &&
      (!filters.discipline || t.discipline === filters.discipline) &&
      (!filters.level || t.level === filters.level) &&
      (!filters.effort || t.effort === filters.effort) &&
      (!filters.project || t.project_id === filters.project) &&
      (!filters.program || p?.program_id === filters.program) &&
      (!filters.technology || t.technology === filters.technology) &&
      (!filters.status || t.status === filters.status)
    );
  });
}
export function safeNext(value: string | null | undefined) {
  return value &&
    /^\/(?!\/)/.test(value) &&
    !value.includes("\\") &&
    !/[\r\n]/.test(value)
    ? value
    : "/account";
}

export function callbackFailurePath(next: string | null | undefined) {
  return `/login?error=callback&next=${encodeURIComponent(safeNext(next))}`;
}
