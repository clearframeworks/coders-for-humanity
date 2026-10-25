import type { Task } from "./types";

export const platformProjectId = "cf000000-0000-4000-8000-000000000001";
export const releaseGates = [
  {
    id: "scope",
    name: "Contribution",
    owner: "Contributor",
    evidence:
      "A scoped issue, acceptance criteria, tests and a pull request. No production credentials.",
  },
  {
    id: "checks",
    name: "Automated checks",
    owner: "CI runner",
    evidence:
      "Secret scan, dependency audit, type checks, database tests, production build and browser checks on the proposed commit.",
  },
  {
    id: "review",
    name: "Independent review",
    owner: "Project maintainer",
    evidence:
      "Someone other than the author verifies behavior, maintainability, accessibility and acceptance criteria.",
  },
  {
    id: "security",
    name: "Security review",
    owner: "Harness reviewer",
    evidence:
      "Review data access, abuse cases, dependencies and trust boundaries. Auth, database, workflow and release changes require specialist review.",
  },
  {
    id: "release",
    name: "Release approval",
    owner: "Release steward",
    evidence:
      "Approve the exact reviewed commit and preview, record rollback and release evidence, then verify production.",
  },
] as const;

const foundingWorkIds = {
  "cfh-harness": "cf100000-0000-4000-8000-000000000001",
  "cfh-auth": "cf100000-0000-4000-8000-000000000002",
  "cfh-access": "cf100000-0000-4000-8000-000000000003",
  "cfh-handoff": "cf100000-0000-4000-8000-000000000004",
  "cfh-onboarding": "cf100000-0000-4000-8000-000000000005",
  "cfh-abuse": "cf100000-0000-4000-8000-000000000006",
  "cfh-release": "cf100000-0000-4000-8000-000000000007",
} as const;
export function foundingWorkId(key: keyof typeof foundingWorkIds): string {
  return foundingWorkIds[key];
}
type HumanWorkInput = Pick<
  Task,
  | "title"
  | "discipline"
  | "level"
  | "effort"
  | "technology"
  | "objective"
  | "context"
  | "acceptance"
  | "dependencies"
  | "reviewer"
> & { id: keyof typeof foundingWorkIds };
const foundingWork: HumanWorkInput[] = [
  {
    id: "cfh-harness",
    title: "Establish the independent harness team",
    discipline: "Security",
    level: "Specialist",
    effort: "Ongoing",
    technology: "Security review · GitHub",
    objective:
      "Give the community an accountable review team before widening release access.",
    context:
      "The platform is being handed to human maintainers. Contributor, reviewer and release authority must remain separate. No security team has been appointed yet.",
    acceptance:
      "Publish consenting maintainer and security reviewer contacts; document conflicts of interest and coverage; configure protected main with required checks and fresh independent reviews; prove a failing pull request cannot merge; record provider evidence.",
    dependencies:
      "Owner appoints trusted reviewers and approves repository settings.",
    reviewer: "Repository owner; independent security reviewer to be appointed",
  },
  {
    id: "cfh-auth",
    title: "Verify accounts and data isolation with real users",
    discipline: "Backend",
    level: "Advanced",
    effort: "Multi-day",
    technology: "Supabase · PostgreSQL · Next.js",
    objective:
      "Enable shared community work only after isolation is verified on the hosted system.",
    context:
      "Migrations and protected actions are implemented locally. Production account infrastructure needs an explicitly approved dedicated database and provider configuration.",
    acceptance:
      "Configure approved database and authentication; test anonymous, two-member and maintainer sessions; demonstrate blocked cross-user edits and role escalation; test revoked sessions, callback origins and rate limits; attach sanitized test evidence.",
    dependencies:
      "Dedicated Supabase project approval; harness reviewer assigned.",
    reviewer: "Backend maintainer and independent security reviewer",
  },
  {
    id: "cfh-access",
    title: "Test the complete contribution journey for accessibility",
    discipline: "Accessibility",
    level: "Intermediate",
    effort: "3–8 hours",
    technology: "Keyboard · Screen reader · WCAG",
    objective:
      "Make joining, finding work, discussing and submitting usable without a mouse.",
    context:
      "Automated checks cannot establish usability. Test the actual shared workflow in both color themes and on mobile.",
    acceptance:
      "Complete the journey using keyboard and a screen reader; record focus order, announcements and errors; verify light/dark contrast and 200% zoom; file reproducible issues and retest fixes.",
    dependencies:
      "Stable preview; authenticated journey available for full coverage.",
    reviewer: "Accessibility reviewer independent of the fixes",
  },
  {
    id: "cfh-handoff",
    title: "Write the first human maintainer handoff",
    discipline: "Documentation",
    level: "First Contribution",
    effort: "1–3 hours",
    technology: "Markdown · GitHub",
    objective:
      "Let a new maintainer understand and continue the work without this chat.",
    context:
      "Use the repository, harness charter and current deployment evidence. Separate implemented code from configured services and future work.",
    acceptance:
      "A new contributor can identify the current goal, open blockers, local setup, tests, review rules and release owner; every operational claim links to evidence; no credentials or invented people appear.",
    dependencies: "Access to the current public source and release record.",
    reviewer: "Project maintainer",
  },
  {
    id: "cfh-onboarding",
    title: "Design a respectful first contribution experience",
    discipline: "UX/UI",
    level: "Intermediate",
    effort: "3–8 hours",
    technology: "Interaction design · User research",
    objective:
      "Help people choose useful work by skill, time and interest without turning contribution into a popularity contest.",
    context:
      "Human contributors need autonomy, clear expectations, help and a way to hand off work when their availability changes.",
    acceptance:
      "Test the flow with at least three consenting contributors; publish anonymized findings; show claim, ask-for-help and handoff states; include non-code roles and low-bandwidth/mobile use.",
    dependencies:
      "Recruit consenting testers; no public personal research data.",
    reviewer: "Design maintainer and accessibility reviewer",
  },
  {
    id: "cfh-abuse",
    title: "Exercise the review boundary against hostile contributions",
    discipline: "Testing",
    level: "Advanced",
    effort: "3–8 hours",
    technology: "Threat modeling · Integration tests",
    objective:
      "Demonstrate that untrusted contributions cannot gain authority or ship themselves.",
    context:
      "Use a staging environment with synthetic data. Test malicious links, abusive content, task races, self-approval and dependency changes without running untrusted code with production secrets.",
    acceptance:
      "Publish a threat model and reproducible safe tests; prove self-approval and unauthorized completion are rejected; demonstrate stale evidence blocks acceptance; verify that application task completion cannot trigger a production deploy.",
    dependencies:
      "Hosted staging auth; independent review and release controls configured.",
    reviewer: "Harness security reviewer",
  },
  {
    id: "cfh-release",
    title: "Rehearse a release and rollback with a human steward",
    discipline: "DevOps",
    level: "Advanced",
    effort: "3–8 hours",
    technology: "Vercel · GitHub Actions",
    objective: "Make every release attributable, reviewable and recoverable.",
    context:
      "A successful build is evidence, not authorization. Keep public contributor CI separate from hosting credentials and production approval.",
    acceptance:
      "Record source SHA, preview URL, check results and independent approvals; prove unauthorized deployment denied; rehearse rollback in staging; verify the released URL and record an owner-approved production procedure.",
    dependencies:
      "Harness team appointed; hosting release permissions reviewed.",
    reviewer: "Repository owner and security reviewer",
  },
];

export const humanWork: Task[] = foundingWork.map((task) => ({
  ...task,
  id: foundingWorkId(task.id),
  project_id: platformProjectId,
  assignee: "Unassigned",
  issue_url: null,
  status: "OPEN",
  is_demo: false,
}));

export type ReleaseEvidence = {
  commit: string;
  author: string;
  checks: { name: string; commit: string; passed: boolean }[];
  approvals: {
    role: "maintainer" | "security" | "release";
    actor: string;
    commit: string;
  }[];
  rollback: string;
};
export const requiredChecks = [
  "secret-scan",
  "dependency-audit",
  "verify",
] as const;

/** Local policy evaluation only. Provider rules and identity verification enforce release authority. */
export function evaluateRelease(evidence: ReleaseEvidence): {
  eligible: boolean;
  blockers: string[];
} {
  const blockers: string[] = [];
  const author = evidence.author.trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/i.test(evidence.commit))
    blockers.push("A complete commit SHA is required.");
  if (!author)
    blockers.push("An authenticated contributor identity is required.");
  for (const name of requiredChecks) {
    const checks = evidence.checks.filter(
      (check) => check.name === name && check.commit === evidence.commit,
    );
    if (checks.length !== 1 || !checks[0].passed)
      blockers.push(`${name} must pass once on this commit.`);
  }
  const roles = ["maintainer", "security", "release"] as const;
  const identities = new Set<string>();
  for (const role of roles) {
    const approvals = evidence.approvals.filter(
      (approval) =>
        approval.role === role && approval.commit === evidence.commit,
    );
    const valid =
      approvals.length === 1 &&
      approvals[0].actor.trim() &&
      approvals[0].actor.trim().toLowerCase() !== author;
    if (!valid) {
      blockers.push(
        `Independent ${role} approval is required for this commit.`,
      );
      continue;
    }
    const identity = approvals[0].actor.trim().toLowerCase();
    if (identities.has(identity))
      blockers.push(
        "Maintainer, security and release approvals must come from distinct people.",
      );
    identities.add(identity);
  }
  if (!evidence.rollback.trim())
    blockers.push("A rollback coordinate is required.");
  return { eligible: blockers.length === 0, blockers };
}
