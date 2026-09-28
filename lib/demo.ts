import type { Catalog, Program, Project, Task, Problem } from "./types";
const programDefinitions = [
  ["food", "Food", "More resilient, equitable food systems.", "Sprout"],
  [
    "housing",
    "Housing",
    "Tools for stable shelter and dignified housing.",
    "House",
  ],
  [
    "accessibility",
    "Accessibility",
    "Participation without unnecessary barriers.",
    "Accessibility",
  ],
  [
    "disaster-response",
    "Disaster Response",
    "Shared infrastructure when every hour matters.",
    "Radio",
  ],
  [
    "education",
    "Education",
    "Open pathways to learning and knowledge.",
    "BookOpen",
  ],
  [
    "environment",
    "Environment",
    "Technology in service of a living planet.",
    "Leaf",
  ],
  ["health", "Health", "Public tools for healthier communities.", "HeartPulse"],
  [
    "civic-infrastructure",
    "Civic Infrastructure",
    "Accountable, accessible public systems.",
    "Landmark",
  ],
  [
    "humanitarian-logistics",
    "Humanitarian Logistics",
    "Get essential resources where they are needed.",
    "Route",
  ],
  [
    "open-science",
    "Open Science",
    "Research that everyone can build upon.",
    "FlaskConical",
  ],
];
export const programs: Program[] = programDefinitions.map(
  ([slug, name, description, icon]) => ({
    id: slug,
    slug,
    name,
    description,
    icon,
  }),
);
export const projects: Project[] = [
  {
    id: "food-bridge",
    slug: "food-bridge",
    name: "Food Bridge",
    program_id: "food",
    summary:
      "Connecting surplus food with the organizations that can put it to use.",
    problem:
      "Food providers and community organizations often coordinate collections using disconnected spreadsheets and phone calls.",
    objective:
      "Explore a shared, low-bandwidth exchange for food availability and collection coordination.",
    status: "RESEARCH",
    license: "MIT",
    architecture:
      "A web application with an accessible donor intake, an organization directory, and a collection coordination API. Avoid collecting information about individual food recipients.",
    evidence:
      "Example research brief. Validate the coordination problem through interviews with local food providers and community organizations before deciding to build.",
    is_demo: true,
  },
  {
    id: "access-map",
    slug: "access-map",
    name: "Access Map",
    program_id: "accessibility",
    summary: "Making reliable accessibility information part of every journey.",
    problem:
      "People cannot consistently find current, detailed accessibility information about public places.",
    objective:
      "Investigate an open, verifiable format for describing the accessibility of public locations.",
    status: "DESIGN",
    license: "MIT",
    architecture:
      "An accessible directory backed by a versioned observation schema. Each observation includes its date, source, and verification status. Location data requires a separately reviewed open data license.",
    evidence:
      "Example research brief. Co-design the observation format with disabled people and audit existing mapping efforts for gaps and reuse opportunities.",
    is_demo: true,
  },
  {
    id: "shelter-link",
    slug: "shelter-link",
    name: "Shelter Link",
    program_id: "disaster-response",
    summary: "A common language for shelter capacity and essential resources.",
    problem:
      "Emergency shelters may lack an interoperable way to communicate resource availability across organizations.",
    objective:
      "Evaluate a small interoperability standard for non-sensitive shelter availability.",
    status: "PROPOSAL",
    license: "MIT",
    architecture:
      "A documented exchange format and reference API, with stale-data indicators, offline export, and access controls for sensitive operational data.",
    evidence:
      "Example proposal. Interview emergency management professionals and shelter operators; validate information-sharing risks before collecting operational data.",
    is_demo: true,
  },
  {
    id: "open-learning",
    slug: "open-learning",
    name: "Open Learning Kit",
    program_id: "education",
    summary:
      "Learning resources designed for unreliable connections and shared devices.",
    problem:
      "Online learning tools can assume connectivity and hardware that learners do not have.",
    objective:
      "Research an offline-first, reusable learning resource distribution kit.",
    status: "RESEARCH",
    license: "MIT",
    architecture:
      "A static resource catalogue with downloadable learning packs, accessible HTML, and a documented content licensing policy.",
    evidence:
      "Example research brief. Assess existing offline learning systems with teachers before specifying any new software.",
    is_demo: true,
  },
];
const taskRows = [
  [
    "food-intake",
    "Map the food donation journey",
    "food-bridge",
    "UX/UI",
    "First Contribution",
    "1–3 hours",
    "Figma",
    "Document the steps from a surplus food offer to a confirmed collection.",
    "A shared journey map helps researchers identify where coordination fails.",
    "Include donor and recipient perspectives; flag assumptions; provide an accessible text version.",
    "No dependencies",
    "OPEN",
  ],
  [
    "access-labels",
    "Review accessibility field labels",
    "access-map",
    "Accessibility",
    "First Contribution",
    "< 1 hour",
    "HTML",
    "Review the draft observation form for clear, unambiguous labels.",
    "Labels should describe observed features rather than assume an individual’s needs.",
    "Review every field; explain ambiguous wording; suggest plain-language alternatives.",
    "No dependencies",
    "OPEN",
  ],
  [
    "shelter-research",
    "Compare existing shelter data standards",
    "shelter-link",
    "Research",
    "Intermediate",
    "3–8 hours",
    "Research",
    "Identify existing public standards and document where reuse is possible.",
    "The proposal must show why an existing system cannot meet the need.",
    "Link primary sources; compare ownership, freshness, accessibility, and privacy constraints.",
    "No dependencies",
    "OPEN",
  ],
  [
    "food-schema",
    "Review a food availability data model",
    "food-bridge",
    "Backend",
    "Advanced",
    "3–8 hours",
    "PostgreSQL",
    "Review the proposed model for minimization and interoperability.",
    "Location and food-safety constraints need domain review before implementation.",
    "Document required fields, retention periods, permission boundaries, and open questions.",
    "Domain review required",
    "BLOCKED",
  ],
  [
    "learning-docs",
    "Write an offline resource checklist",
    "open-learning",
    "Documentation",
    "Beginner",
    "1–3 hours",
    "Markdown",
    "Draft a checklist for a resource that works without a reliable connection.",
    "Teachers need a practical way to assess downloadable resources.",
    "Cover formats, size, licensing, screen-reader support, and printing.",
    "No dependencies",
    "OPEN",
  ],
  [
    "access-ui",
    "Prototype a keyboard-friendly location form",
    "access-map",
    "Frontend",
    "Intermediate",
    "3–8 hours",
    "React",
    "Build a small semantic form prototype from the example field list.",
    "The prototype will support a usability review before a build decision.",
    "Support keyboard use, labelled errors, and a text-only review screen.",
    "Field-label review",
    "REVIEW",
  ],
  [
    "food-translate",
    "Review the plain-language intake guide",
    "food-bridge",
    "Translation",
    "Beginner",
    "< 1 hour",
    "Markdown",
    "Identify language that will be difficult to translate consistently.",
    "A clear source document makes later translation more reliable.",
    "Flag idioms; propose plain alternatives; preserve safety-related meaning.",
    "No dependencies",
    "OPEN",
  ],
  [
    "shelter-domain",
    "Review shelter information-sharing risks",
    "shelter-link",
    "Domain Expertise",
    "Specialist",
    "Ongoing",
    "Research",
    "Help define which operational information should remain private.",
    "An open standard must not expose vulnerable communities or shelter occupants.",
    "Document risks, safeguards, and a recommended publication boundary.",
    "No dependencies",
    "OPEN",
  ],
];
export const tasks: Task[] = taskRows.map(
  ([
    id,
    title,
    project_id,
    discipline,
    level,
    effort,
    technology,
    objective,
    context,
    acceptance,
    dependencies,
    status,
  ]) => ({
    id,
    title,
    project_id,
    discipline,
    level,
    effort,
    technology,
    objective,
    context,
    acceptance,
    dependencies,
    status,
    reviewer: "Reviewer not yet appointed",
    assignee: "Unassigned",
    issue_url: null,
    is_demo: true,
  }),
);
export const problems: Problem[] = [
  {
    id: "food-coordination",
    slug: "food-coordination",
    title: "Surplus food. Unmet need. A coordination gap.",
    program_id: "food",
    description:
      "Food waste and food insecurity can coexist in the same area. We need to understand the practical barriers between available food and organizations that could use it.",
    evidence:
      "Research is needed. This example is a starting question, not a validated local finding.",
    affected:
      "Food providers, food recovery organizations, and communities facing food insecurity.",
    geography: "Local and regional; no pilot location selected.",
    interventions:
      "Food banks, community fridges, food rescue organizations, and existing redistribution platforms.",
    questions:
      "Which barriers are logistical? Which are financial or regulatory? Would better software change the outcome?",
    is_demo: true,
  },
  {
    id: "accessible-places",
    slug: "accessible-places",
    title: "A public place is only accessible if you can plan to use it.",
    program_id: "accessibility",
    description:
      "Accessibility information is often incomplete, hard to compare, or out of date. A place being described as “accessible” may not answer a person’s actual questions.",
    evidence:
      "Research is needed. The example does not represent completed consultation.",
    affected:
      "Disabled people, caregivers, venue operators, and local accessibility organizations.",
    geography: "Public locations; no geographic deployment selected.",
    interventions:
      "Existing mapping services, accessibility audits, and community-maintained directories.",
    questions:
      "What information do people need? Who verifies it? How quickly does it become outdated?",
    is_demo: true,
  },
  {
    id: "shelter-information",
    slug: "shelter-information",
    title: "Emergency resources need a shared language.",
    program_id: "disaster-response",
    description:
      "Resource availability information can be difficult to exchange across organizations during a response.",
    evidence:
      "Research is needed with emergency management professionals before establishing requirements.",
    affected:
      "Shelter operators, response coordinators, and people seeking shelter.",
    geography:
      "Context-specific; requires local operational and safety review.",
    interventions:
      "Emergency management systems, hotlines, mutual-aid networks, and official public dashboards.",
    questions:
      "Which data can be safely shared? How is freshness verified? What works when networks fail?",
    is_demo: true,
  },
];
export const demoCatalog: Catalog = {
  programs,
  projects,
  tasks,
  problems,
  profiles: [
    {
      id: "example-contributor",
      username: "example-contributor",
      name: "Example contributor",
      bio: "An example of a contribution-focused profile. This is not a real person or a claim of completed work.",
      location: "Not specified",
      availability: "2 hours per week",
      github_url: null,
      website_url: null,
      is_demo: true,
    },
  ],
  decisions: [
    {
      id: "001",
      title: "Keep example records distinct from institutional activity",
      status: "PROPOSED",
      context:
        "A new platform needs examples without suggesting that research, deployments, or outcomes already exist.",
      decision:
        "Label every example record and exclude example data from verified impact and financial reporting.",
      consequences:
        "Public reports start empty. Real projects need evidence and an explicit acceptance decision.",
      decided_at: null,
      is_demo: true,
    },
  ],
  demo: true,
};
