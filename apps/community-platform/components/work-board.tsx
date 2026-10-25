import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Catalog, Task } from "@/lib/types";
import { disciplines, levels, efforts, taskStatuses } from "@/lib/types";
import { filterTasks, type Filters } from "@/lib/filters";
import {
  normalizeWorkBoardParams,
  type WorkBoardParams,
  type NormalizedWorkBoardParams,
  WORK_SEARCH_MAX_LENGTH,
} from "@/lib/work-board-filters";
import "@/app/work-discovery.css";
import { Badge, EmptyState } from "./ui";
type Params = WorkBoardParams;
export function TaskRow({ task, catalog }: { task: Task; catalog: Catalog }) {
  return (
    <Link className="task-row" href={`/work/${task.id}`}>
      <div>
        <h3>{task.title}</h3>
        <p>
          {catalog.projects.find((p) => p.id === task.project_id)?.name} ·{" "}
          {task.discipline} · {task.level}
          {task.is_demo ? " · Example" : ""}
        </p>
      </div>
      <span>{task.effort}</span>
      <Badge status={task.status} />
      <ArrowUpRight size={17} />
    </Link>
  );
}
export function WorkBoard({
  catalog,
  params,
  path = "/contribute",
}: {
  catalog: Catalog;
  params: Params;
  path?: string;
}) {
  const normalized = normalizeWorkBoardParams(params, catalog);
  const filters: Filters = {
    q: normalized.q,
    discipline: normalized.discipline,
    level: normalized.level,
    effort: normalized.effort,
    project: normalized.project,
    program: normalized.program,
    technology: normalized.technology,
    status: normalized.status,
  };
  const filtered = filterTasks(catalog.tasks, filters, catalog);
  const view = ["List", "Kanban", "Project", "Program", "Discipline"].includes(
    normalized.view || "",
  )
    ? normalized.view!
    : "List";
  const choices = [
    ["discipline", "Discipline", disciplines.map((x) => [x, x])],
    ["level", "Skill level", levels.map((x) => [x, x])],
    ["effort", "Commitment", efforts.map((x) => [x, x])],
    ["project", "Project", catalog.projects.map((x) => [x.id, x.name])],
    [
      "program",
      "Program / impact area",
      catalog.programs.map((x) => [x.id, x.name]),
    ],
    [
      "technology",
      "Technology",
      [...new Set(catalog.tasks.map((t) => t.technology))].map((x) => [x, x]),
    ],
    ["status", "Status", taskStatuses.map((x) => [x, x])],
  ] as [string, string, string[][]][];
  const hrefFor = (next: NormalizedWorkBoardParams) => {
    const q = new URLSearchParams(
      Object.entries(next).filter(([, value]) => Boolean(value)) as [
        string,
        string,
      ][],
    );
    const query = q.toString();
    return query ? `${path}?${query}` : path;
  };
  const viewHref = (next: string) => hrefFor({ ...normalized, view: next });
  const quickFilters = [
    { key: "level", value: "First Contribution", label: "First contribution" },
    { key: "discipline", value: "Documentation", label: "Documentation" },
    { key: "discipline", value: "Security", label: "Security" },
  ].filter((quick) =>
    catalog.tasks.some((task) =>
      quick.key === "level"
        ? task.level === quick.value
        : task.discipline === quick.value,
    ),
  );
  const quickHref = (key: "level" | "discipline", value: string) => {
    const next = { ...normalized };
    if (next[key] === value) delete next[key];
    else next[key] = value;
    return hrefFor(next);
  };
  const filterLabels: Record<string, string> = {
    q: "Search",
    discipline: "Discipline",
    level: "Skill level",
    effort: "Commitment",
    project: "Project",
    program: "Program / impact area",
    technology: "Technology",
    status: "Status",
  };
  const displayValue = (key: string, value: string) => {
    if (key === "project")
      return catalog.projects.find((item) => item.id === value)?.name || value;
    if (key === "program")
      return catalog.programs.find((item) => item.id === value)?.name || value;
    return value;
  };
  const activeFilters = Object.entries(filters).filter(([, value]) =>
    Boolean(value),
  ) as [keyof Filters, string][];
  const withoutFilter = (key: keyof Filters) => {
    const next = { ...normalized };
    delete next[key];
    return hrefFor(next);
  };
  const groupName = (t: Task) =>
    view === "Project"
      ? catalog.projects.find((p) => p.id === t.project_id)?.name || "Unlinked"
      : view === "Program"
        ? catalog.programs.find(
            (p) =>
              p.id ===
              catalog.projects.find((x) => x.id === t.project_id)?.program_id,
          )?.name || "Unlinked"
        : t.discipline;
  return (
    <>
      <form className="filters" action={path} key={JSON.stringify(normalized)}>
        <input type="hidden" name="view" value={view} />
        <div className="field search-field">
          <label htmlFor="q">Find a useful contribution</label>
          <input
            name="q"
            id="q"
            type="search"
            maxLength={WORK_SEARCH_MAX_LENGTH}
            defaultValue={normalized.q}
            placeholder="Search tasks, skills, or technologies…"
          />
        </div>
        {choices.map(([key, label, options]) => (
          <div className="field" key={key}>
            <label htmlFor={key}>{label}</label>
            <select
              name={key}
              id={key}
              defaultValue={
                normalized[key as keyof NormalizedWorkBoardParams] || ""
              }
            >
              <option value="">All {label.toLowerCase()}</option>
              {options.map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="filter-actions">
          <button className="button primary" type="submit">
            Apply filters
          </button>
          <Link className="button" href={path}>
            Reset
          </Link>
        </div>
      </form>
      {quickFilters.length > 0 && (
        <nav className="work-quick-filters" aria-label="Quick task filters">
          <span>Explore</span>
          {quickFilters.map((quick) => {
            const key = quick.key as "level" | "discipline";
            const selected = normalized[key] === quick.value;
            return (
              <Link
                key={`${key}-${quick.value}`}
                href={quickHref(key, quick.value)}
                className={selected ? "selected" : ""}
                aria-current={selected ? "page" : undefined}
              >
                {quick.label}
              </Link>
            );
          })}
        </nav>
      )}
      {activeFilters.length > 0 && (
        <div className="work-applied-filters" aria-label="Applied filters">
          <span className="work-applied-label">Applied</span>
          {activeFilters.map(([key, value]) => {
            const label = `${filterLabels[key]}: ${displayValue(key, value)}`;
            return (
              <Link
                key={key}
                href={withoutFilter(key)}
                className="work-filter-chip"
                aria-label={`Remove ${label} filter`}
              >
                <span className="work-filter-chip-label">{label}</span>
                <span aria-hidden="true">×</span>
              </Link>
            );
          })}
          <Link className="work-clear-filters" href={path}>
            Clear all
          </Link>
        </div>
      )}
      <div className="page-toolbar">
        <p aria-live="polite">
          {filtered.length} {catalog.demo ? "example " : ""}
          {filtered.length === 1 ? "task" : "tasks"} · Every discipline welcome
        </p>
        <nav className="work-views" aria-label="Work board view">
          {["List", "Kanban", "Project", "Program", "Discipline"].map((v) => (
            <Link
              key={v}
              href={viewHref(v)}
              className={v === view ? "selected" : ""}
              aria-current={v === view ? "page" : undefined}
            >
              {v}
            </Link>
          ))}
        </nav>
      </div>
      {!filtered.length ? (
        <EmptyState title="No matching work yet">
          Try another filter, or explore the problem library to see where
          research could help. <Link href={path}>Clear filters.</Link>
        </EmptyState>
      ) : view === "Kanban" ? (
        <div className="kanban">
          {taskStatuses.map((s) => (
            <section key={s} className="kanban-column">
              <h2>
                {s}
                <span>{filtered.filter((t) => t.status === s).length}</span>
              </h2>
              {filtered
                .filter((t) => t.status === s)
                .map((t) => (
                  <article className="kanban-card" key={t.id}>
                    <h3>
                      <Link href={`/work/${t.id}`}>{t.title}</Link>
                    </h3>
                    <p>
                      {t.discipline} · {t.effort}
                    </p>
                    {t.is_demo && <p>Example task</p>}
                  </article>
                ))}
            </section>
          ))}
        </div>
      ) : view === "List" ? (
        <div className="task-list">
          {filtered.map((t) => (
            <TaskRow key={t.id} task={t} catalog={catalog} />
          ))}
        </div>
      ) : (
        <>
          {[...new Set(filtered.map(groupName))].map((g) => (
            <section key={g}>
              <h2 className="group-heading">{g}</h2>
              <div className="task-list">
                {filtered
                  .filter((t) => groupName(t) === g)
                  .map((t) => (
                    <TaskRow key={t.id} task={t} catalog={catalog} />
                  ))}
              </div>
            </section>
          ))}
        </>
      )}
    </>
  );
}
