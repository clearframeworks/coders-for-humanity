import test from "node:test";
import assert from "node:assert/strict";
import { readProfileDraft, emptyProfile } from "../lib/profile-draft";
import { profileSchema } from "../lib/validation";

test("unfinished profile drafts restore without granting privileges", () => {
  const result = readProfileDraft(
    JSON.stringify({
      version: 1,
      step: 0,
      profile: {
        ...emptyProfile,
        name: "Sam",
        username: "s",
        is_admin: true,
        role: "maintainer",
      },
    }),
  );
  assert.equal(result?.profile.name, "Sam");
  assert.equal(result?.profile.username, "s");
  assert.equal("is_admin" in result!.profile, false);
  assert.equal("role" in result!.profile, false);
  assert.equal(profileSchema.safeParse(result?.profile).success, false);
});
test("malformed, oversized, and future-version browser drafts are rejected", () => {
  for (const raw of [
    null,
    "{bad",
    "a".repeat(18001),
    JSON.stringify({ version: 2, step: 0, profile: emptyProfile }),
    JSON.stringify({ version: 1, step: 9, profile: emptyProfile }),
    JSON.stringify({
      version: 1,
      step: 0,
      profile: { ...emptyProfile, bio: "a".repeat(2001) },
    }),
  ])
    assert.equal(readProfileDraft(raw), null);
});
test("publishable profiles require a valid handle and safe portfolio URL", () => {
  const profile = { ...emptyProfile, name: "Sam", username: "sam-r" };
  assert.equal(profileSchema.safeParse(profile).success, true);
  for (const website_url of [
    "javascript:alert(1)",
    "http://example.org",
    "https://example.org/" + "a".repeat(2000),
  ])
    assert.equal(
      profileSchema.safeParse({ ...profile, website_url }).success,
      false,
    );
  assert.equal(profile.is_public, false);
});
