import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Catalog, Task } from "@/lib/types";
import { disciplines, levels, efforts, taskStatuses } from "@/lib/types";
import { filterTasks, type Filters } from "@/lib/filters";
import { Badge, EmptyState } from "./ui";
type Params = Record<string, string | undefined>;
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
  const filtered = filterTasks(catalog.tasks, params as Filters, catalog);
  const view = ["List", "Kanban", "Project", "Program", "Discipline"].includes(
    params.view || "",
  )
    ? params.view!
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
  const viewHref = (next: string) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => Boolean(v)) as [
        string,
        string,
      ][],
    );
    q.set("view", next);
    return `${path}?${q}`;
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
      <form className="filters" action={path}>
        <input type="hidden" name="view" value={view} />
        <div className="field search-field">
          <label htmlFor="q">Find a useful contribution</label>
          <input
            name="q"
            id="q"
            defaultValue={params.q}
            placeholder="Search tasks, skills, or technologies…"
          />
        </div>
        {choices.map(([key, label, options]) => (
          <div className="field" key={key}>
            <label htmlFor={key}>{label}</label>
            <select name={key} id={key} defaultValue={params[key] || ""}>
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
