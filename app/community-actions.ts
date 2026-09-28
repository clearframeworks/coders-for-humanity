"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { communityReady } from "@/lib/community";
import type { ActionState } from "./actions";
const uuid = z.uuid();
async function authorize() {
  if (!communityReady())
    throw new Error("The community database is not connected yet.");
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin || h.get("origin") !== new URL(origin).origin)
    throw new Error("Please reload this site before trying again.");
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error("Sign in to participate.");
  return db;
}
function failure(e: unknown): ActionState {
  return {
    error:
      e instanceof z.ZodError
        ? "Check the fields and try again."
        : e instanceof Error
          ? e.message
          : "The action could not be completed.",
  };
}
export async function publishPost(payload: unknown): Promise<ActionState> {
  try {
    const p = z
      .object({
        title: z.string().max(160),
        body: z.string().trim().min(1).max(12000),
        kind: z.enum(["discussion", "question", "update"]),
        project_id: uuid.nullable(),
        parent_id: uuid.nullable(),
      })
      .parse(payload);
    if (!p.parent_id && p.title.trim().length < 4)
      return {
        error: "Give the conversation a title of at least four characters.",
      };
    const db = await authorize();
    const { data, error } = await db.rpc("publish_post", {
      title_input: p.title,
      body_input: p.body,
      kind_input: p.kind,
      project_input: p.project_id,
      parent_input: p.parent_id,
    });
    if (error)
      return {
        error:
          "Your post could not be published. A public contributor profile is required. Posting is limited to 20 per hour.",
      };
    revalidatePath("/");
    revalidatePath("/discussions");
    if (p.parent_id) revalidatePath(`/discussions/${p.parent_id}`);
    return {
      id: data,
      message: p.parent_id ? "Reply published." : "Conversation published.",
    };
  } catch (e) {
    return failure(e);
  }
}
export async function savePost(
  id: string,
  saved: boolean,
): Promise<ActionState> {
  try {
    uuid.parse(id);
    z.boolean().parse(saved);
    const db = await authorize();
    const { error } = await db.rpc("save_post", {
      post_input: id,
      saved_input: saved,
    });
    if (error) return { error: "Could not update saved posts." };
    revalidatePath("/workspace");
    return {
      message: saved ? "Saved to your workspace." : "Removed from saved posts.",
    };
  } catch (e) {
    return failure(e);
  }
}
export async function joinProject(id: string): Promise<ActionState> {
  try {
    uuid.parse(id);
    const db = await authorize();
    const { error } = await db.rpc("join_project", { project_input: id });
    if (error)
      return {
        error:
          "Create a public contributor profile before joining this project.",
      };
    revalidatePath("/workspace");
    revalidatePath("/projects");
    return { message: "You joined the project." };
  } catch (e) {
    return failure(e);
  }
}
export async function updateWork(
  id: string,
  status: string,
  evidence?: string,
  version?: number,
): Promise<ActionState> {
  try {
    uuid.parse(id);
    z.enum(["IN PROGRESS", "REVIEW", "BLOCKED", "COMPLETE"]).parse(status);
    if (status === "REVIEW")
      z.url()
        .max(2000)
        .refine((v) => v.startsWith("https://"))
        .parse(evidence);
    if (status === "COMPLETE") z.number().int().positive().parse(version);
    const db = await authorize();
    const { error } = await db.rpc("update_work", {
      task_input: id,
      status_input: status,
      evidence_input: evidence ?? null,
      version_input: version ?? null,
    });
    if (error)
      return {
        error:
          "This transition requires the assigned contributor or an independent maintainer review. Submitting for review requires an HTTPS evidence link.",
      };
    revalidatePath("/workspace");
    revalidatePath("/reviews");
    revalidatePath("/work");
    revalidatePath(`/work/${id}`);
    return { message: "Work status updated." };
  } catch (e) {
    return failure(e);
  }
}
export async function reviewWork(
  id: string,
  outcome: string,
  body: string,
  version: number,
): Promise<ActionState> {
  try {
    uuid.parse(id);
    z.enum(["APPROVED", "CHANGES REQUESTED"]).parse(outcome);
    z.string().trim().min(20).max(5000).parse(body);
    z.number().int().positive().parse(version);
    const db = await authorize();
    const { error } = await db.rpc("review_work", {
      task_input: id,
      outcome_input: outcome,
      body_input: body,
      version_input: version,
    });
    if (error)
      return {
        error:
          "Only an independent project maintainer can review the current submission. Reload if the submission has changed.",
      };
    revalidatePath("/workspace");
    revalidatePath("/reviews");
    revalidatePath("/work");
    revalidatePath(`/work/${id}`);
    return { message: "Review recorded against this submission." };
  } catch (e) {
    return failure(e);
  }
}
export async function readNotifications(): Promise<ActionState> {
  try {
    const db = await authorize();
    const { error } = await db.rpc("read_notifications");
    if (error) return { error: "Could not mark notifications as read." };
    revalidatePath("/inbox");
    return { message: "Notifications marked as read." };
  } catch (e) {
    return failure(e);
  }
}
