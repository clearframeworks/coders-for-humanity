import test from "node:test";
import assert from "node:assert/strict";
import { projectBrief } from "../lib/project-brief";
import { foundingCatalog, platformProject } from "../lib/founding";

test("project brief packages scoped work without leaking unrelated catalog fields", () => {
  const catalog = {
    ...foundingCatalog,
    tasks: [
      ...foundingCatalog.tasks,
      {
        ...foundingCatalog.tasks[0],
        project_id: "another-project",
        title: "UNRELATED_TASK",
      },
    ],
    profiles: [{ name: "PRIVATE_PROFILE" }],
    conversations: [{ body: "PRIVATE_CONVERSATION" }],
  };
  const result = projectBrief(
    platformProject,
    catalog,
    new Date("2026-09-28T12:00:00Z"),
  );
  assert.match(result, /2026-09-28T12:00:00.000Z/);
  assert.match(result, /7 recorded tasks/);
  assert.match(result, /Acceptance criteria/);
  assert.match(result, /Dependencies/);
  assert.match(result, /does not grant deployment authority/);
  assert.ok(
    result.includes(
      "https://cfh.retehost.com/work/" + foundingCatalog.tasks[0].id,
    ),
  );
  assert.doesNotMatch(
    result,
    /UNRELATED_TASK|PRIVATE_PROFILE|PRIVATE_CONVERSATION/,
  );
});
test("export treats project content as text rather than active HTML or embedded Markdown links", () => {
  const result = projectBrief(
    {
      ...platformProject,
      name: "<script>alert(1)</script>",
      summary: "[click](javascript:alert(1))",
    },
    { ...foundingCatalog, tasks: [] },
    new Date(),
  );
  assert.doesNotMatch(result, /<script>|\[click\]\(javascript:/);
  assert.match(result, /&lt;script&gt;/);
  assert.match(result, /No tasks are recorded yet/);
});
