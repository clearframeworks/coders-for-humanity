import { z } from "zod";
import { disciplines, efforts, levels } from "./types";

export const taskBriefSchema = z.object({
  project_id: z.uuid(),
  reviewer_id: z.uuid(),
  title: z.string().trim().min(8).max(180),
  discipline: z.enum(disciplines as [string, ...string[]]),
  level: z.enum(levels as [string, ...string[]]),
  effort: z.enum(efforts as [string, ...string[]]),
  technology: z.string().trim().min(1).max(200),
  objective: z.string().trim().min(20).max(5000),
  context: z.string().trim().min(20).max(10000),
  acceptance: z.string().trim().min(20).max(10000),
  dependency_ids: z.array(z.uuid()).max(20).default([]),
});

export const releaseClaimSchema = z.object({
  task_id: z.uuid(),
  handoff: z.string().trim().min(20).max(5000),
});
