"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase";
import { communityReady } from "@/lib/community";
import { releaseClaimSchema, taskBriefSchema } from "@/lib/task-development";
import type { ActionState } from "./actions";

async function taskClient() {
  if (!communityReady()) throw new Error("Shared work is not connected yet.");
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin || (await headers()).get("origin") !== new URL(origin).origin)
    throw new Error("Reload this site before trying again.");
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new Error("Sign in to continue.");
  return db;
}

export async function createTaskBrief(payload: unknown): Promise<ActionState> {
  const parsed = taskBriefSchema.safeParse(payload);
  if (!parsed.success) return { error: "Complete the brief, reviewer, and acceptance criteria." };
  try {
    const db = await taskClient();
    const { data, error } = await db.rpc("create_task_brief", { payload: parsed.data });
    if (error) return { error: "Only a project maintainer can publish work. Check the active project, reviewer, and dependencies." };
    revalidatePath("/work");
    revalidatePath("/contribute");
    revalidatePath("/projects", "layout");
    return { id: data, message: "Task published and available on the work board." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The task could not be published." };
  }
}

export async function releaseTaskClaim(payload: unknown): Promise<ActionState> {
  const parsed = releaseClaimSchema.safeParse(payload);
  if (!parsed.success) return { error: "Leave a handoff of 20–5,000 characters for the next contributor." };
  try {
    const db = await taskClient();
    const { error } = await db.rpc("release_task_claim", {
      task_input: parsed.data.task_id,
      handoff_input: parsed.data.handoff,
    });
    if (error) return { error: "Only the assigned contributor can release work that is claimed, in progress, or blocked. Reload to check its current status." };
    for (const path of ["/work", "/contribute", "/workspace", `/work/${parsed.data.task_id}`]) revalidatePath(path);
    return { message: "Handoff saved. This task is open for another contributor." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Your claim could not be released." };
  }
}
