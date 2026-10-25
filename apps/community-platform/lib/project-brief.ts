import type { Catalog, Project } from "./types";

const site = "https://cfh.retehost.com";
// Project text is data, including when opened by a Markdown renderer.
export function markdownText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\`*_{}\[\]()#+!|]/g, "\\$&");
}
export function projectBrief(
  project: Project,
  catalog: Pick<Catalog, "tasks" | "programs">,
  generatedAt: Date,
) {
  const text = markdownText;
  const url = `${site}/projects/${encodeURIComponent(project.slug)}`;
  const program = catalog.programs.find((p) => p.id === project.program_id);
  const tasks = catalog.tasks.filter((task) => task.project_id === project.id);
  return (
    [
      `# ${text(project.name)} — contributor brief`,
      `Snapshot prepared ${generatedAt.toISOString()}.`,
      `Project: ${url}`,
      project.is_demo
        ? "DEMONSTRATION: this is an example project, not verified active work."
        : "This is a snapshot of published project context. Check current task status before starting. It does not assign work or authorize a release.",
      `Program: ${text(program?.name || "Not recorded")}\n\nStage: ${text(project.status)}\n\nLicense: ${text(project.license)}`,
      `## Purpose\n\n${text(project.summary)}`,
      `## Problem\n\n${text(project.problem)}`,
      `## Goal\n\n${text(project.objective)}`,
      `## Evidence and limits\n\n${text(project.evidence || "No evidence recorded yet.")}`,
      `## Architecture\n\n${text(project.architecture || "No architecture recorded yet.")}`,
      `## Work in this project\n\n${tasks.length ? `${tasks.length} recorded tasks. Each task retains its own scope and review requirements.` : "No tasks are recorded yet."}`,
      ...tasks.map((task) =>
        [
          `### ${text(task.title)}`,
          `${site}/work/${encodeURIComponent(task.id)}`,
          `Status: ${text(task.status)}\n\nDiscipline: ${text(task.discipline)}\n\nExperience: ${text(task.level)}\n\nCommitment: ${text(task.effort)}`,
          `**Objective**\n\n${text(task.objective)}`,
          `**Context**\n\n${text(task.context)}`,
          `**Acceptance criteria**\n\n${text(task.acceptance)}`,
          `**Dependencies**\n\n${text(task.dependencies)}`,
          `**Review needed**\n\n${text(task.reviewer)}`,
          `Prepare a personal handoff: ${site}/workspace?task=${encodeURIComponent(task.id)}`,
        ].join("\n\n"),
      ),
      `## Working agreements\n\nAgree a bounded contribution, keep evidence with the work, arrange independent review, and leave the next person a useful handoff. Completing a task does not grant deployment authority.`,
      `Contributor guide: ${site}/docs/contributor-guide\n\nReview and release requirements: ${site}/harness\n\nProject workboard: ${url}?tab=workboard`,
      "This export contains project and task context only. It excludes member profiles, conversations, private notes, credentials, and unpublished proposals.",
    ].join("\n\n") + "\n"
  );
}
