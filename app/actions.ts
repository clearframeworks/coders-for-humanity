"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, configured, isDemo } from "@/lib/supabase";
import { proposalSchema, profileSchema } from "@/lib/validation";
import { safeNext } from "@/lib/filters";
export type ActionState = { error?: string; message?: string; id?: string };
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
    const data = profileSchema.parse(payload);
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
    const { error } = existing.data
      ? await db.from("profiles").update(values).eq("id", user.id)
      : await db.from("profiles").insert({ id: user.id, ...values });
    if (error)
      return {
        error:
          error.code === "23505"
            ? "That username is already in use."
            : "Your profile could not be saved. Please check the fields.",
      };
    revalidatePath("/account");
    revalidatePath(`/people/${data.username}`);
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
    return { error: "Account access is not connected in this demonstration." };
  let destination: string | undefined;
  try {
    await checkOrigin();
    const db = await createClient();
    const next = safeNext(String(form.get("next") || ""));
    const callback = `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
    if (form.get("provider") === "github") {
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
        options: { emailRedirectTo: callback },
      });
      if (error)
        return {
          error:
            "A sign-in email could not be sent. Please wait a moment and try again.",
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
