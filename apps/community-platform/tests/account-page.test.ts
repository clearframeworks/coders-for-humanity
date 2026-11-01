import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { Script } from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Execute the actual server component and ProfileForm with fixture data.
// This verifies rendering and query scoping, not a Supabase session or persistence.
const memberId = "11111111-1111-4111-8111-111111111111";
const profile = {
  id: memberId, username: "fixture-member", name: "Fixture Member",
  bio: "I test community software.", availability: "One hour weekly",
  location: "", github_url: null, website_url: null, is_demo: false,
  is_public: true,
};
type Fixture = {
  profile: typeof profile | null;
  assignments: { task_id: string; tasks: { title: string; status: string } | null }[];
  signedIn?: boolean;
  error?: boolean;
};

async function renderAccount(fixture: Fixture) {
  const filters: { table: string; field: string; value: string }[] = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: fixture.signedIn === false ? null : { id: memberId } } }) },
    from(table: string) {
      return { select: () => ({ eq(field: string, value: string) {
        filters.push({ table, field, value });
        const result = {
          data: table === "profiles" ? fixture.profile : table === "task_assignments" ? fixture.assignments : [],
          error: fixture.error ? { message: "Fixture dependency failure" } : null,
        };
        return Object.assign(Promise.resolve(result), { maybeSingle: async () => result });
      } }) };
    },
  };
  const requireModule = createRequire(import.meta.url);
  const dependencies: Record<string, unknown> = {
    "@/lib/supabase": { createClient: async () => db, isDemo: () => false, configured: () => true },
    "@/app/actions": { signOut: async () => {}, saveProfile: async () => ({ error: "Fixture is read-only" }) },
    "next/navigation": { redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } },
  };
  function load(file: string): Record<string, any> {
    const exports: Record<string, any> = {};
    const code = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    new Script(code, { filename: file }).runInNewContext({
      exports, process, Error, URL,
      require(name: string) {
        if (name in dependencies) return dependencies[name];
        if (name.startsWith("@/") || name.startsWith(".")) {
          const base = name.startsWith("@/") ? resolve(name.slice(2)) : resolve(dirname(file), name);
          try { return load(`${base}.tsx`); }
          catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
            return load(`${base}.ts`);
          }
        }
        return requireModule(name);
      },
    });
    return exports;
  }
  const element = await load(resolve("app/account/page.tsx")).default();
  return { html: renderToStaticMarkup(element), filters };
}

test("account renders member commitments and scopes every query to the authenticated member", async () => {
  const { html, filters } = await renderAccount({ profile, assignments: [
    { task_id: "task-available", tasks: { title: "Check keyboard navigation", status: "IN PROGRESS" } },
    { task_id: "task-removed", tasks: null },
  ] });
  assert.match(html, /Your profile is published/);
  assert.match(html, /href="\/people\/fixture-member"/);
  assert.match(html, /href="\/work\/task-available">Check keyboard navigation/);
  assert.match(html, /in progress/);
  assert.match(html, /This assigned task is no longer available/);
  assert.doesNotMatch(html, /href="\/work\/task-removed"/);
  for (const route of ["workspace", "inbox", "discussions", "projects", "contribute", "propose"])
    assert.match(html, new RegExp(`href="/${route}"`));
  assert.equal(filters.length, 3);
  assert.ok(filters.every((filter) => filter.value === memberId));
  assert.deepEqual(filters.map(({ table, field }) => ({ table, field })), [
    { table: "profiles", field: "id" }, { table: "proposals", field: "user_id" }, { table: "task_assignments", field: "user_id" },
  ]);
});

test("private and missing profiles keep public links absent and offer real next actions", async () => {
  for (const current of [{ ...profile, is_public: false, bio: "", availability: "" }, null]) {
    const { html } = await renderAccount({ profile: current, assignments: [] });
    assert.match(html, current ? /Your profile is private/ : /Create your contributor profile/);
    assert.doesNotMatch(html, /href="\/people\//);
    assert.match(html, /a short introduction and the time you have available/);
    assert.match(html, /Find work that fits your skills and time/);
    assert.match(html, /Describe the problem/);
    assert.match(html, /id="your-profile"/);
    assert.match(html, /Sign out/);
  }
});

test("account rejects missing authentication and dependency failures", async () => {
  await assert.rejects(renderAccount({ profile: null, assignments: [], signedIn: false }), /REDIRECT:\/login\?next=\/account/);
  await assert.rejects(renderAccount({ profile, assignments: [], error: true }), /Your account records could not be loaded/);
});

test("optional account fixture browser captures at mobile and desktop widths", { skip: !process.env.CFH_ACCOUNT_CAPTURE_DIR }, async () => {
  const { chromium } = await import("@playwright/test");
  const output = resolve(process.env.CFH_ACCOUNT_CAPTURE_DIR!);
  mkdirSync(output, { recursive: true });
  const css = ["globals", "hub", "people-first", "interaction"].map((name) => readFileSync(`app/${name}.css`, "utf8")).join("\n");
  const browser = await chromium.launch({ headless: true, ...(process.env.CFH_CHROMIUM_PATH ? { executablePath: process.env.CFH_CHROMIUM_PATH } : {}) });
  const captures: object[] = [];
  try {
    for (const [name, fixture] of Object.entries({
      public: { profile, assignments: [{ task_id: "fixture-task", tasks: { title: "Check keyboard navigation", status: "IN PROGRESS" } }, { task_id: "fixture-removed", tasks: null }] },
      private: { profile: { ...profile, is_public: false, bio: "", availability: "" }, assignments: [] },
      new: { profile: null, assignments: [] },
    })) {
      const { html } = await renderAccount(fixture);
      writeFileSync(resolve(output, `${name}.html`), html);
      for (const width of [390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 } });
        await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style></head><body><main>${html}</main></body></html>`);
        assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
        assert.equal(await page.getByRole("navigation", { name: "Your community" }).count(), 1);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${name} overflows at ${width}px`);
        for (const route of ["workspace", "inbox", "discussions", "projects"])
          assert.equal(await page.locator(`nav a[href="/${route}"]`).count(), 1);
        await page.screenshot({ path: resolve(output, `${name}-${width}.png`), fullPage: true });
        captures.push({ state: name, width, horizontalOverflow: false });
        await page.close();
      }
    }
  } finally { await browser.close(); }
  writeFileSync(resolve(output, "verification.json"), JSON.stringify({ boundary: "Actual account server component and profile form rendered with fixture identity/data; no live session, persistence, hydration, or submission claim.", captures }, null, 2));
});
