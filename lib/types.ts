export type Program = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
};
export type Project = {
  id: string;
  slug: string;
  name: string;
  program_id: string;
  summary: string;
  problem: string;
  objective: string;
  status: string;
  license: string;
  architecture: string;
  evidence: string;
  is_demo: boolean;
};
export type Task = {
  id: string;
  title: string;
  project_id: string;
  discipline: string;
  level: string;
  effort: string;
  technology: string;
  objective: string;
  context: string;
  acceptance: string;
  dependencies: string;
  reviewer: string;
  assignee: string;
  issue_url: string | null;
  status: string;
  is_demo: boolean;
};
export type Problem = {
  id: string;
  slug: string;
  title: string;
  program_id: string;
  description: string;
  evidence: string;
  affected: string;
  geography: string;
  interventions: string;
  questions: string;
  is_demo: boolean;
};
export type Profile = {
  id: string;
  username: string;
  name: string;
  bio: string;
  location: string;
  availability: string;
  github_url: string | null;
  website_url: string | null;
  is_demo: boolean;
};
export type Decision = {
  id: string;
  title: string;
  status: string;
  context: string;
  decision: string;
  consequences: string;
  decided_at: string | null;
  is_demo: boolean;
};
export type Catalog = {
  programs: Program[];
  projects: Project[];
  tasks: Task[];
  problems: Problem[];
  profiles: Profile[];
  decisions: Decision[];
  demo: boolean;
};
export const disciplines = [
  "Frontend",
  "Backend",
  "Full Stack",
  "DevOps",
  "Security",
  "Data",
  "AI/ML",
  "UX/UI",
  "Accessibility",
  "Documentation",
  "Testing",
  "Research",
  "Translation",
  "Legal/Policy",
  "Domain Expertise",
  "Project Management",
  "Field Testing",
];
export const levels = [
  "First Contribution",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Specialist",
];
export const efforts = [
  "< 1 hour",
  "1–3 hours",
  "3–8 hours",
  "Multi-day",
  "Ongoing",
];
export const taskStatuses = [
  "OPEN",
  "CLAIMED",
  "IN PROGRESS",
  "REVIEW",
  "BLOCKED",
  "COMPLETE",
];
export const lifecycle = [
  "Proposal",
  "Research",
  "Specification",
  "Build",
  "Verification",
  "Pilot",
  "Measurement",
  "Deployment",
  "Stewardship",
];
