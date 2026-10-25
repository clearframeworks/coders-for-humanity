export type HandoffDraft = {
  id: string;
  title: string;
  context: string;
  changes: string;
  evidence: string;
  remaining: string;
  reviewer: string;
  updatedAt: string;
};

export const handoffDraftStorageKey = "cfh-handoff-draft:v1";
const maxStorageLength = 40000;
const idPattern = /^[a-f0-9-]{36}$/i;

const fieldLimits = {
  title: 160,
  context: 6000,
  changes: 6000,
  evidence: 6000,
  remaining: 6000,
  reviewer: 6000,
} as const;

function isDraft(value: unknown): value is HandoffDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.id !== "string" ||
    (draft.id !== "" && !idPattern.test(draft.id)) ||
    typeof draft.updatedAt !== "string" ||
    (draft.updatedAt !== "" && !Number.isFinite(Date.parse(draft.updatedAt)))
  )
    return false;

  return Object.entries(fieldLimits).every(
    ([key, max]) =>
      typeof draft[key] === "string" && (draft[key] as string).length <= max,
  );
}

export function serializeHandoffDraft(draft: HandoffDraft): string | null {
  if (!isDraft(draft)) return null;
  const raw = JSON.stringify({ version: 1, draft });
  return raw.length <= maxStorageLength ? raw : null;
}

export function readHandoffDraft(
  raw: string | null,
  savedNoteIds?: ReadonlySet<string>,
): HandoffDraft | null {
  if (!raw || raw.length > maxStorageLength) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const envelope = value as Record<string, unknown>;
    if (envelope.version !== 1 || !isDraft(envelope.draft)) return null;
    if (
      envelope.draft.id &&
      savedNoteIds &&
      !savedNoteIds.has(envelope.draft.id)
    )
      return null;
    const draft = envelope.draft;
    return {
      id: draft.id,
      title: draft.title,
      context: draft.context,
      changes: draft.changes,
      evidence: draft.evidence,
      remaining: draft.remaining,
      reviewer: draft.reviewer,
      updatedAt: draft.updatedAt,
    };
  } catch {
    return null;
  }
}
