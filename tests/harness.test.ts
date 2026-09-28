import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateRelease,
  type ReleaseEvidence,
  requiredChecks,
} from "../lib/harness";

const sha = "a".repeat(40);
function evidence(): ReleaseEvidence {
  return {
    commit: sha,
    author: "contributor",
    rollback: "previous-deployment-id",
    checks: requiredChecks.map((name) => ({ name, commit: sha, passed: true })),
    approvals: [
      { role: "maintainer", actor: "reviewer", commit: sha },
      { role: "security", actor: "security-reviewer", commit: sha },
      { role: "release", actor: "release-steward", commit: sha },
    ],
  };
}
test("release policy blocks self approval and combined reviewer identities", () => {
  const self = evidence();
  self.approvals[0].actor = " CONTRIBUTOR ";
  assert.equal(evaluateRelease(self).eligible, false);
  const duplicate = evidence();
  duplicate.approvals[1].actor = duplicate.approvals[0].actor;
  assert.equal(evaluateRelease(duplicate).eligible, false);
});
test("new commits invalidate previously passing checks and reviews", () => {
  const changed = evidence();
  changed.commit = "b".repeat(40);
  const result = evaluateRelease(changed);
  assert.equal(result.eligible, false);
  assert.equal(result.blockers.length, 6);
});
test("missing, failing, and contradictory checks fail closed", () => {
  for (const mode of ["missing", "failed", "duplicate"] as const) {
    const candidate = evidence();
    if (mode === "missing") candidate.checks.pop();
    if (mode === "failed") candidate.checks[0].passed = false;
    if (mode === "duplicate")
      candidate.checks.push({ ...candidate.checks[0], passed: false });
    assert.equal(evaluateRelease(candidate).eligible, false);
  }
});
test("policy requires complete identity and recovery evidence", () => {
  for (const field of ["commit", "author", "rollback"] as const) {
    const candidate = evidence();
    candidate[field] = "";
    assert.equal(evaluateRelease(candidate).eligible, false);
  }
  assert.deepEqual(evaluateRelease(evidence()), {
    eligible: true,
    blockers: [],
  });
});
