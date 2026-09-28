"use client";
import Link from "next/link";
import { useState, useEffect, useRef, useTransition } from "react";
import { proposalSteps, proposalSchema } from "@/lib/validation";
import { submitProposal, type ActionState } from "@/app/actions";
type Draft = Record<string, string>;
const key = "cfh-proposal-draft-v1";
export function ProposalForm({
  demo,
  projects,
}: {
  demo: boolean;
  projects: { slug: string; name: string; summary: string }[];
}) {
  const [draft, setDraft] = useState<Draft>({});
  const [step, setStep] = useState(0);
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const [restored, setRestored] = useState(false);
  const focusTarget = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw);
        if (
          d &&
          typeof d === "object" &&
          Object.values(d).every((v) => typeof v === "string")
        ) {
          setDraft(d);
          setRestored(true);
        }
      }
    } catch {
      setState({ error: "The browser could not restore a saved draft." });
    }
  }, []);
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(draft));
      setState({
        message: "Draft saved in this browser only. It has not been submitted.",
      });
    } catch {
      setState({
        error:
          "The browser could not save this draft. Copy your text before leaving.",
      });
    }
  }
  function move(next: number) {
    setState({});
    setStep(next);
    setTimeout(() => focusTarget.current?.focus(), 0);
  }
  function next() {
    const field = proposalSteps[step][0];
    if (step === 0 && (draft.title?.trim().length || 0) < 8) {
      setState({
        error: "Give the proposal a title of at least 8 characters.",
      });
      return;
    }
    if (field !== "sources" && (draft[field]?.trim().length || 0) < 40) {
      setState({
        error:
          "Please give enough context: at least 40 characters for this section.",
      });
      return;
    }
    move(step + 1);
  }
  function submit() {
    const payload = {
      ...draft,
      sources: (draft.sources || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const parsed = proposalSchema.safeParse(payload);
    if (!parsed.success) {
      setState({
        error: parsed.error.issues
          .map((i) => `${String(i.path[0])}: ${i.message}`)
          .join(" "),
      });
      return;
    }
    if (demo) {
      save();
      setState({
        message:
          "Your proposal is complete and saved in this browser. This demonstration does not submit proposals to the institution.",
      });
      return;
    }
    start(async () => {
      const result = await submitProposal(payload);
      setState(result);
      if (result.id) {
        try {
          localStorage.removeItem(key);
        } catch {}
      }
    });
  }
  const words = (draft.title || "")
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
  const similar = projects.filter((p) =>
    words.some((w) => `${p.name} ${p.summary}`.toLowerCase().includes(w)),
  );
  return (
    <div className="form-shell">
      <div className="notice">
        {demo
          ? "Demonstration mode: explore every section and save a private browser draft. Shared submission is unavailable until accounts are connected."
          : "Submitting requires a signed-in contributor profile. Drafts are saved only when you choose Save draft."}{" "}
        Avoid private personal information in your proposal.
      </div>
      {restored && (
        <p className="form-help">Your saved browser draft has been restored.</p>
      )}
      <ol className="stepper" aria-label="Proposal steps">
        {proposalSteps.map(([, title], i) => (
          <li key={title}>
            <button
              type="button"
              onClick={() => move(i)}
              className={
                i === step
                  ? "current"
                  : draft[proposalSteps[i][0]]
                    ? "done"
                    : ""
              }
              aria-current={i === step ? "step" : undefined}
              aria-label={`${i + 1}. ${title}`}
            >
              {i + 1}
            </button>
          </li>
        ))}
      </ol>
      <div className="progress" aria-hidden="true">
        {proposalSteps.map((_, i) => (
          <span key={i} className={i <= step ? "filled" : ""} />
        ))}
      </div>
      <form
        className="form-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 10) next();
          else submit();
        }}
      >
        <div className="eyebrow">SECTION {step + 1} OF 11</div>
        <h2 tabIndex={-1} ref={focusTarget}>
          {proposalSteps[step][1]}
        </h2>
        <p className="form-help" id="step-help">
          {proposalSteps[step][2]}
        </p>
        {step === 0 && (
          <div className="field">
            <label htmlFor="proposal-title">Working title</label>
            <input
              id="proposal-title"
              value={draft.title || ""}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              maxLength={180}
              minLength={8}
              required
            />
            {similar.length > 0 && (
              <div className="duplicate-note">
                Related work already exists. Consider contributing evidence
                there before proposing another project.
                {similar.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/projects/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {p.name} — opens in a new tab ↗
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="field">
          <label htmlFor="proposal-section">
            {proposalSteps[step][1]}{" "}
            {step === 10
              ? "(one HTTPS URL per line)"
              : "(40–10,000 characters)"}
          </label>
          <textarea
            id="proposal-section"
            key={step}
            aria-describedby="step-help"
            value={draft[proposalSteps[step][0]] || ""}
            onChange={(e) =>
              setDraft({ ...draft, [proposalSteps[step][0]]: e.target.value })
            }
            maxLength={step === 10 ? 40000 : 10000}
            rows={8}
            required
          />
        </div>
        {step === 10 && (
          <p className="form-help">
            Review all eleven sections using the step buttons. Submission starts
            research review; it does not create an accepted project.
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="button" onClick={save}>
            Save draft
          </button>
          <div>
            {step > 0 && (
              <button
                className="button"
                type="button"
                onClick={() => move(step - 1)}
              >
                Back
              </button>
            )}
            <button
              className="button primary"
              type="submit"
              disabled={pending || !!state.id}
            >
              {pending
                ? "Submitting…"
                : state.id
                  ? "Submitted"
                  : step < 10
                    ? "Next section →"
                    : demo
                      ? "Validate & save proposal"
                      : "Submit for research review"}
            </button>
          </div>
        </div>
        {(state.error || state.message) && (
          <div role="status" className={`notice ${state.error ? "error" : ""}`}>
            {state.error || state.message}
            {state.id && (
              <p>
                <Link href={`/proposals/${state.id}`}>
                  View your proposal ↗
                </Link>
              </p>
            )}
          </div>
        )}
      </form>
      <p className="form-help">
        Drafts stay on this device.{" "}
        <button
          className="text-link"
          type="button"
          onClick={() => {
            try {
              localStorage.removeItem(key);
              setState({
                message:
                  "The saved browser copy was removed. The text above is still available until you leave this page.",
              });
            } catch {
              setState({ error: "The saved draft could not be removed." });
            }
          }}
        >
          Remove saved browser copy
        </button>
      </p>
    </div>
  );
}
