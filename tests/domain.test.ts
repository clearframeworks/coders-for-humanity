import test from "node:test";
import assert from "node:assert/strict";
import { callbackFailurePath, filterTasks, safeNext } from "../lib/filters";
import { demoCatalog } from "../lib/demo";
import { searchCatalog } from "../lib/search";
import { proposalSchema, profileSchema } from "../lib/validation";
test("time, skill, project, and program filters intersect", () => {
  const found = filterTasks(
    demoCatalog.tasks,
    { effort: "< 1 hour", program: "food", discipline: "Translation" },
    demoCatalog,
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].id, "food-translate");
  assert.equal(
    filterTasks(
      demoCatalog.tasks,
      { discipline: "Backend", status: "OPEN" },
      demoCatalog,
    ).length,
    0,
  );
});
test("search includes projects, tasks, documentation, and programs", () => {
  const results = searchCatalog(demoCatalog, "accessibility");
  for (const type of ["Task", "Program", "Documentation"])
    assert.ok(results.some((r) => r.type === type));
  assert.equal(searchCatalog(demoCatalog, "").length, 0);
});
test("external, protocol-relative, and backslash auth redirects are rejected", () => {
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/\nevil",
  ])
    assert.equal(safeNext(value), "/account");
  assert.equal(safeNext("/work?id=1"), "/work?id=1");
});
test("failed auth callbacks preserve safe destinations for retry", () => {
  assert.equal(
    callbackFailurePath("/join?source=header"),
    "/login?error=callback&next=%2Fjoin%3Fsource%3Dheader",
  );
  assert.equal(
    callbackFailurePath("https://evil.test"),
    "/login?error=callback&next=%2Faccount",
  );
});
test("every demonstration project and task is labelled and linked", () => {
  assert.ok(demoCatalog.projects.every((p) => p.is_demo));
  assert.ok(
    demoCatalog.tasks.every(
      (t) =>
        t.is_demo && demoCatalog.projects.some((p) => p.id === t.project_id),
    ),
  );
});
test("proposal requires substantive sections and HTTPS evidence", () => {
  assert.equal(
    proposalSchema.safeParse({
      title: "Valid title",
      sources: ["javascript:alert(1)"],
    }).success,
    false,
  );
  const payload = Object.fromEntries(
    [
      "problem",
      "evidence",
      "existing_solutions",
      "people_affected",
      "intervention",
      "technology_rationale",
      "risks",
      "expertise",
      "deployment",
      "measurement",
    ].map((k) => [
      k,
      "A substantive explanation of the problem and its important constraints.",
    ]),
  );
  assert.equal(
    proposalSchema.safeParse({
      ...payload,
      title: "A useful research proposal",
      sources: ["https://example.org/research"],
    }).success,
    true,
  );
});
test("profile cannot inject a script URL or invalid public username", () => {
  const base = {
    username: "test-user",
    name: "Test",
    bio: "",
    location: "",
    availability: "",
    github_url: "",
    website_url: "",
    is_public: false,
  };
  assert.equal(profileSchema.safeParse(base).success, true);
  assert.equal(
    profileSchema.safeParse({ ...base, website_url: "javascript:alert(1)" })
      .success,
    false,
  );
  assert.equal(
    profileSchema.safeParse({ ...base, username: "../admin" }).success,
    false,
  );
});
