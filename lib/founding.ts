import type { Catalog, Project } from "./types";
import { programs } from "./demo";
import { humanWork } from "./harness";

export const platformProject: Project = {
  id: "cf000000-0000-4000-8000-000000000001",
  slug: "community-platform",
  name: "Community platform",
  program_id: "civic-infrastructure",
  summary:
    "Build the shared workspace where people find each other, contribute useful work, and carry projects forward.",
  problem:
    "A community cannot coordinate meaningful work through scattered chats and repositories alone. New contributors need context, bounded responsibilities, a reviewer, and a clear way to hand work on.",
  objective:
    "Prove one complete human contribution: understand a problem, agree a task, collaborate, submit evidence, receive independent review, and leave a usable handoff.",
  status: "BUILDING",
  license: "MIT",
  architecture:
    "Next.js community interface with GitHub as the source of truth for code and pull requests. A dedicated Postgres database will hold member profiles, conversations, assignments, reviews, and decision records. Shared writes stay closed until authentication and row-level permissions are verified.",
  evidence:
    "This is the founding project requested by the platform owner. The current work is the platform itself. There is no completed community pilot or measured public-benefit outcome yet.",
  is_demo: false,
};
export const foundingCatalog: Catalog = {
  programs,
  projects: [platformProject],
  tasks: humanWork,
  problems: [],
  profiles: [],
  decisions: [],
  demo: false,
};
