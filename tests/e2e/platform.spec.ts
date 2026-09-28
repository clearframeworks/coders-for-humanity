import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

test("community views lead into real founding work and the shared repository", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Good work starts with people.",
  );
  await expect(page.getByText("Demonstration catalogue")).toHaveCount(0);
  const views = page.getByRole("navigation", { name: "Community view" });
  await views.getByRole("link", { name: "Open work", exact: true }).click();
  await expect(page).toHaveURL(/tab=work/);
  await expect(
    page.getByRole("heading", { name: "Work ready for human ownership" }),
  ).toBeVisible();
  const firstTask = page.locator(".compact-work a").first();
  const taskName = await firstTask.locator("h3").innerText();
  await firstTask.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(taskName);
  await expect(
    page.getByRole("heading", { name: "Acceptance criteria", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dependencies", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /claim/i })).toHaveCount(0);
  await page.goto("/");
  await views
    .getByRole("link", { name: "GitHub activity", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "From the repository" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open GitHub", exact: false }).first(),
  ).toHaveAttribute(
    "href",
    "https://github.com/clearframeworks/coders-for-humanity",
  );
  await views.getByRole("link", { name: "Community", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "A thousand contributors. One shared understanding.",
    }),
  ).toBeVisible();
});

test("project room preserves context across its six working views", async ({
  page,
}) => {
  await page.goto("/projects/community-platform");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Community platform",
  );
  const tabs = page.getByRole("navigation", { name: "Project workspace" });
  for (const [tab, heading] of [
    ["Conversations", "Conversations in this project"],
    ["Workboard", "Founding work"],
    ["Knowledge", "The project memory"],
    ["Code", "The shared codebase"],
    ["Members", "A founding team, built on consent."],
    ["Overview", "Make the next person’s contribution easier."],
  ]) {
    await tabs.getByRole("link", { name: new RegExp(`^${tab}`) }).click();
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(
      tabs.getByRole("link", { name: new RegExp(`^${tab}`) }),
    ).toHaveAttribute("aria-current", "page");
  }
  await tabs.getByRole("link", { name: "Conversations", exact: true }).click();
  await page
    .getByRole("main")
    .getByRole("link", { name: "Start a conversation", exact: true })
    .click();
  await expect(page.getByLabel("Space", { exact: true })).toHaveValue(
    "cf000000-0000-4000-8000-000000000001",
  );
});

test("appearance persists and follows the operating system", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(17, 26, 35)",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(248, 250, 251)",
  );
  await page.getByRole("button", { name: "System", exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(17, 26, 35)",
  );
});

test("work filters intersect and preserve real tasks in board views", async ({
  page,
}) => {
  await page.goto("/contribute");
  await page.getByLabel("Discipline", { exact: true }).selectOption("Security");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator(".task-row")).toHaveCount(1);
  await expect(page.locator(".task-row")).toContainText(
    "Establish the independent harness team",
  );
  await page.getByRole("link", { name: "Kanban", exact: true }).click();
  await expect(page.locator(".kanban-card")).toHaveCount(1);
  await page
    .getByRole("link", {
      name: "Establish the independent harness team",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Acceptance criteria", exact: true }),
  ).toBeVisible();
  await page.goto("/contribute");
  await page
    .getByLabel("Discipline", { exact: true })
    .selectOption("Documentation");
  await page
    .getByLabel("Commitment", { exact: true })
    .selectOption("1–3 hours");
  await page
    .getByLabel("Find a useful contribution", { exact: true })
    .fill("handoff");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator(".task-row")).toHaveCount(1);
  await expect(page.locator(".task-row")).toContainText(
    "Write the first human maintainer handoff",
  );
  await page.getByLabel("Commitment", { exact: true }).selectOption("< 1 hour");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByRole("heading", { name: "No matching work yet" }),
  ).toBeVisible();
});

test("conversation drafts restore all fields and can be cleared without publishing", async ({
  page,
}) => {
  await page.goto("/discussions/new");
  await page
    .getByLabel("Conversation title", { exact: true })
    .fill("Reviewing our first contribution boundary");
  await page
    .getByLabel("Context and invitation", { exact: true })
    .fill(
      "I can help test the independent review boundary. Which staging cases would be useful?",
    );
  await page.getByLabel("Type", { exact: true }).selectOption("question");
  await page
    .getByLabel("Space", { exact: true })
    .selectOption({ label: "Community platform" });
  const selectedProject = await page
    .getByLabel("Space", { exact: true })
    .inputValue();
  await expect(
    page.getByText("Draft saved in this browser only.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Conversation title", { exact: true }),
  ).toHaveValue("Reviewing our first contribution boundary");
  await expect(
    page.getByLabel("Context and invitation", { exact: true }),
  ).toHaveValue(/Which staging cases/);
  await expect(page.getByLabel("Type", { exact: true })).toHaveValue(
    "question",
  );
  await expect(page.getByLabel("Space", { exact: true })).toHaveValue(
    selectedProject,
  );
  await expect(
    page.getByRole("button", { name: "Publish conversation", exact: true }),
  ).toHaveCount(0);
  const draftLink = await page
    .getByRole("link", { name: /Continue draft on GitHub/ })
    .getAttribute("href");
  expect(new URL(draftLink!).searchParams.get("title")).toBe(
    "Reviewing our first contribution boundary",
  );
  await page.getByRole("button", { name: "Clear draft", exact: true }).click();
  await page.reload();
  await expect(
    page.getByLabel("Conversation title", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByLabel("Context and invitation", { exact: true }),
  ).toHaveValue("");
  await expect(page.getByLabel("Type", { exact: true })).toHaveValue(
    "discussion",
  );
  await expect(page.getByLabel("Space", { exact: true })).toHaveValue("");
});

test("a local handoff can be saved, restored, exported and removed", async ({
  page,
}) => {
  await page.goto("/workspace");
  const title = "Review boundary handoff";
  await page.getByLabel("Handoff title", { exact: true }).fill(title);
  await page
    .getByLabel("Context and objective", { exact: true })
    .fill("Verify that authors cannot accept their own work.");
  await page
    .getByLabel("Work completed", { exact: true })
    .fill("Recorded the threat cases and the independent review requirements.");
  await page
    .getByLabel("Evidence and verification", { exact: true })
    .fill("https://github.com/clearframeworks/coders-for-humanity");
  await page
    .getByLabel("Remaining work and blockers", { exact: true })
    .fill("A staging environment and an independent reviewer are needed.");
  await page
    .getByLabel("Review needed", { exact: true })
    .fill("Security reviewer should check identity and stale evidence.");
  await page
    .getByRole("button", { name: "Save handoff on this device", exact: true })
    .click();
  await expect(
    page.getByText(
      "Handoff saved on this device. Nothing has been published.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: `Edit ${title}`, exact: true })
    .click();
  await expect(
    page.getByLabel("Context and objective", { exact: true }),
  ).toHaveValue("Verify that authors cannot accept their own work.");
  await expect(
    page.getByLabel("Remaining work and blockers", { exact: true }),
  ).toHaveValue(/staging environment/);
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Markdown", exact: true })
    .click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("review-boundary-handoff.md");
  const exported = await readFile((await download.path())!, "utf8");
  expect(exported).toContain(
    "Verify that authors cannot accept their own work.",
  );
  expect(exported).toContain("not submitted or approved");
  await page
    .getByRole("button", { name: "Clear notebook", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: `Edit ${title}`, exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Handoff title", { exact: true })).toHaveValue(
    "",
  );
});

test("proposal draft survives reload, suggests existing work and validates the next step", async ({
  page,
}) => {
  await page.goto("/propose");
  await page
    .getByLabel("Working title")
    .fill("Community platform improvements");
  await page
    .getByLabel("Problem (40–10,000 characters)")
    .fill(
      "Contributors need shared context and a reliable review boundary to safely coordinate work across projects.",
    );
  await expect(
    page.getByText("Related work already exists.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Working title")).toHaveValue(
    "Community platform improvements",
  );
  await page.getByRole("button", { name: "Next section" }).click();
  await expect(
    page.getByRole("heading", { name: "Evidence", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next section" }).click();
  await expect(
    page.getByRole("heading", { name: "Evidence", exact: true }),
  ).toBeVisible();
});

test("search, unconnected accounts and financial records do not invent activity", async ({
  page,
  request,
}) => {
  await page.goto("/search?q=accessibility");
  await expect(page.locator(".search-results")).toContainText("accessibility", {
    ignoreCase: true,
  });
  const result = await request.get("/api/transparency");
  expect(result.status()).toBe(200);
  expect((await result.json()).status).toBe("no_published_records");
  await page.goto("/login");
  await expect(
    page.getByText("Member accounts are not connected yet.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Continue with GitHub/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Send a sign-in link", exact: true }),
  ).toBeDisabled();
  await page.goto("/reviews");
  await expect(
    page.getByRole("heading", { name: "Review is a responsibility." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /approve|accept/i }),
  ).toHaveCount(0);
});

test("mobile navigation and working screens avoid horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "My workspace", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your place in the work.",
  );
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toHaveAttribute("aria-expanded", "false");
  for (const path of [
    "/",
    "/workspace",
    "/contribute",
    "/discussions/new",
    "/harness",
    "/projects/community-platform?tab=knowledge",
    "/projects/community-platform?tab=workboard",
  ]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      path,
    ).toBe(true);
  }
});

for (const theme of ["Light", "Dark"])
  test(`working pages have no automated WCAG A/AA violations in ${theme.toLowerCase()} mode`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    for (const path of [
      "/",
      "/contribute",
      "/propose",
      "/discussions/new",
      "/workspace",
      "/projects/community-platform",
      "/projects/community-platform?tab=knowledge",
      "/harness",
      "/reviews",
      "/login",
    ]) {
      await page.goto(path);
      await page.getByRole("button", { name: theme, exact: true }).click();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        results.violations,
        `${path}: ${JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`,
      ).toEqual([]);
    }
  });

test("public routes resolve and removed fictional content does not", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  for (const path of [
    "/",
    "/mission",
    "/constitution",
    "/governance",
    "/transparency",
    "/funding",
    "/partners",
    "/about",
    "/programs",
    "/programs/food",
    "/projects",
    "/projects/community-platform",
    "/contribute",
    "/work",
    "/propose",
    "/problems",
    "/impact",
    "/docs",
    "/docs/lifecycle",
    "/docs/security",
    "/people",
    "/search",
    "/account",
    "/workspace",
    "/inbox",
    "/discussions",
    "/discussions/new",
    "/harness",
    "/reviews",
  ])
    expect((await request.get(path)).status(), path).toBe(200);
  await page.goto("/contribute");
  const firstTaskPath = await page
    .locator(".task-row")
    .first()
    .getAttribute("href");
  expect((await request.get(firstTaskPath!)).status()).toBe(200);
  for (const path of [
    "/projects/missing",
    "/projects/food-bridge",
    "/people/example-contributor",
    "/problems/food-coordination",
    "/discussions/not-a-uuid",
  ])
    expect((await request.get(path)).status(), path).toBe(404);
});
