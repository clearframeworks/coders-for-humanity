"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  publishPost,
  savePost,
  joinProject,
  updateWork,
  readNotifications,
} from "@/app/community-actions";
import type { ActionState } from "@/app/actions";

export function CommunityComposer({
  enabled,
  projectId = null,
  parentId = null,
  projects = [],
}: {
  enabled: boolean;
  projectId?: string | null;
  parentId?: string | null;
  projects?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("discussion");
  const [project, setProject] = useState(projectId || "");
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const draftKey = `cfh-conversation-draft:${parentId || projectId || "commons"}`;
  const projectOptions = projects.map((p) => p.id).join(",");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw && raw.length <= 60000) {
        const draft: unknown = JSON.parse(raw);
        if (
          draft &&
          typeof draft === "object" &&
          "version" in draft &&
          draft.version === 1 &&
          "title" in draft &&
          typeof draft.title === "string" &&
          "body" in draft &&
          typeof draft.body === "string" &&
          "kind" in draft &&
          typeof draft.kind === "string" &&
          ["discussion", "question", "update"].includes(draft.kind) &&
          "project" in draft &&
          typeof draft.project === "string"
        ) {
          setTitle(draft.title.slice(0, 160));
          setBody(draft.body.slice(0, 12000));
          setKind(draft.kind);
          setProject(
            draft.project === projectId ||
              projectOptions.split(",").includes(draft.project)
              ? draft.project
              : projectId || "",
          );
        }
      }
    } catch {
      /* Browser storage is optional. */
    }
    setLoaded(true);
  }, [draftKey, projectId, projectOptions]);
  useEffect(() => {
    if (!loaded) return;
    try {
      if (
        title ||
        body ||
        kind !== "discussion" ||
        project !== (projectId || "")
      ) {
        localStorage.setItem(
          draftKey,
          JSON.stringify({ version: 1, title, body, kind, project }),
        );
        setSaved(true);
      } else {
        localStorage.removeItem(draftKey);
        setSaved(false);
      }
    } catch {
      setSaved(false);
    }
  }, [title, body, kind, project, projectId, draftKey, loaded]);
  const githubUrl = `https://github.com/clearframeworks/coders-for-humanity/issues/new?${new URLSearchParams({ title: title.slice(0, 160), body: body.slice(0, 6000) })}`;
  return (
    <form
      className="form-card form-shell"
      onSubmit={(e) => {
        e.preventDefault();
        if (!enabled) return;
        start(async () => {
          const result = await publishPost({
            title,
            body,
            kind,
            project_id: project || null,
            parent_id: parentId,
          });
          setState(result);
          if (result.id) {
            try {
              localStorage.removeItem(draftKey);
            } catch {}
            setTitle("");
            setBody("");
            setKind("discussion");
            setProject(projectId || "");
            if (!parentId) router.push(`/discussions/${result.id}`);
            router.refresh();
          }
        });
      }}
    >
      {!parentId && (
        <>
          <div className="field">
            <label htmlFor="conversation-title">Conversation title</label>
            <input
              id="conversation-title"
              required
              minLength={4}
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you want to work through together?"
            />
          </div>
          <div className="hub-grid">
            <div className="field">
              <label htmlFor="conversation-kind">Type</label>
              <select
                id="conversation-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="discussion">Discussion</option>
                <option value="question">Question</option>
                <option value="update">Progress update</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="conversation-project">Space</label>
              <select
                id="conversation-project"
                value={project}
                onChange={(e) => setProject(e.target.value)}
              >
                <option value="">Community commons</option>
                {projects.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}
      <div className="field">
        <label htmlFor="conversation-body">
          {parentId ? "Your reply" : "Context and invitation"}
        </label>
        <textarea
          id="conversation-body"
          required
          maxLength={12000}
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            parentId
              ? "Add evidence, a question, or a useful next step…"
              : "What is the problem? What have you tried? What help or feedback would be useful?"
          }
        />
      </div>
      <p className="form-help">
        Public conversation. Do not include credentials, personal data, or
        private vulnerability details.{" "}
        <Link href="/harness">
          Use the security reporting process for vulnerabilities.
        </Link>
      </p>
      <div className="form-actions">
        {enabled ? (
          <button className="button primary" disabled={pending}>
            {pending
              ? "Publishing…"
              : parentId
                ? "Publish reply"
                : "Publish conversation"}
          </button>
        ) : (
          <a className="button primary" href={githubUrl}>
            Continue draft on GitHub ↗
          </a>
        )}
        <button
          className="button"
          type="button"
          disabled={!title && !body && !saved}
          onClick={() => {
            setTitle("");
            setBody("");
            setKind("discussion");
            setProject(projectId || "");
            try {
              localStorage.removeItem(draftKey);
              setState({ message: "Draft cleared from this browser." });
            } catch {
              setState({
                error:
                  "The editor is clear, but browser storage could not be accessed. Clear this site's storage before leaving a shared device.",
              });
            }
          }}
        >
          Clear draft
        </button>
      </div>
      <p className="form-help" role="status">
        {saved
          ? "Draft saved in this browser only. Clear it when using a shared device."
          : "Drafts stay on this device when browser storage is available."}
        {!enabled &&
          " Nothing has been published. GitHub will ask you to review and submit your draft."}
      </p>
      {(state.error || state.message) && (
        <div className={`notice ${state.error ? "error" : ""}`} role="status">
          {state.error || state.message}
        </div>
      )}
    </form>
  );
}

export function CommunityAction({
  action,
  id,
  status,
  saved,
  children,
}: {
  action: "save" | "join" | "work" | "read";
  id?: string;
  status?: string;
  saved?: boolean;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div>
      <button
        className="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result =
              action === "read"
                ? await readNotifications()
                : action === "save"
                  ? await savePost(id!, !!saved)
                  : action === "join"
                    ? await joinProject(id!)
                    : await updateWork(id!, status!);
            setState(result);
            if (!result.error) router.refresh();
          })
        }
      >
        {pending ? "Updating…" : children}
      </button>
      {(state.error || state.message) && (
        <p className="form-help" role="status">
          {state.error || state.message}
        </p>
      )}
    </div>
  );
}

export function WorkProgress({
  id,
  status,
  evidence: initialEvidence,
}: {
  id: string;
  status: string;
  evidence: string;
}) {
  const [nextStatus, setNextStatus] = useState(
    status === "CLAIMED"
      ? "IN PROGRESS"
      : status === "BLOCKED"
        ? "IN PROGRESS"
        : "REVIEW",
  );
  const [evidence, setEvidence] = useState(initialEvidence);
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => {
    setNextStatus(
      status === "CLAIMED" || status === "BLOCKED" ? "IN PROGRESS" : "REVIEW",
    );
  }, [status]);
  if (status === "COMPLETE")
    return (
      <p>Accepted work. Keep its evidence available for future contributors.</p>
    );
  if (status === "REVIEW")
    return (
      <p>
        Your submission is awaiting an independent maintainer’s review. Task
        acceptance does not grant permission to deploy.
      </p>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await updateWork(id, nextStatus, evidence);
          setState(result);
          if (!result.error) router.refresh();
        });
      }}
    >
      <div className="field">
        <label htmlFor={`status-${id}`}>Progress</label>
        <select
          id={`status-${id}`}
          value={nextStatus}
          onChange={(e) => setNextStatus(e.target.value)}
        >
          {(status === "CLAIMED" || status === "BLOCKED") && (
            <option value="IN PROGRESS">Working on it</option>
          )}
          {status !== "BLOCKED" && (
            <option value="BLOCKED">Blocked — need help</option>
          )}
          {status === "IN PROGRESS" && (
            <option value="REVIEW">Ready for independent review</option>
          )}
        </select>
      </div>
      {nextStatus === "REVIEW" && (
        <div className="field">
          <label htmlFor={`evidence-${id}`}>Evidence / pull request URL</label>
          <input
            id={`evidence-${id}`}
            type="url"
            pattern="https://.*"
            required
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="https://github.com/…/pull/…"
          />
          <p className="form-help">
            Link the deliverable and verification results. An independent
            maintainer must review this submission before acceptance.
          </p>
        </div>
      )}
      <button className="button" disabled={pending}>
        {pending ? "Updating…" : "Update progress"}
      </button>
      {(state.error || state.message) && (
        <p role="status">{state.error || state.message}</p>
      )}
    </form>
  );
}
