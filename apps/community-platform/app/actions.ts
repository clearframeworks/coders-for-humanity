"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, configured, isDemo, githubAuthEnabled } from "@/lib/supabase";
import { proposalSchema, profileSchema } from "@/lib/validation";
import { safeNext } from "@/lib/filters";
export type ActionState = { error?: string; message?: string; id?: string; field?: string };
function siteUrl() {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) throw new Error("The site URL is not configured.");
  return new URL(url).origin;
}
async function checkOrigin() {
  const h = await headers();
  if (h.get("origin") !== siteUrl())
    throw new Error(
      "The request origin does not match this site. Please reload the page.",
    );
}
async function member() {
  if (isDemo() || !configured())
    throw new Error(
      "Member accounts are not connected yet. Shared changes are unavailable until identity and permissions are verified.",
    );
  await checkOrigin();
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error("Sign in to continue.");
  return { db, user };
}
function message(e: unknown) {
  return e instanceof Error
    ? e.message
    : "The request could not be completed. Please try again.";
}
export async function submitProposal(payload: unknown): Promise<ActionState> {
  try {
    const parsed = proposalSchema.safeParse(payload);
    if (!parsed.success)
      return {
        error: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(" "),
      };
    const { db } = await member();
    const { data, error } = await db.rpc("submit_proposal", {
      payload: parsed.data,
    });
    if (error)
      return {
        error:
          error.code === "23505"
            ? "You already submitted a proposal with this title. Review it in your account."
            : "The proposal could not be submitted. Check your profile, source URLs, and whether the project already exists. Submission is limited to five per hour.",
      };
    revalidatePath("/account");
    return {
      id: data,
      message:
        "Proposal submitted for research review. This does not approve it as a project.",
    };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function claimTask(taskId: string): Promise<ActionState> {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(taskId))
      return { error: "Example tasks cannot be claimed." };
    const { db } = await member();
    const { error } = await db.rpc("claim_task", { task_id_input: taskId });
    if (error)
      return {
        error:
          "This task could not be claimed. It may already be assigned, have an unfinished dependency, or require a contributor profile. Try again after checking the task.",
      };
    revalidatePath("/work");
    revalidatePath("/contribute");
    revalidatePath(`/work/${taskId}`);
    return {
      message:
        "The task is assigned to you. Follow its acceptance criteria and arrange review with the maintainer.",
    };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function saveProfile(payload: unknown): Promise<ActionState> {
  try {
    const parsed = profileSchema.safeParse(payload);
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] || "");
      const guidance: Record<string, string> = {
        username: "Choose a username with 3–40 lowercase letters, numbers, or hyphens. Start with a letter or number.",
        name: "Add a display name of up to 100 characters.",
        bio: "Keep your introduction under 2,000 characters.",
        location: "Keep your location under 100 characters.",
        availability: "Keep your availability under 100 characters.",
        github_url: "Use a GitHub profile address such as https://github.com/your-name.",
        website_url: "Use a complete HTTPS website address, or leave this field blank.",
      };
      return { error: guidance[field] || "Check your profile fields and try again.", field };
    }
    const data = parsed.data;
    const { db, user } = await member();
    const values = {
      ...data,
      github_url: data.github_url || null,
      website_url: data.website_url || null,
    };
    const existing = await db
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (existing.error) return { error: "Your profile could not be loaded." };
    const mutation = existing.data
      ? db.from("profiles").update(values).eq("id", user.id)
      : db.from("profiles").insert({ id: user.id, ...values });
    const { data: saved, error } = await mutation
      .select("id,username,is_public")
      .single();
    if (error)
      return {
        field: error.code === "23505" ? "username" : undefined,
        error:
          error.code === "23505"
            ? "That username is already in use."
            : "Your profile could not be saved. Please check the fields.",
      };
    if (!saved || saved.id !== user.id || saved.username !== data.username || saved.is_public !== data.is_public)
      return { error: "Your profile save could not be confirmed. Reload your account before trying again." };
    revalidatePath("/account");
    revalidatePath(`/people/${data.username}`);
    revalidatePath("/people");
    return { message: "Profile saved." };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function signIn(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (isDemo() || !configured())
    return {
      error:
        "Member accounts are not connected yet. Your draft has not been published.",
    };
  let destination: string | undefined;
  try {
    await checkOrigin();
    const db = await createClient();
    const next = safeNext(String(form.get("next") || ""));
    const callback = `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
    if (form.get("provider") === "github") {
      if (!githubAuthEnabled())
        return { error: "GitHub sign-in is unavailable. Use your email to continue." };
      const { data, error } = await db.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: callback, scopes: "read:user" },
      });
      if (error)
        return { error: "GitHub sign-in could not start. Please try again." };
      destination = data.url;
    } else {
      const email = String(form.get("email") || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
        return { error: "Enter a valid email address." };
      const { error } = await db.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: callback,
          shouldCreateUser: form.get("intent") === "signup",
        },
      });
      if (error)
        return {
          error: error.code === "otp_disabled"
            ? "This email could not sign in. If you are new here, choose Create your profile to register."
            : error.code === "over_email_send_rate_limit"
              ? "Too many email requests. Wait a few minutes before requesting another link."
              : "A sign-in email could not be sent. Please wait a moment and try again.",
        };
      return {
        message:
          "Check your email for a sign-in link. It will return you to this site.",
      };
    }
  } catch (e) {
    return { error: message(e) };
  }
  if (destination) redirect(destination);
  return {};
}
export async function signOut() {
  await checkOrigin();
  const db = await createClient();
  await db.auth.signOut();
  redirect("/");
}
