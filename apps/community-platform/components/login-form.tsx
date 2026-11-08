"use client";
import { useActionState, useState } from "react";
import { signIn } from "@/app/actions";
export function LoginForm({
  next,
  disabled,
  intent = "signin",
  githubEnabled = false,
}: {
  next: string;
  disabled: boolean;
  intent?: "signin" | "signup";
  githubEnabled?: boolean;
}) {
  const [state, action, pending] = useActionState(signIn, {});
  const [remember, setRemember] = useState(false);
  return (
    <form action={action} className="auth-card">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="intent" value={intent} />
      {githubEnabled && <><button
        className="button primary"
        name="provider"
        value="github"
        formNoValidate
        disabled={disabled || pending}
      >
        Continue with GitHub ↗
      </button>
      <div className="auth-divider">OR USE YOUR EMAIL</div></>}
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
      <label className="checkbox-label">
        <input
          type="checkbox"
          name="remember"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          disabled={disabled}
          aria-describedby="remember-help"
        />
        Remember me on this device
      </label>
      <p className="form-help" id="remember-help">
        Leave this unchecked if you share this device.
      </p>
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
        Start here with your email, then open the link in the same browser to
        finish signing in. Your email address stays off your public profile.
      </p>
    </form>
  );
}
