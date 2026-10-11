import type { Task } from "./types";

/** Public task fields needed to prepare a personal plan in the workspace. */
export type WorkspacePlanningTask = Pick<
  Task,
  | "id"
  | "is_demo"
  | "title"
  | "effort"
  | "objective"
  | "context"
  | "acceptance"
  | "dependencies"
  | "reviewer"
>;

export type WorkspaceTaskPlan = {
  title: string;
  context: string;
  reviewer: string;
};

export function findPlanningTask(
  tasks: readonly WorkspacePlanningTask[],
  id: string | undefined,
): WorkspacePlanningTask | undefined {
  if (!id) return undefined;
  return tasks.find((task) => task.id === id);
}

export function createTaskPlan(
  task: WorkspacePlanningTask,
): WorkspaceTaskPlan {
  return {
    title: `Task: ${task.title}`,
    context: [
      `Task brief: https://cfh.retehost.com/work/${task.id}`,
      `Objective: ${task.objective}`,
      `Current context: ${task.context}`,
      `Acceptance criteria: ${task.acceptance}`,
      `Dependencies: ${task.dependencies}`,
    ].join("\n\n"),
    reviewer: task.reviewer,
  };
}
