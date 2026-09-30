import test from "node:test";
import assert from "node:assert/strict";
import {
  readHandoffDraft,
  serializeHandoffDraft,
  type HandoffDraft,
} from "../lib/handoff-draft";

const draft: HandoffDraft = {
  id: "",
  title: "In progress",
  context: "A local recovery copy",
  changes: "",
  evidence: "",
  remaining: "",
  reviewer: "",
  updatedAt: "",
};

test("unfinished handoff draft round-trips as a separate versioned record", () => {
  const raw = serializeHandoffDraft(draft);
  assert.ok(raw);
  assert.deepEqual(readHandoffDraft(raw), draft);
});

test("malformed, oversized, and future-version recovery records are rejected", () => {
  for (const raw of [
    null,
    "{bad",
    "x".repeat(40001),
    JSON.stringify({ version: 2, draft }),
    JSON.stringify({ version: 1, draft: { ...draft, title: "x".repeat(161) } }),
    JSON.stringify({
      version: 1,
      draft: { ...draft, context: "x".repeat(6001) },
    }),
    JSON.stringify({ version: 1, draft: { ...draft, id: "not-a-note-id" } }),
  ])
    assert.equal(readHandoffDraft(raw), null);
});

test("edits associated with a deleted note cannot be recovered", () => {
  const savedEdit = { ...draft, id: "123e4567-e89b-12d3-a456-426614174000" };
  const raw = serializeHandoffDraft(savedEdit);
  assert.ok(raw);
  assert.equal(readHandoffDraft(raw, new Set()), null);
  assert.deepEqual(readHandoffDraft(raw, new Set([savedEdit.id])), savedEdit);
});

test("unknown fields are not copied into recovered browser state", () => {
  const raw = JSON.stringify({
    version: 1,
    draft: { ...draft, is_admin: true, role: "maintainer" },
  });
  assert.deepEqual(readHandoffDraft(raw), draft);
});
