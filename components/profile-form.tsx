"use client";
import { useState, useTransition } from "react";
import { saveProfile, type ActionState } from "@/app/actions";
import type { Profile } from "@/lib/types";
export function ProfileForm({
  profile,
}: {
  profile: (Profile & { is_public: boolean }) | null;
}) {
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  return (
    <form
      className="form-card form-shell"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () =>
          setState(
            await saveProfile({
              ...Object.fromEntries(f),
              is_public: f.get("is_public") === "on",
            }),
          ),
        );
      }}
    >
      <h2>Your contributor profile</h2>
      <p className="form-help">
        Choose how much to share. Your email is private. Public profiles show
        contribution history, not popularity scores.
      </p>
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
              maxLength={key.includes("url") ? 2000 : 100}
            />
          )}
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
      {(state.error || state.message) && (
        <div className={`notice ${state.error ? "error" : ""}`} role="status">
          {state.error || state.message}
        </div>
      )}
    </form>
  );
}
