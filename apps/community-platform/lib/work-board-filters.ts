import { disciplines, efforts, levels, taskStatuses } from "./types";
import type { Catalog } from "./types";

export type WorkBoardParams = Record<string, string | string[] | undefined>;
export type NormalizedWorkBoardParams = {
  q?: string;
  discipline?: string;
  level?: string;
  effort?: string;
  project?: string;
  program?: string;
  technology?: string;
  status?: string;
  view?: string;
};

export const WORK_SEARCH_MAX_LENGTH = 120;

function firstValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim();
}

export function normalizeWorkBoardParams(
  params: WorkBoardParams,
  catalog: Catalog,
): NormalizedWorkBoardParams {
  const allowed: Record<string, Set<string>> = {
    discipline: new Set(disciplines),
    level: new Set(levels),
    effort: new Set(efforts),
    project: new Set(catalog.projects.map((project) => project.id)),
    program: new Set(catalog.programs.map((program) => program.id)),
    technology: new Set(catalog.tasks.map((task) => task.technology)),
    status: new Set(taskStatuses),
    view: new Set(["List", "Kanban", "Project", "Program", "Discipline"]),
  };
  const normalized: NormalizedWorkBoardParams = {};
  const query = firstValue(params.q);
  if (query) normalized.q = query.slice(0, WORK_SEARCH_MAX_LENGTH);

  for (const [key, values] of Object.entries(allowed)) {
    const value = firstValue(params[key]);
    if (value && values.has(value)) {
      normalized[key as keyof typeof normalized] = value;
    }
  }
  return normalized;
}
