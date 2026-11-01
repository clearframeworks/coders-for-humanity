"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { claimTask, type ActionState } from "@/app/actions";
export function ClaimButton({
  id,
  demo,
  status,
  authenticated,
}: {
  id: string;
  demo: boolean;
  status: string;
  authenticated: boolean;
}) {
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  return (
    <>
      {demo ? (
        <div className="notice">
          This is an example task. It cannot be claimed.{" "}
          <Link href="/docs/contributor-guide">
            Learn how contributing will work.
          </Link>
        </div>
      ) : (
        <>
          {!authenticated && status === "OPEN" ? <Link className="button primary" href={`/login?next=${encodeURIComponent("/work/" + id)}`}>Sign in to claim this task</Link> :
          <button
            className="button primary"
            disabled={pending || status !== "OPEN" || !!state.message}
            onClick={() => start(async () => setState(await claimTask(id)))}
          >
            {pending
              ? "Claiming…"
              : state.message
                ? "Claimed"
                : status === "OPEN"
                  ? "Claim this task"
                  : "Task unavailable"}
          </button>}
          {state.message && <p><Link className="button" href="/workspace">Open my workspace →</Link></p>}
          <p className="form-help">
            A signed-in contributor profile is required.{" "}
            <Link href={`/login?next=${encodeURIComponent("/work/" + id)}`}>
              Sign in
            </Link>{" "}
            or <Link href="/account">manage your profile</Link>.
          </p>
        </>
      )}
      {(state.error || state.message) && (
        <div role="status" className={`notice ${state.error ? "error" : ""}`}>
          {state.error || state.message}
        </div>
      )}
    </>
  );
}
