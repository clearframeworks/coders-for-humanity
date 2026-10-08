import test from "node:test";
import assert from "node:assert/strict";
import { summarizeChecks, providerUrl, type CheckRun } from "../lib/github-checks";

const sha = "a".repeat(40);
const run: CheckRun = { id: 1, name: "verify", head_sha: sha, status: "completed", conclusion: "success", html_url: "https://github.com/clearframeworks/coders-for-humanity/actions/runs/1" };
const runs = { total_count: 1, check_runs: [run] };
const statuses = { sha, total_count: 0, statuses: [] };

test("only complete current-commit successful results show passed", () => {
  assert.equal(summarizeChecks(sha, runs, statuses).state, "passed");
  assert.equal(summarizeChecks(sha, null, statuses).state, "unavailable");
  assert.equal(summarizeChecks(sha, { ...runs, total_count: 101 }, statuses).state, "unavailable");
  assert.equal(summarizeChecks(sha, runs, { ...statuses, sha: "b".repeat(40) }).state, "unavailable");
  assert.equal(summarizeChecks(sha, { ...runs, check_runs: [{ ...run, head_sha: "b".repeat(40) }] }, statuses).state, "unavailable");
  assert.equal(summarizeChecks(sha, { total_count: 0, check_runs: [] }, statuses).state, "unreported");
});

test("pending, skipped, cancelled and failed checks never imply success", () => {
  for (const conclusion of ["failure", "cancelled", "timed_out", "action_required"]) {
    assert.equal(summarizeChecks(sha, { ...runs, check_runs: [{ ...run, conclusion }] }, statuses).state, "failed");
  }
  for (const conclusion of ["skipped", "neutral", null]) {
    assert.equal(summarizeChecks(sha, { ...runs, check_runs: [{ ...run, conclusion }] }, statuses).state, "pending");
  }
  assert.equal(summarizeChecks(sha, { ...runs, check_runs: [{ ...run, status: "in_progress" }] }, statuses).state, "pending");
});

test("deployment labels require the Vercel sender and cannot supply arbitrary link schemes", () => {
  const status = { context: "Vercel", state: "success", target_url: "https://vercel.com/clearframeworks-projects/coders-for-humanity/deployments/one", creator: { login: "vercel[bot]" } };
  assert.equal(summarizeChecks(sha, runs, { sha, total_count: 1, statuses: [status] }).deployment?.state, "success");
  assert.equal(summarizeChecks(sha, runs, { sha, total_count: 1, statuses: [{ ...status, creator: { login: "someone-else" } }] }).deployment, null);
  for (const url of ["javascript:alert(1)", "http://github.com", "https://github.com.evil.test", "https://user:pass@vercel.com", "https://example.com"]) assert.equal(providerUrl(url), null);
  assert.equal(providerUrl("https://cfh-test.vercel.app"), "https://cfh-test.vercel.app/");
});
