"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTaskBrief } from "@/app/task-actions";
import { disciplines, efforts, levels } from "@/lib/types";
import type { ActionState } from "@/app/actions";

type ProjectChoice = { id: string; name: string };
type ReviewerChoice = { project_id: string; user_id: string; name: string };
type DependencyChoice = { id: string; project_id: string; title: string };

export function TaskEditor({ projects, reviewers, tasks }: {
  projects: ProjectChoice[]; reviewers: ReviewerChoice[]; tasks: DependencyChoice[];
}) {
  const [project, setProject] = useState(projects[0]?.id ?? "");
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  return <form className="hub-panel hub-stack" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form);
    start(async () => {
      const result = await createTaskBrief({ ...payload, dependency_ids: form.getAll("dependency_ids") });
      setState(result);
      if (result.id) router.push(`/work/${result.id}`);
    });
  }}>
    <p>Publish a bounded task with a clear outcome and an accountable reviewer. It becomes visible on the public work board.</p>
    <div className="field"><label htmlFor="task-project">Project</label>
      <select id="task-project" name="project_id" value={project} onChange={(event) => setProject(event.target.value)} required disabled={pending}>
        {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></div>
    <div className="field"><label htmlFor="task-title">Task title</label><input id="task-title" name="title" minLength={8} maxLength={180} required disabled={pending} /></div>
    {([ ["discipline", "Discipline", disciplines], ["level", "Experience level", levels], ["effort", "Expected effort", efforts] ] as const).map(([name, label, options]) =>
      <div className="field" key={name}><label htmlFor={`task-${name}`}>{label}</label><select id={`task-${name}`} name={name} required disabled={pending}>{options.map((option) => <option key={option}>{option}</option>)}</select></div>)}
    <div className="field"><label htmlFor="task-technology">Tools or technology</label><input id="task-technology" name="technology" maxLength={200} required disabled={pending} placeholder="For example: TypeScript, research, or screen reader testing" /></div>
    {([ ["objective", "What should change?", 5000], ["context", "Context and where to start", 10000], ["acceptance", "How will we know it is done?", 10000] ] as const).map(([name, label, limit]) =>
      <div className="field" key={name}><label htmlFor={`task-${name}`}>{label}</label><textarea id={`task-${name}`} name={name} minLength={20} maxLength={limit} rows={5} required disabled={pending} /></div>)}
    <div className="field"><label htmlFor="task-reviewer">Project reviewer</label><select key={project} id="task-reviewer" name="reviewer_id" required disabled={pending} defaultValue="">
      <option value="" disabled>Choose a maintainer</option>{reviewers.filter((item) => item.project_id === project).map((item) => <option key={item.user_id} value={item.user_id}>{item.name}</option>)}
    </select><p className="form-help">The person who completes the task cannot accept their own submission.</p></div>
    <fieldset key={`dependencies-${project}`} disabled={pending}><legend>Tasks that must finish first</legend>
      {tasks.filter((item) => item.project_id === project).map((item) => <label key={item.id} className="hub-row"><input type="checkbox" name="dependency_ids" value={item.id} /> {item.title}</label>)}
      <p className="form-help">Optional, up to 20. Unfinished dependencies prevent a claim.</p>
    </fieldset>
    <button className="button primary" disabled={pending}>{pending ? "Publishing…" : "Publish task"}</button>
    {(state.error || state.message) && <p role="status" className={state.error ? "notice error" : "notice"}>{state.error || state.message}</p>}
  </form>;
}
