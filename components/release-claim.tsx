"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { releaseTaskClaim } from "@/app/task-actions";
import type { ActionState } from "@/app/actions";

export function ReleaseClaim({ id }: { id: string }) {
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  return <details className="hub-panel"><summary>Need to hand this task back?</summary>
    <form className="hub-stack" onSubmit={(event) => {
      event.preventDefault();
      const handoff = String(new FormData(event.currentTarget).get("handoff") || "");
      start(async () => {
        const result = await releaseTaskClaim({ task_id: id, handoff });
        setState(result);
        if (!result.error) router.refresh();
      });
    }}>
      <div className="field"><label htmlFor={`handoff-${id}`}>Public handoff for the next contributor</label>
        <textarea id={`handoff-${id}`} name="handoff" minLength={20} maxLength={5000} rows={4} required disabled={pending} placeholder="What you tried, links to useful work, and what remains. Do not include secrets or private information." /></div>
      <button className="button" disabled={pending}>{pending ? "Saving handoff…" : "Save handoff and release claim"}</button>
      {(state.error || state.message) && <p role="status" className={state.error ? "notice error" : "notice"}>{state.error || state.message}</p>}
    </form>
  </details>;
}
