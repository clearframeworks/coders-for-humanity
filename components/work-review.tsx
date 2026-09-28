"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewWork, updateWork } from "@/app/community-actions";
import type { ActionState } from "@/app/actions";

export function WorkReview({
  taskId,
  version,
  approved,
}: {
  taskId: string;
  version: number;
  approved: boolean;
}) {
  const [body, setBody] = useState("");
  const [outcome, setOutcome] = useState("CHANGES REQUESTED");
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="hub-stack">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            const result = await reviewWork(taskId, outcome, body, version);
            setState(result);
            if (!result.error) {
              setBody("");
              router.refresh();
            }
          });
        }}
      >
        <div className="field">
          <label htmlFor={`review-body-${taskId}`}>
            Review evidence and findings
          </label>
          <textarea
            id={`review-body-${taskId}`}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
            minLength={20}
            maxLength={5000}
            rows={5}
            placeholder="Record what you checked, link the exact commit or artifact, and explain any remaining risks."
          />
        </div>
        <div className="field">
          <label htmlFor={`review-outcome-${taskId}`}>
            Outcome for submission {version}
          </label>
          <select
            id={`review-outcome-${taskId}`}
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
          >
            <option value="CHANGES REQUESTED">Request changes</option>
            <option value="APPROVED">Approve this submission</option>
          </select>
        </div>
        <button className="button primary" disabled={pending}>
          {pending ? "Recording…" : "Record independent review"}
        </button>
      </form>
      {approved && (
        <div className="notice">
          <p>
            You approved this submission. Accept it only when its deliverable
            meets the task’s acceptance criteria.
          </p>
          <button
            className="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await updateWork(
                  taskId,
                  "COMPLETE",
                  undefined,
                  version,
                );
                setState(result);
                if (!result.error) router.refresh();
              })
            }
          >
            {pending ? "Updating…" : "Accept completed task"}
          </button>
        </div>
      )}
      <p className="form-help">
        Task acceptance is not permission to merge or deploy. Repository checks,
        security review, and release authorization remain separate. A changed
        submission requires a new review.
      </p>
      {(state.error || state.message) && (
        <p className={state.error ? "notice error" : "notice"} role="status">
          {state.error || state.message}
        </p>
      )}
    </div>
  );
}
