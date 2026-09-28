"use client";
import { useEffect, useState } from "react";

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

export function WorkspaceNotebook() {
  const [notes, setNotes] = useState<Handoff[]>([]);
  const [draft, setDraft] = useState<Handoff>(emptyNote);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    try {
      setNotes(readNotes(localStorage.getItem(storageKey)));
    } catch {
      setMessage(
        "Saved notes could not be read. You can still write and export a handoff.",
      );
    }
    setReady(true);
  }, []);
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
        "Browser storage is unavailable or full. Export your handoff to keep a copy.",
      );
      return false;
    }
  }
  function edit(key: keyof Handoff, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setMessage("");
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
                  if (persist(notes.filter((n) => n.id !== note.id))) {
                    if (draft.id === note.id) {
                      setDraft(emptyNote);
                      setDirty(false);
                    }
                    setMessage("Handoff deleted from this browser.");
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
            setMessage(
              "Handoff saved on this device. Nothing has been published.",
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
                setDraft(emptyNote);
                setDirty(false);
                setMessage("Notebook cleared from this browser.");
              }
            }}
          >
            Clear notebook
          </button>
        </div>
        <p className="form-help" role="status">
          {message ||
            (dirty
              ? "Unsaved changes — save on this device or export before leaving."
              : "Saving a handoff does not claim a task, submit a review, or authorize deployment.")}
        </p>
      </form>
    </section>
  );
}
