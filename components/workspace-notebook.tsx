"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { humanWork } from "@/lib/harness";
import {
  handoffDraftStorageKey,
  readHandoffDraft,
  serializeHandoffDraft,
} from "@/lib/handoff-draft";

const storageKey = "cfh-handoff-notebook:v1";
const fields = [
  {
    key: "context",
    label: "Context and objective",
    hint: "The problem, relevant decisions, and what success means.",
  },
  {
    key: "changes",
    label: "Work completed",
    hint: "What changed? What did you learn?",
  },
  {
    key: "evidence",
    label: "Evidence and verification",
    hint: "Links to your pull request, research, tests, screenshots, or deliverable.",
  },
  {
    key: "remaining",
    label: "Remaining work and blockers",
    hint: "The next useful step, unresolved questions, and any risks.",
  },
  {
    key: "reviewer",
    label: "Review needed",
    hint: "The expertise needed and what the reviewer should check. Do not enter private contact details.",
  },
] as const;
type Handoff = {
  id: string;
  title: string;
  context: string;
  changes: string;
  evidence: string;
  remaining: string;
  reviewer: string;
  updatedAt: string;
};
const emptyNote: Handoff = {
  id: "",
  title: "",
  context: "",
  changes: "",
  evidence: "",
  remaining: "",
  reviewer: "",
  updatedAt: "",
};
function readNotes(raw: string | null): Handoff[] {
  if (!raw || raw.length > 1500000) return [];
  const value: unknown = JSON.parse(raw);
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("notes" in value) ||
    !Array.isArray(value.notes)
  )
    return [];
  return value.notes.slice(0, 30).flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const note = item as Record<string, unknown>;
    if (
      typeof note.id !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(note.id) ||
      typeof note.title !== "string" ||
      typeof note.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(note.updatedAt)) ||
      fields.some((f) => typeof note[f.key] !== "string")
    )
      return [];
    return [
      {
        id: note.id,
        title: note.title.slice(0, 160),
        updatedAt: new Date(note.updatedAt).toISOString(),
        ...Object.fromEntries(
          fields.map((f) => [f.key, (note[f.key] as string).slice(0, 6000)]),
        ),
      } as Handoff,
    ];
  });
}
function markdown(note: Handoff) {
  return `# ${note.title}\n\nPersonal handoff draft — not submitted or approved.\n\n${fields.map((f) => `## ${f.label}\n\n${note[f.key].trim() || "Not recorded yet."}`).join("\n\n")}\n\n---\nPrepared in Coders for Humanity. Task acceptance does not authorize deployment.\n`;
}

export function WorkspaceNotebook({
  initialTaskId,
}: {
  initialTaskId?: string;
}) {
  const [notes, setNotes] = useState<Handoff[]>([]);
  const [draft, setDraft] = useState<Handoff>(emptyNote);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [recoveryStatus, setRecoveryStatus] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState(initialTaskId ?? "");
  useEffect(() => {
    let savedNotes: Handoff[] = [];
    let notebookAvailable = false;
    try {
      savedNotes = readNotes(localStorage.getItem(storageKey));
      setNotes(savedNotes);
      notebookAvailable = true;
    } catch {
      setMessage(
        "Saved notes could not be read. You can still write and export a handoff.",
      );
    }
    try {
      const rawDraft = localStorage.getItem(handoffDraftStorageKey);
      const recovered = readHandoffDraft(
        rawDraft,
        notebookAvailable
          ? new Set(savedNotes.map((note) => note.id))
          : undefined,
      );
      if (recovered) {
        if (recovered.id && !notebookAvailable) {
          setRecoveryStatus(
            "A recovery edit for a saved note remains in browser storage, but saved notes could not be read to check it. It was kept in storage and not restored.",
          );
        } else {
          setDraft(recovered);
          setDirty(true);
          setRecoveryStatus(
            "An unfinished handoff was recovered from this browser. Save or export it to keep a copy.",
          );
        }
      } else if (rawDraft) {
        // Invalid drafts and edits for deleted notes must not linger to be
        // mistaken for recoverable work later.
        localStorage.removeItem(handoffDraftStorageKey);
        setRecoveryStatus(
          "A saved recovery draft was invalid or belonged to a deleted note, so it was discarded.",
        );
      }
    } catch {
      setRecoveryStatus(
        "Recovery storage could not be read. This draft may not survive leaving this page.",
      );
    }
    setReady(true);
  }, []);
  useEffect(() => {
    setSelectedTaskId(initialTaskId ?? "");
  }, [initialTaskId]);
  function persist(next: Handoff[]) {
    try {
      if (next.length)
        localStorage.setItem(
          storageKey,
          JSON.stringify({ version: 1, notes: next }),
        );
      else localStorage.removeItem(storageKey);
      setNotes(next);
      return true;
    } catch {
      setMessage(
        "The saved notebook could not be updated. The current fields remain in the editor; browser recovery may contain an earlier copy. Export the latest fields before leaving this page.",
      );
      return false;
    }
  }
  function persistRecovery(next: Handoff) {
    try {
      const serialized = serializeHandoffDraft(next);
      if (!serialized) {
        setRecoveryStatus(
          "This version is too large to keep as a recovery draft. An earlier copy may still be restored; export the current fields before leaving this page.",
        );
        return false;
      }
      localStorage.setItem(handoffDraftStorageKey, serialized);
      setRecoveryStatus(
        "Unfinished changes are being recovered on this device.",
      );
      return true;
    } catch {
      setRecoveryStatus(
        "The latest edit could not be written to browser recovery storage. An earlier copy may still be restored; export the current fields before leaving this page.",
      );
      return false;
    }
  }
  function clearRecovery() {
    try {
      localStorage.removeItem(handoffDraftStorageKey);
      setRecoveryStatus("");
      return true;
    } catch {
      setRecoveryStatus(
        "The recovery copy could not be cleared from browser storage. It will be checked against saved notes before it can be restored.",
      );
      return false;
    }
  }
  function confirmReplaceDraft() {
    if (!dirty) return true;
    return window.confirm(
      "Replace the unfinished handoff in the editor? Its recovery copy will no longer be available here. Save or export it first if you want to keep it.",
    );
  }
  function edit(key: keyof Handoff, value: string) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    setDirty(true);
    setMessage("");
    if (ready) persistRecovery(next);
  }
  function loadTaskPlan() {
    const task = humanWork.find((item) => item.id === selectedTaskId);
    if (!task) return;
    const hasDraftContent = Object.values(draft).some(
      (value) => value.trim().length > 0,
    );
    if (
      hasDraftContent &&
      !window.confirm(
        "Replace the current handoff fields with this task plan? Save or export the current draft first if you want to keep it.",
      )
    ) {
      setMessage("Current handoff kept. The task plan was not loaded.");
      return;
    }
    if (!clearRecovery()) {
      setMessage(
        "The task plan was not loaded because the current recovery copy could not be cleared.",
      );
      return;
    }
    const taskDraft = {
      ...emptyNote,
      title: `Task: ${task.title}`,
      context: [
        `Task brief: https://cfh.retehost.com/work/${task.id}`,
        `Objective: ${task.objective}`,
        `Current context: ${task.context}`,
        `Acceptance criteria: ${task.acceptance}`,
        `Dependencies: ${task.dependencies}`,
      ].join("\n\n"),
      reviewer: task.reviewer,
    };
    setDraft(taskDraft);
    setDirty(true);
    const recovered = persistRecovery(taskDraft);
    setMessage(
      recovered
        ? "Task plan loaded into an editable draft. Save it on this device or export it to keep a copy."
        : "Task plan loaded, but browser recovery could not be updated. Export it before leaving this page.",
    );
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([markdown(draft)], { type: "text/markdown;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${
      draft.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 70) || "cfh-handoff"
    }.md`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(
      "Markdown download prepared. This has not been submitted to the project.",
    );
  }
  return (
    <section className="hub-panel" aria-labelledby="notebook-title">
      <div className="hub-meta">
        PERSONAL HANDOFF NOTEBOOK · THIS DEVICE ONLY
      </div>
      <h2 id="notebook-title">Leave the next person enough context.</h2>
      <p>
        Prepare your handoff while you work. Notes are saved only in this
        browser, are not encrypted, and are not shared with a project. Export a
        copy before clearing browser data. Keep credentials and private
        information out.
      </p>
      <div className="form-shell">
        <div className="field">
          <label htmlFor="handoff-task">Start from a founding task</label>
          <select
            id="handoff-task"
            value={selectedTaskId}
            onChange={(event) => setSelectedTaskId(event.target.value)}
          >
            <option value="">Choose a real task to plan around</option>
            {humanWork.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title} · {task.effort}
              </option>
            ))}
          </select>
          <p className="form-help">
            Loads the task’s published scope and reviewer role into an editable
            personal handoff. It does not claim the task or contact anyone.
          </p>
        </div>
        <div className="form-actions">
          <button
            className="button"
            type="button"
            disabled={!selectedTaskId}
            onClick={loadTaskPlan}
          >
            Load task plan
          </button>
          {selectedTaskId && (
            <Link className="text-link" href={`/work/${selectedTaskId}`}>
              Open task context →
            </Link>
          )}
        </div>
      </div>
      {notes.length > 0 && (
        <div className="hub-stack" aria-label="Saved handoffs">
          {notes.map((note) => (
            <div className="hub-row" key={note.id}>
              <div>
                <strong>{note.title}</strong>
                <div className="hub-meta">
                  Saved {new Date(note.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <button
                className="button"
                type="button"
                aria-label={`Edit ${note.title}`}
                onClick={() => {
                  if (dirty && !confirmReplaceDraft()) {
                    setMessage(
                      "Current handoff kept. The saved note was not opened.",
                    );
                    return;
                  }
                  if (!clearRecovery()) {
                    setMessage(
                      "The saved note was not opened because the current recovery copy could not be cleared.",
                    );
                    return;
                  }
                  setDraft(note);
                  setDirty(false);
                  setMessage(`Editing “${note.title}”.`);
                }}
              >
                Edit
              </button>
              <button
                className="button"
                type="button"
                aria-label={`Delete ${note.title}`}
                onClick={() => {
                  if (draft.id === note.id && dirty && !confirmReplaceDraft())
                    return;
                  if (persist(notes.filter((n) => n.id !== note.id))) {
                    if (draft.id === note.id) {
                      setDraft(emptyNote);
                      setDirty(false);
                    }
                    const recoveryCleared =
                      draft.id !== note.id || clearRecovery();
                    setMessage(
                      recoveryCleared
                        ? "Handoff deleted from this browser."
                        : "Handoff deleted. Its recovery copy could not be cleared, and will be rejected because the saved note no longer exists.",
                    );
                  }
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
      <form
        className="form-shell"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.title.trim()) return;
          if (!draft.id && notes.length >= 30) {
            setMessage(
              "This notebook holds 30 handoffs. Export and remove an older note before saving another.",
            );
            return;
          }
          const note = {
            ...draft,
            title: draft.title.trim(),
            id: draft.id || crypto.randomUUID(),
            updatedAt: new Date().toISOString(),
          };
          const next = [note, ...notes.filter((n) => n.id !== note.id)];
          if (persist(next)) {
            setDraft(note);
            setDirty(false);
            const recoveryCleared = clearRecovery();
            setMessage(
              recoveryCleared
                ? "Handoff saved on this device. Nothing has been published."
                : "Handoff saved on this device, but its recovery copy could not be cleared. Nothing has been published.",
            );
          }
        }}
      >
        <div className="field">
          <label htmlFor="handoff-title">Handoff title</label>
          <input
            id="handoff-title"
            required
            maxLength={160}
            value={draft.title}
            onChange={(e) => edit("title", e.target.value)}
            placeholder="Task or project — current state"
          />
        </div>
        {fields.map((field) => (
          <div className="field" key={field.key}>
            <label htmlFor={`handoff-${field.key}`}>{field.label}</label>
            <textarea
              id={`handoff-${field.key}`}
              maxLength={6000}
              rows={field.key === "reviewer" ? 2 : 3}
              value={draft[field.key]}
              onChange={(e) => edit(field.key, e.target.value)}
              placeholder={field.hint}
            />
          </div>
        ))}
        <div className="form-actions">
          <button className="button primary" disabled={!ready}>
            Save handoff on this device
          </button>
          <button
            className="button"
            type="button"
            disabled={!draft.title.trim()}
            onClick={download}
          >
            Export Markdown
          </button>
          <button
            className="button"
            type="button"
            onClick={() => {
              if (!confirmReplaceDraft()) {
                setMessage("Current handoff kept. No new handoff was opened.");
                return;
              }
              if (!clearRecovery()) {
                setMessage(
                  "No new handoff was opened because the current recovery copy could not be cleared.",
                );
                return;
              }
              setDraft(emptyNote);
              setDirty(false);
              setMessage(
                "New handoff opened. Previously saved notes remain above.",
              );
            }}
          >
            New handoff
          </button>
          <button
            className="button"
            type="button"
            disabled={!ready}
            onClick={() => {
              if (persist([])) {
                if (!clearRecovery()) {
                  setMessage(
                    "Saved notes were cleared, but browser storage could not clear the recovery draft. It may return when this page reloads.",
                  );
                  return;
                }
                setDraft(emptyNote);
                setDirty(false);
                setMessage("Notebook cleared from this browser.");
              }
            }}
          >
            Clear notebook
          </button>
        </div>
        <p className="form-help" role="status" aria-live="polite">
          {message ||
            (dirty
              ? "Unfinished changes — save on this device or export before leaving."
              : "Saving a handoff does not claim a task, submit a review, or authorize deployment.")}
        </p>
        {recoveryStatus && (
          <p className="form-help" role="status" aria-live="polite">
            {recoveryStatus}
          </p>
        )}
      </form>
    </section>
  );
}
