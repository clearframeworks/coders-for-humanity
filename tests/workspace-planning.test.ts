import test from "node:test";
import assert from "node:assert/strict";
import { foundingCatalog } from "../lib/founding";
import { foundingWorkId } from "../lib/harness";
import {
  createTaskPlan,
  findPlanningTask,
  type WorkspacePlanningTask,
} from "../lib/workspace-planning";

const publishedTask: WorkspacePlanningTask = {
  id: "published-task-42",
  is_demo: false,
  title: "Document the public handoff flow",
  effort: "1–3 hours",
  objective: "Help a new person continue useful work.",
  context: "The current plan is saved in the project workspace.",
  acceptance: "Include setup, evidence, blockers, and a next step.",
  dependencies: "Read the maintainer handoff first.",
  reviewer: "Project maintainer",
};

test("any published catalogue task can be found and fully prefilled", () => {
  const found = findPlanningTask([publishedTask], publishedTask.id);

  assert.ok(found);
  assert.deepEqual(found, publishedTask);

  const plan = createTaskPlan(found);
  assert.equal(plan.title, `Task: ${publishedTask.title}`);
  assert.equal(plan.reviewer, publishedTask.reviewer);
  assert.ok(
    plan.context.includes(
      "https://cfh.retehost.com/work/" + publishedTask.id,
    ),
  );
  assert.ok(plan.context.includes(`Objective: ${publishedTask.objective}`));
  assert.ok(
    plan.context.includes(`Current context: ${publishedTask.context}`),
  );
  assert.ok(
    plan.context.includes(`Acceptance criteria: ${publishedTask.acceptance}`),
  );
  assert.ok(
    plan.context.includes(`Dependencies: ${publishedTask.dependencies}`),
  );
});

test("unknown task IDs have no plan", () => {
  assert.equal(findPlanningTask([publishedTask], "missing-task"), undefined);
});

test("example tasks retain their demo marker for the picker to label", () => {
  const exampleTask = { ...publishedTask, id: "example-task-7", is_demo: true };
  const found = findPlanningTask([exampleTask], exampleTask.id);

  assert.ok(found);
  assert.equal(found.is_demo, true);
});

test("founding task plans retain their published scope and reviewer", () => {
  const foundingTask = foundingCatalog.tasks.find(
    (task) => task.id === foundingWorkId("cfh-handoff"),
  );
  assert.ok(foundingTask);
  const planningTask = findPlanningTask([foundingTask], foundingTask.id);

  assert.ok(planningTask);
  const plan = createTaskPlan(planningTask);
  assert.equal(plan.title, `Task: ${foundingTask.title}`);
  assert.equal(plan.reviewer, foundingTask.reviewer);
  assert.ok(plan.context.includes(foundingTask.objective));
  assert.ok(plan.context.includes(foundingTask.acceptance));
  assert.ok(plan.context.includes(foundingTask.dependencies));
});
