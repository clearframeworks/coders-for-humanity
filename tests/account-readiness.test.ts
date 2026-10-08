import test from "node:test";
import assert from "node:assert/strict";
import { accountDataAvailable, githubAuthEnabled } from "../lib/account-readiness";

test("account entry fails closed for missing schema, rejected permissions and outages", async () => {
  for (const code of ["PGRST106", "42501", "57P03"]) {
    assert.equal(await accountDataAvailable(async () => ({ error: { code } })), false);
  }
  assert.equal(await accountDataAvailable(async () => { throw new Error("timeout"); }), false);
  assert.equal(await accountDataAvailable(async () => ({ error: null })), true);
});

test("GitHub sign-in requires an explicit enabled provider setting", () => {
  for (const value of [undefined, "", "false", "1", "TRUE"]) assert.equal(githubAuthEnabled(value), false);
  assert.equal(githubAuthEnabled("true"), true);
});
