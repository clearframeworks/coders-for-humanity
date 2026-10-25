"use client";
import { useActionState } from "react";
import { signIn } from "@/app/actions";
export function LoginForm({
  next,
  disabled,
  intent = "signin",
}: {
  next: string;
  disabled: boolean;
  intent?: "signin" | "signup";
}) {
  const [state, action, pending] = useActionState(signIn, {});
  return (
    <form action={action} className="auth-card">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="intent" value={intent} />
      <button
        className="button primary"
        name="provider"
        value="github"
        formNoValidate
        disabled={disabled || pending}
      >
        Continue with GitHub ↗
      </button>
      <div className="auth-divider">OR USE YOUR EMAIL</div>
      <div className="field">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={disabled}
          placeholder="you@example.org"
          maxLength={254}
        />
      </div>
      <button
        className="button"
        name="provider"
        value="email"
        disabled={disabled || pending}
      >
        {pending
          ? "Connecting…"
          : intent === "signup"
            ? "Send a verification link"
            : "Send a sign-in link"}
      </button>
      {(state.error || state.message) && (
        <div role="status" className={`notice ${state.error ? "error" : ""}`}>
          {state.error || state.message}
        </div>
      )}
      <p className="form-help">
        No password to remember. Your email address is never included in your
        public profile.
      </p>
    </form>
  );
}
