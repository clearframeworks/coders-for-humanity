"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveProfile, type ActionState } from "@/app/actions";
import type { Profile } from "@/lib/types";
export function ProfileForm({
  profile,
}: {
  profile: (Profile & { is_public: boolean }) | null;
}) {
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const submitting = useRef(false);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state.error) feedback.current?.focus(); }, [state]);
  return (
    <form
      className="form-card form-shell"
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        if (submitting.current) return;
        const f = new FormData(e.currentTarget);
        submitting.current = true;
        start(async () => {
          try {
            const result = await saveProfile({
              ...Object.fromEntries(f),
              is_public: f.get("is_public") === "on",
            });
            setState(result);
          } catch {
            setState({ error: "Your profile could not be saved. Your edits are still here; try again." });
          } finally { submitting.current = false; }
        });
      }}
    >
      <h2>Your contributor profile</h2>
      <p className="form-help">
        Choose how much to share. Your email is private. Public profiles show
        contribution history, not popularity scores.
      </p>
      <fieldset className="profile-fields" disabled={pending}>
      {[
        ["username", "Username", profile?.username || ""],
        ["name", "Display name", profile?.name || ""],
        ["bio", "Bio", profile?.bio || ""],
        [
          "location",
          "Location (optional; choose your own granularity)",
          profile?.location || "",
        ],
        ["availability", "Availability", profile?.availability || ""],
        [
          "github_url",
          "GitHub profile URL (optional)",
          profile?.github_url || "",
        ],
        [
          "website_url",
          "Website URL (optional, HTTPS)",
          profile?.website_url || "",
        ],
      ].map(([key, label, value]) => (
        <div className="field" key={key}>
          <label htmlFor={key}>{label}</label>
          {key === "bio" ? (
            <textarea
              id={key}
              name={key}
              defaultValue={value}
              maxLength={2000}
            />
          ) : (
            <input
              id={key}
              name={key}
              defaultValue={value}
              required={key === "username" || key === "name"}
              maxLength={key === "username" ? 40 : key.includes("url") ? 2000 : 100}
              minLength={key === "username" ? 3 : undefined}
              pattern={key === "username" ? "[a-z0-9][a-z0-9-]{2,39}" : undefined}
              type={key.includes("url") ? "url" : "text"}
              autoComplete={key === "name" ? "name" : key === "username" ? "username" : "off"}
              autoCapitalize={key === "username" ? "none" : undefined}
              spellCheck={key === "username" ? false : undefined}
              aria-invalid={state.field === key || undefined}
              aria-describedby={state.field === key ? "profile-feedback" : key === "username" ? "profile-username-help" : undefined}
            />
          )}
          {key === "username" && <p className="form-help" id="profile-username-help">3–40 lowercase letters, numbers, or hyphens. This becomes your profile address.</p>}
        </div>
      ))}
      <label className="checkbox-label">
        <input
          type="checkbox"
          name="is_public"
          defaultChecked={profile?.is_public}
        />
        Publish my profile on the public contributor directory
      </label>
      <div className="form-actions">
        <button className="button primary" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
      </fieldset>
      {(state.error || state.message) && (
        <div id="profile-feedback" ref={feedback} tabIndex={-1} className={`notice ${state.error ? "error" : ""}`} role={state.error ? "alert" : "status"}>
          {state.error || state.message}
        </div>
      )}
    </form>
  );
}
