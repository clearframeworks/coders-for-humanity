import { z } from "zod";
const section = z
  .string()
  .trim()
  .min(40, "Please provide at least 40 characters.")
  .max(10000, "Please keep this section under 10,000 characters.");
export const proposalSchema = z.object({
  title: z.string().trim().min(8).max(180),
  problem: section,
  evidence: section,
  existing_solutions: section,
  people_affected: section,
  intervention: section,
  technology_rationale: section,
  risks: section,
  expertise: section,
  deployment: section,
  measurement: section,
  sources: z.array(z.url().startsWith("https://").max(2000)).min(1).max(20),
});
export const profileSchema = z.object({
  username: z
    .string()
    .regex(
      /^[a-z0-9][a-z0-9-]{2,39}$/,
      "Use 3–40 lowercase letters, numbers, or hyphens.",
    ),
  name: z.string().trim().min(1).max(100),
  bio: z.string().max(2000),
  location: z.string().max(100),
  availability: z.string().max(100),
  github_url: z.union([
    z.literal(""),
    z.string().regex(/^https:\/\/github.com\/[A-Za-z0-9-]+\/?$/),
  ]),
  website_url: z.union([z.literal(""), z.url().startsWith("https://")]),
  is_public: z.boolean(),
});
export const proposalSteps = [
  [
    "problem",
    "Problem",
    "What is happening, and why does it matter? Describe the problem without assuming a solution.",
  ],
  [
    "evidence",
    "Evidence",
    "What supports this problem statement? Separate verified findings from assumptions.",
  ],
  [
    "existing_solutions",
    "Existing solutions",
    "Which tools, institutions, or nontechnical interventions already address this? Why not contribute to them?",
  ],
  [
    "people_affected",
    "People affected",
    "Who experiences the problem? How will they participate in research and decisions? Avoid personal or sensitive information.",
  ],
  [
    "intervention",
    "Proposed intervention",
    "What change are you proposing? What is the smallest useful intervention?",
  ],
  [
    "technology_rationale",
    "Why technology helps",
    "Explain why software or technology could improve the outcome. Include reasons not to build.",
  ],
  [
    "risks",
    "Risks",
    "Consider harm, privacy, security, accessibility, misuse, and regulatory or operational constraints.",
  ],
  [
    "expertise",
    "Required expertise",
    "Which technical, research, design, and domain skills are needed? Who must review the work?",
  ],
  [
    "deployment",
    "Deployment considerations",
    "Where could this operate? Explain infrastructure, consent, maintenance, cost, and succession needs.",
  ],
  [
    "measurement",
    "Success measurement",
    "What human outcome should change? Describe a baseline, measurement method, and limitations.",
  ],
  [
    "sources",
    "Supporting sources",
    "Add one HTTPS source URL per line. Prefer primary research and existing project documentation.",
  ],
] as const;
