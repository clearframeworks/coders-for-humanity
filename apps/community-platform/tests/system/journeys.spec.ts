import { test, expect, type BrowserContext, type Page, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const backend = "http://127.0.0.1:54329";
const publishable = "cfh-loopback-system-test-publishable-key";
const task = "cf100000-0000-4000-8000-000000000004";
type Actor = "alice" | "bruno" | "chris" | "newcomer";
test.use({ actionTimeout: 15000 });
async function persona(request: APIRequestContext, actor: Actor) {
  return (await (await request.get(`${backend}/__test/personas`)).json())[actor];
}
async function signIn(context: BrowserContext, request: APIRequestContext, actor: Actor) {
  const member = await persona(request, actor);
  await context.clearCookies();
  await context.addCookies([member.cookie]);
  return member;
}
async function rows(request: APIRequestContext, actor: Actor | null, table: string, query = "select=*") {
  const member = actor ? await persona(request, actor) : null;
  const response = await request.get(`${backend}/rest/v1/${table}?${query}`, { headers: {
    apikey: publishable, "accept-profile": "cfh", ...(member ? { Authorization: `Bearer ${member.session.access_token}` } : {}),
  } });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function capture(page: Page, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true });
}

test.beforeEach(async ({ request, context }) => {
  const manifest = await (await request.get("http://127.0.0.1:3101/__cfh-system-fixture.json")).json();
  const health = await (await request.get(`${backend}/__test/health`)).json();
  expect(manifest.fixture).toBe("cfh-loopback-system");
  expect(manifest.backendOrigin).toBe(backend);
  expect(manifest.backendRunId).toBe(health.runId);
  expect((await request.post(`${backend}/__test/reset`)).ok()).toBeTruthy();
  await context.route("**/*", route => {
    const host = new URL(route.request().url()).hostname;
    return host === "127.0.0.1" || host === "localhost" ? route.continue() : route.abort("blockedbyclient");
  });
});

test("navigation supports phone keyboard, dismissal, return focus and breakpoint recovery", async ({ page }) => {
  await page.goto("/people");
  if (page.viewportSize()!.width <= 640) {
    const toggle = page.getByRole("button", { name: "Open navigation", exact: true });
    await toggle.click();
    const dialog = page.getByRole("dialog", { name: "Site navigation" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close navigation", exact: true })).toBeFocused();
    await expect(page.locator(".workspace")).toHaveAttribute("inert", "");
    await expect(page.locator(".mobile-bar")).toHaveAttribute("inert", "");
    await page.keyboard.press("Shift+Tab");
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBeTruthy();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Close navigation", exact: true })).toBeFocused();
    await capture(page, "navigation-open-mobile");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(toggle).toBeFocused();
    await expect(page.locator(".workspace")).not.toHaveAttribute("inert");
    await expect(page.locator(".mobile-bar")).not.toHaveAttribute("inert");
    await toggle.click();
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Projects", exact: true }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.locator(".workspace")).not.toHaveAttribute("inert");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  }
  await page.goto("/docs/security");
  if (page.viewportSize()!.width <= 640) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Handbook", exact: true })).toHaveAttribute("aria-current", "page");
});

test("all guest navigation destinations render real pages with no invented member state", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const route of ["/", "/discussions", "/projects", "/software", "/people", "/workspace", "/contribute", "/reviews", "/inbox", "/harness", "/docs", "/programs", "/search", "/login", "/join"]) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByText("Something went wrong", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBeTruthy();
  }
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=/);
  expect(errors).toEqual([]);
});

test("new member creates a private profile through the real action and reopens it", async ({ page, context, request }) => {
  const member = await signIn(context, request, "newcomer");
  await page.goto("/join");
  await expect(page.locator(".topbar").getByRole("link", { name: "My account", exact: true })).toBeVisible();
  await page.getByLabel("Display name (required)").fill("TEST New Contributor");
  await page.getByLabel("Username (required)").fill("test-new-contributor");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("What would you like to contribute?").fill("Synthetic accessibility and user experience test profile.");
  await page.getByRole("button", { name: "Preview profile", exact: true }).click();
  await page.getByRole("button", { name: "Create profile", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "Your profile is private" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("TEST New Contributor");
  const saved = await rows(request, "newcomer", "profiles", `select=id,username,is_public&id=eq.${member.id}`);
  expect(saved).toEqual([{ id: member.id, username: "test-new-contributor", is_public: false }]);
  expect(await rows(request, null, "profiles", `select=id&id=eq.${member.id}`)).toEqual([]);
  await capture(page, "private-member-account");
});

test("unavailable email verification preserves the guest profile draft for recovery", async ({ page }) => {
  await page.goto("/join");
  await page.getByLabel("Display name (required)").fill("TEST Guest Draft");
  await page.getByLabel("Username (required)").fill("test-guest-draft");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Preview profile", exact: true }).click();
  await page.getByLabel("Email address", { exact: true }).fill("guest@example.invalid");
  await page.getByRole("button", { name: "Send a verification link", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "A sign-in email could not be sent." })).toBeVisible();
  await expect(page.getByText("TEST Guest Draft", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("TEST Guest Draft", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Send a verification link", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Create profile", exact: true })).toHaveCount(0);
});

test("manual test console selects clearly labelled profiles and returns to guest", async ({ page }) => {
  await page.goto(`${backend}/__test/console`);
  await expect(page.getByText("LOCAL TEST ENVIRONMENT — synthetic profiles and data", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Try CFH as a contributor.");
  await page.getByRole("link", { name: /TEST Alice/ }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:3101\/account$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, TEST Alice.");
  await page.goto(`${backend}/__test/console`);
  await page.getByRole("link", { name: /Browse as a guest/ }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3101/");
  await expect(page.locator(".topbar").getByRole("link", { name: /Sign in/ })).toBeVisible();
});

test("profile duplicate feedback preserves edits, then privacy and publication persist", async ({ page, context, request }) => {
  const member = await signIn(context, request, "alice");
  await page.goto("/account");
  await page.getByLabel("Username", { exact: true }).fill("test-bruno");
  await page.getByLabel("Display name", { exact: true }).fill("TEST Alice Updated");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.locator("#profile-feedback")).toContainText("That username is already in use.");
  await expect(page.locator("#profile-feedback")).toBeFocused();
  await expect(page.getByLabel("Username", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("TEST Alice Updated");
  await page.getByLabel("Username", { exact: true }).fill("test-alice");
  await page.getByLabel("Publish my profile on the public contributor directory").uncheck();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Profile saved." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your profile is private" })).toBeVisible();
  expect(await rows(request, null, "profiles", `select=id&id=eq.${member.id}`)).toEqual([]);
  await page.getByLabel("Publish my profile on the public contributor directory").check();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your profile is published" })).toBeVisible();
  await page.getByRole("link", { name: "View your public profile", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("TEST Alice Updated");
  expect(await rows(request, null, "profiles", `select=name&id=eq.${member.id}`)).toEqual([{ name: "TEST Alice Updated" }]);
});

test("conversation publish, independent reply, save, reopen and remove persist", async ({ page, context, request }) => {
  await signIn(context, request, "alice");
  await page.goto("/discussions/new");
  await page.getByLabel("Conversation title", { exact: true }).fill("TEST shared accessibility conversation");
  await page.getByLabel("Context and invitation").fill("TEST: Please independently check this local synthetic contribution journey.");
  await page.getByRole("button", { name: "Publish conversation", exact: true }).click();
  await expect(page).toHaveURL(/\/discussions\/[0-9a-f-]+$/);
  const postId = page.url().split("/").at(-1)!;
  expect((await rows(request, "alice", "community_posts", `select=id&id=eq.${postId}`)).length).toBe(1);
  await page.getByRole("button", { name: "Save to my workspace", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved to your workspace." })).toBeVisible();
  await signIn(context, request, "bruno");
  await page.reload();
  await page.getByLabel("Your reply", { exact: true }).fill("TEST independent reply: the next action is clear and the context is retained.");
  await page.getByRole("button", { name: "Publish reply", exact: true }).click();
  await expect(page.getByText("TEST independent reply: the next action is clear and the context is retained.", { exact: true })).toBeVisible();
  await page.reload();
  expect((await rows(request, "bruno", "community_posts", `select=id&parent_id=eq.${postId}`)).length).toBe(1);
  expect(await rows(request, "bruno", "saved_posts")).toEqual([]);
  await signIn(context, request, "alice");
  await page.goto("/workspace");
  await expect(page.getByRole("link", { name: "TEST shared accessibility conversation", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove saved conversation", exact: true }).click();
  await expect(page.getByRole("link", { name: "TEST shared accessibility conversation", exact: true })).toHaveCount(0);
  expect(await rows(request, "alice", "saved_posts")).toEqual([]);
});

test("project membership and task handoff persist through independent review and acceptance", async ({ page, context, request }) => {
  await signIn(context, request, "alice");
  await page.goto("/projects/community-platform?tab=members");
  await expect(page.getByRole("heading", { name: /Project maintainers/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "TEST Bruno", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Join this project", exact: true }).click();
  await expect(page.getByRole("button", { name: "Joined project", exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("button", { name: "Joined project", exact: true })).toBeDisabled();
  await expect(page.getByRole("heading", { name: /Project contributors/ })).toBeVisible();
  await capture(page, "real-project-members");
  expect((await rows(request, "alice", "project_members")).length).toBe(1);
  await page.goto(`/work/${task}`);
  await page.getByRole("button", { name: "Claim this task", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("The task is assigned to you.");
  await page.goto("/workspace");
  await page.getByLabel("Progress", { exact: true }).selectOption("IN PROGRESS");
  await page.getByRole("button", { name: "Update progress", exact: true }).click();
  await expect(page.getByLabel("Progress", { exact: true })).toHaveValue("REVIEW");
  await page.getByLabel("Progress", { exact: true }).selectOption("BLOCKED");
  await page.getByRole("button", { name: "Update progress", exact: true }).click();
  await expect(page.getByLabel("Progress", { exact: true })).toHaveValue("IN PROGRESS");
  expect((await rows(request, "alice", "tasks", `select=status&id=eq.${task}`))[0].status).toBe("BLOCKED");
  await page.getByRole("button", { name: "Update progress", exact: true }).click();
  await expect(page.getByLabel("Progress", { exact: true })).toHaveValue("REVIEW");
  await page.getByLabel("Evidence / pull request URL").fill("https://example.invalid/test-deliverable");
  await page.getByRole("button", { name: "Update progress", exact: true }).click();
  await expect(page.getByText(/Your submission is awaiting/)).toBeVisible();
  await page.goto("/reviews");
  await expect(page.getByRole("heading", { name: "No independent reviews waiting." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Record independent review", exact: true })).toHaveCount(0);
  await signIn(context, request, "bruno");
  await page.goto("/reviews");
  await page.getByLabel("Review evidence and findings").fill("TEST changes requested: add the missing verification evidence to the local deliverable.");
  await page.getByRole("button", { name: "Record independent review", exact: true }).click();
  await expect.poll(async () => (await rows(request, "bruno", "tasks", `select=status&id=eq.${task}`))[0].status).toBe("IN PROGRESS");
  await expect(page.getByRole("heading", { name: "No independent reviews waiting." })).toBeVisible();
  await signIn(context, request, "alice");
  await page.goto("/workspace");
  await page.getByLabel("Evidence / pull request URL").fill("https://example.invalid/test-deliverable-v2");
  await page.getByRole("button", { name: "Update progress", exact: true }).click();
  await expect(page.getByText(/Your submission is awaiting/)).toBeVisible();
  await signIn(context, request, "bruno");
  await page.goto("/reviews");
  await page.getByLabel("Review evidence and findings").fill("TEST reviewed the exact synthetic deliverable against all acceptance criteria.");
  await page.getByLabel(/Outcome for submission/).selectOption("APPROVED");
  await page.getByRole("button", { name: "Record independent review", exact: true }).click();
  await expect(page.getByRole("button", { name: "Accept completed task", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Accept completed task", exact: true }).click();
  await expect.poll(async () => (await rows(request, "bruno", "tasks", `select=status&id=eq.${task}`))[0].status).toBe("COMPLETE");
  await expect(page.getByRole("heading", { name: "No independent reviews waiting." })).toBeVisible();
  await signIn(context, request, "alice");
  await page.goto("/workspace");
  await expect(page.getByText(/Accepted work. Keep its evidence available/)).toBeVisible();
  await capture(page, "accepted-member-workspace");
});

test("notifications remain private and marking them read survives reload", async ({ page, context, request }) => {
  await signIn(context, request, "alice");
  await page.goto("/inbox");
  await page.getByRole("button", { name: "Mark all as read", exact: true }).click();
  await expect.poll(async () => (await rows(request, "alice", "notifications"))[0].read_at).toBeTruthy();
  await expect(page.getByRole("button", { name: "Mark all as read", exact: true })).toHaveCount(0);
  await page.reload();
  expect((await rows(request, "alice", "notifications"))[0].read_at).toBeTruthy();
  expect(await rows(request, "bruno", "notifications")).toEqual([]);
});

test("profile service failure keeps edits and retry recovers without breaking public navigation", async ({ page, context, request }) => {
  await signIn(context, request, "alice");
  await page.goto("/account");
  await page.getByLabel("Display name", { exact: true }).fill("TEST Alice Recovered");
  await request.post(`${backend}/__test/fail-next`, { data: { path: "/rest/v1/profiles", method: "PATCH" } });
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.locator("#profile-feedback")).toContainText("Your profile could not be saved.");
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("TEST Alice Recovered");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Profile saved." })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("TEST Alice Recovered");
  await request.post(`${backend}/__test/fail-next`, { data: { path: "/rest/v1/profiles", method: "GET" } });
  await page.goto("/docs/security");
  await expect(page.getByText("Something went wrong", { exact: true })).toHaveCount(0);
  await expect(page.locator(".topbar").getByRole("link", { name: "My account", exact: true })).toBeVisible();
  await page.goto("/account");
  // The installed SDK retries idempotent reads after a transient 503. Verify
  // recovery from the actual HTTP transcript rather than expecting an error UI.
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("TEST Alice Recovered");
  const transcript = await (await request.get(`${backend}/__test/requests`)).json();
  const failure = transcript.findIndex((entry: any) => entry.method === "GET" && entry.path === "/rest/v1/profiles" && entry.status === 503);
  expect(failure).toBeGreaterThanOrEqual(0);
  expect(transcript.slice(failure + 1).some((entry: any) => entry.method === "GET" && entry.path === "/rest/v1/profiles" && entry.status === 200)).toBeTruthy();
  await page.reload();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("TEST Alice Recovered");
});

test("proposal saves a draft, submits substantive evidence and stays author-private", async ({ page, context, request }) => {
  await signIn(context, request, "alice");
  await page.goto("/propose");
  await page.getByLabel("Working title").fill("TEST accessible local contribution planning");
  const contextText = "TEST: This synthetic local proposal records a specific human need, evidence and a reversible contribution plan.";
  await page.locator("#proposal-section").fill(contextText);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Working title")).toHaveValue("TEST accessible local contribution planning");
  for (let step = 0; step < 10; step++) {
    await page.locator("#proposal-section").fill(`${contextText} Section ${step + 1}.`);
    await page.getByRole("button", { name: "Next section →", exact: true }).click();
  }
  await page.locator("#proposal-section").fill("https://example.invalid/test-primary-evidence");
  await page.getByRole("button", { name: "Submit for research review", exact: true }).click();
  await expect(page.getByRole("link", { name: "View your proposal ↗" })).toBeVisible();
  const saved = await rows(request, "alice", "proposals");
  expect(saved).toHaveLength(1);
  expect(await rows(request, "bruno", "proposals")).toEqual([]);
  await page.getByRole("link", { name: "View your proposal ↗" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(saved[0].title);
  await page.reload();
  await capture(page, "submitted-private-proposal");
});

test("persistent query failure renders a real retry state and reload restores the account", async ({ page, context, request }) => {
  await signIn(context, request, "alice");
  // A nonretryable database/query error exercises the boundary separately from
  // the SDK's legitimate transient-read retry behavior.
  await request.post(`${backend}/__test/fail-next`, { data: { path: "/rest/v1/profiles", method: "GET", status: 400 } });
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "We couldn’t load this record." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  await expect(page.locator(".topbar").getByRole("link", { name: "My account", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("TEST Alice");
  await page.reload();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("TEST Alice");
});

test("signed-in workspace puts commitments first and optional handoff drafts remain recoverable", async ({ page, context, request }) => {
  await signIn(context, request, "alice");
  await page.goto("/workspace");
  const summary = page.getByText("Prepare or resume a handoff", { exact: true });
  const details = page.locator("details").filter({ has: summary });
  await expect(details).not.toHaveAttribute("open");
  await expect(page.getByLabel("Handoff title", { exact: true })).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "My commitments", exact: true })).toBeVisible();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  await page.getByLabel("Handoff title", { exact: true }).fill("TEST recoverable signed-in handoff");
  await page.getByLabel("Context and objective", { exact: true }).fill("TEST optional working notes remain available without hiding actual commitments.");
  await expect(page.getByRole("status").filter({ hasText: "Unfinished changes are being recovered on this device." })).toBeVisible();
  await page.reload();
  await summary.click();
  await expect(page.getByLabel("Handoff title", { exact: true })).toHaveValue("TEST recoverable signed-in handoff");
  await summary.click();
  await expect(page.getByLabel("Handoff title", { exact: true })).not.toBeVisible();
  await capture(page, "commitments-first-workspace");
});

test("private member sees clear participation recovery; account remains accessible by keyboard", async ({ page, context, request }) => {
  await signIn(context, request, "chris");
  await page.goto("/workspace");
  await expect(page.getByRole("link", { name: "Publish your contributor profile", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Publish your contributor profile", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your profile is private" })).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations).toEqual([]);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".topbar").getByRole("link", { name: /Sign in/ })).toBeVisible();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=/);
});
