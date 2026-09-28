"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, MapPin, Clock3 } from "lucide-react";
import { saveProfile } from "@/app/actions";
import { profileSchema } from "@/lib/validation";
import {
  emptyProfile,
  profileDraftKey,
  readProfileDraft,
  type ProfileDraft,
} from "@/lib/profile-draft";
import { EditorialPhoto } from "./editorial-photo";
import { LoginForm } from "./login-form";

const steps = ["Introduce yourself", "Your contribution", "Review & join"];
export function ProfileOnboarding({
  connected,
  authenticated,
}: {
  connected: boolean;
  authenticated: boolean;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileDraft>(emptyProfile);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [storageNote, setStorageNote] = useState(
    "Nothing is published until you verify your account and create your profile.",
  );
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const draft = readProfileDraft(localStorage.getItem(profileDraftKey));
      if (draft) {
        setProfile(draft.profile);
        // Never skip validation because local storage says a draft is complete.
        setStep(
          profileSchema.safeParse(draft.profile).success ? draft.step : 0,
        );
        setStorageNote(
          "Your unfinished profile was restored. It is saved only in this browser.",
        );
      }
    } catch {
      setStorageNote(
        "Browser storage is unavailable. Keep this tab open while you finish.",
      );
    }
    setReady(true);
  }, []);
  function persist(value: ProfileDraft, stage = step) {
    try {
      localStorage.setItem(
        profileDraftKey,
        JSON.stringify({ version: 1, profile: value, step: stage }),
      );
      setStorageNote(
        "Draft saved in this browser only. You can clear it below.",
      );
    } catch {
      setStorageNote(
        "Your draft could not be saved on this device. Keep this tab open.",
      );
    }
  }
  function update<K extends keyof ProfileDraft>(
    key: K,
    value: ProfileDraft[K],
  ) {
    const next = { ...profile, [key]: value };
    setProfile(next);
    setError("");
    persist(next);
  }
  function move(stage: number) {
    setStep(stage);
    setError("");
    persist(profile, stage);
    requestAnimationFrame(() => heading.current?.focus());
  }
  function showError(message: string) {
    setError(message);
    requestAnimationFrame(() => errorBox.current?.focus());
  }
  function advance() {
    const result = (
      step === 0
        ? profileSchema.pick({ name: true, username: true })
        : profileSchema
    ).safeParse(profile);
    if (!result.success) {
      const field = result.error.issues[0]?.path[0];
      showError(
        field === "github_url"
          ? "Use a GitHub profile address such as https://github.com/your-name."
          : field === "website_url"
            ? "Your website or portfolio needs a complete HTTPS address, such as https://example.org."
            : field === "name"
              ? "Add the name you’d like people to use."
              : field === "username"
                ? "Choose a username with 3–40 lowercase letters, numbers, or hyphens. Start with a letter or number."
                : "Check the length and format of your profile fields.",
      );
      return;
    }
    move(step + 1);
  }
  function clear() {
    try {
      localStorage.removeItem(profileDraftKey);
      setProfile(emptyProfile);
      setStep(0);
      setError("");
      setStorageNote("Draft cleared from this browser.");
      requestAnimationFrame(() => heading.current?.focus());
    } catch {
      showError(
        "Browser storage could not be cleared. Remove this site’s stored data in your browser settings.",
      );
    }
  }
  function publish() {
    const result = profileSchema.safeParse(profile);
    if (!result.success) {
      showError(
        "Please return to the previous steps and check your profile fields.",
      );
      return;
    }
    start(async () => {
      const result = await saveProfile(profile);
      if (result.error) {
        showError(result.error);
        return;
      }
      try {
        localStorage.removeItem(profileDraftKey);
      } catch {
        /* Server save succeeded. */
      }
      router.push(
        profile.is_public ? `/people/${profile.username}` : "/account",
      );
      router.refresh();
    });
  }
  const initials = profile.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0] || "")
    .join("")
    .toUpperCase();
  return (
    <div className="join-layout">
      <section className="onboarding-card" aria-label="Profile setup">
        <ol className="join-steps" aria-label="Profile setup progress">
          {steps.map((label, index) => (
            <li
              key={label}
              aria-current={step === index ? "step" : undefined}
              className={index <= step ? "reached" : ""}
            >
              <span>
                {index < step ? (
                  <Check size={14} aria-label="Completed" />
                ) : (
                  index + 1
                )}
              </span>
              <strong>{label}</strong>
            </li>
          ))}
        </ol>
        <div className="onboarding-body">
          <p className="step-counter">STEP {step + 1} OF 3</p>
          <h2 ref={heading} tabIndex={-1}>
            {steps[step]}
          </h2>
          <p className="step-description">
            {
              [
                "A name people can recognize. A username they can find.",
                "You don’t need to write code. Research, design, testing, organizing, and lived experience all belong here.",
                "Make sure this feels like you, then choose who can see it.",
              ][step]
            }
          </p>
          {error && (
            <div
              className="notice error"
              role="alert"
              ref={errorBox}
              tabIndex={-1}
            >
              {error}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (step < 2) advance();
              else if (authenticated && connected) publish();
            }}
          >
            <fieldset disabled={!ready || pending} className="profile-fields">
              {step === 0 && (
                <>
                  <div className="field">
                    <label htmlFor="profile-name">
                      Display name <span>(required)</span>
                    </label>
                    <input
                      id="profile-name"
                      autoComplete="name"
                      value={profile.name}
                      maxLength={100}
                      required
                      onChange={(e) => update("name", e.target.value)}
                      placeholder="The name you go by"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="profile-username">
                      Username <span>(required)</span>
                    </label>
                    <div className="username-input">
                      <span aria-hidden="true">@</span>
                      <input
                        id="profile-username"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={profile.username}
                        maxLength={40}
                        minLength={3}
                        pattern="[a-z0-9][a-z0-9-]{2,39}"
                        required
                        onChange={(e) => update("username", e.target.value)}
                        aria-describedby="username-help"
                        placeholder="your-name"
                      />
                    </div>
                    <p id="username-help" className="form-help">
                      3–40 lowercase letters, numbers, or hyphens. Availability
                      is checked when you create your profile.
                    </p>
                  </div>
                  <div className="field">
                    <label htmlFor="profile-location">
                      Location <span>(optional)</span>
                    </label>
                    <input
                      id="profile-location"
                      autoComplete="off"
                      value={profile.location}
                      maxLength={100}
                      onChange={(e) => update("location", e.target.value)}
                      placeholder="City, country, or time zone"
                    />
                    <p className="form-help">
                      Share only as much detail as you’re comfortable with.
                    </p>
                  </div>
                </>
              )}
              {step === 1 && (
                <>
                  <div className="field">
                    <label htmlFor="profile-bio">
                      What would you like to contribute?
                    </label>
                    <textarea
                      id="profile-bio"
                      value={profile.bio}
                      maxLength={2000}
                      rows={5}
                      onChange={(e) => update("bio", e.target.value)}
                      placeholder="Your experience, interests, and the kind of work you’d enjoy helping with."
                    />
                    <p className="form-help">
                      Optional. A few sentences are enough. {profile.bio.length}
                      /2,000
                    </p>
                  </div>
                  <div className="field">
                    <label htmlFor="profile-availability">
                      Availability <span>(optional)</span>
                    </label>
                    <input
                      id="profile-availability"
                      value={profile.availability}
                      maxLength={100}
                      onChange={(e) => update("availability", e.target.value)}
                      placeholder="For example: a few hours on weekends"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="profile-github">
                      GitHub profile <span>(optional)</span>
                    </label>
                    <input
                      id="profile-github"
                      type="url"
                      value={profile.github_url}
                      maxLength={2000}
                      onChange={(e) => update("github_url", e.target.value)}
                      placeholder="https://github.com/your-name"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="profile-website">
                      Website or portfolio <span>(optional)</span>
                    </label>
                    <input
                      id="profile-website"
                      type="url"
                      value={profile.website_url}
                      maxLength={2000}
                      onChange={(e) => update("website_url", e.target.value)}
                      placeholder="https://your-website.com"
                    />
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <div className="profile-review">
                    <strong>{profile.name}</strong>
                    <span>@{profile.username}</span>
                    <p>{profile.bio || "You can add an introduction later."}</p>
                    {profile.location && <p>Location: {profile.location}</p>}
                    {profile.availability && (
                      <p>Availability: {profile.availability}</p>
                    )}
                    {profile.github_url && <p>GitHub: {profile.github_url}</p>}
                    {profile.website_url && (
                      <p>Website: {profile.website_url}</p>
                    )}
                  </div>
                  <label className="profile-visibility">
                    <input
                      type="checkbox"
                      checked={profile.is_public}
                      onChange={(e) => update("is_public", e.target.checked)}
                    />
                    <span>
                      <strong>Show my profile in the People directory</strong>
                      <small>
                        Anyone can see your name, introduction, location,
                        availability, and links. Your email stays private.
                      </small>
                    </span>
                  </label>
                  <p className="form-help">
                    Unchecked keeps your contributor profile private. Creating a
                    profile does not grant review or release permissions.
                  </p>
                </>
              )}
              <div className="join-controls">
                {step > 0 && (
                  <button
                    className="button"
                    type="button"
                    onClick={() => move(step - 1)}
                  >
                    Back
                  </button>
                )}
                {step < 2 && (
                  <button className="button primary" type="submit">
                    {step === 0 ? "Continue" : "Preview profile"}
                    <ArrowRight size={16} />
                  </button>
                )}
                {step === 2 && connected && authenticated && (
                  <button className="button primary" type="submit">
                    {pending ? "Creating profile…" : "Create profile"}
                  </button>
                )}
              </div>
            </fieldset>
          </form>
          {step === 2 && connected && !authenticated && (
            <div className="join-auth">
              <h3>Verify your account to finish</h3>
              <p>
                Your draft stays in this browser. After verification, review it
                here and choose Create profile.
              </p>
              <LoginForm next="/join" disabled={false} intent="signup" />
            </div>
          )}
          {step === 2 && !connected && (
            <div className="join-unavailable" role="status">
              <h3>Your draft is ready. Registration isn’t open yet.</h3>
              <p>
                Member accounts are not connected yet. Your profile has not been
                created or published. This draft stays in this browser for you
                to finish when registration opens.
              </p>
              <Link className="button" href="/contribute">
                Explore open work <ArrowRight size={16} />
              </Link>
            </div>
          )}
          <div className="draft-status">
            <p role="status">{storageNote}</p>
            <button type="button" onClick={clear} disabled={!ready || pending}>
              Clear draft
            </button>
          </div>
        </div>
      </section>
      <aside className="profile-preview" aria-label="Live profile preview">
        <EditorialPhoto
          name="workshop"
          className="profile-preview-photo"
          priority
          sizes="(max-width: 850px) 100vw, 360px"
        />
        <div className="profile-preview-body">
          <span className="preview-label">YOUR PROFILE PREVIEW</span>
          <div className="profile-initials" aria-hidden="true">
            {initials || "You"}
          </div>
          <h2>{profile.name.trim() || "Your name here"}</h2>
          <p className="preview-username">
            @{profile.username || "your-username"}
          </p>
          <p className="preview-bio">
            {profile.bio || "A little about you and the work you care about."}
          </p>
          {profile.location && (
            <p className="preview-detail">
              <MapPin size={15} />
              {profile.location}
            </p>
          )}
          {profile.availability && (
            <p className="preview-detail">
              <Clock3 size={15} />
              {profile.availability}
            </p>
          )}
          <span className="privacy-label">
            {profile.is_public
              ? "Public after you create it"
              : "Private by default"}
          </span>
        </div>
        <div className="profile-preview-note">
          You choose what to share.
          <br />
          Your profile can grow with your contributions.
        </div>
      </aside>
    </div>
  );
}
