"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { claimTask, type ActionState } from "@/app/actions";
export function ClaimButton({
  id,
  demo,
  status,
}: {
  id: string;
  demo: boolean;
  status: string;
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
          </button>
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
