export type Article = {
  title: string;
  eyebrow: string;
  intro: string;
  sections: { title: string; text: string; items?: string[] }[];
};
export const institution: Record<string, Article> = {
  mission: {
    title: "Open engineering. Public purpose.",
    eyebrow: "OUR MISSION",
    intro: "Open engineering for the human problems worth solving.",
    sections: [
      {
        title: "The coordination problem",
        text: "There is no shortage of technical capacity. There is a shortage of ways to bring it together around work that serves people. Meaningful problems require research, engineering, design, infrastructure, domain knowledge, and long-term stewardship.",
      },
      {
        title: "Many small contributions. A shared system.",
        text: "Coders for Humanity brings developers, designers, researchers, domain experts, and AI-assisted builders into a common process. Thousands of people should be able to contribute a small amount of useful work toward systems no individual could reasonably maintain alone.",
      },
      {
        title: "Public benefit is the objective",
        text: "The institution is nonprofit in purpose. There is no premium tier, paid repository access, proprietary CFH edition, or commercial exit objective. Funding exists to sustain the mission. Formal legal and tax status must be established and published separately; this platform does not claim registered charitable status.",
      },
      {
        title: "What could we build if monetization wasn’t the objective?",
        text: "Anyone can build another SaaS. It takes everyone to build a better tomorrow. We build it, maintain it, document it, and give it away.",
      },
    ],
  },
  constitution: {
    title: "The institutional constitution.",
    eyebrow: "OUR PERMANENT PRINCIPLES",
    intro:
      "A public commitment to the purpose, openness, and stewardship of everything we build.",
    sections: [
      {
        title: "I — Public benefit",
        text: "Projects must primarily address a legitimate humanitarian, scientific, environmental, educational, accessibility, health, infrastructure, or civic problem.",
      },
      {
        title: "II — Open source",
        text: "Official software must remain publicly accessible. MIT is the default software license. Datasets, documentation, hardware, research, and other artifacts require an appropriate open license; MIT must not be applied blindly.",
      },
      {
        title: "III — No commercial capture",
        text: "No contributor, maintainer, sponsor, donor, company, or partner receives ownership of an official project because of financial or labor contributions. Forks and uses permitted by the applicable license remain permitted. Official governance, infrastructure, and identity cannot be privately acquired through contribution.",
      },
      {
        title: "IV — Transparent development",
        text: "Official projects should expose source, roadmap, issues, architecture, maintainers, contributors, decisions, releases, documentation, funding, deployments, and measured outcomes. Exclude security-sensitive information where publication would create legitimate risk.",
      },
      {
        title: "V — Human outcomes",
        text: "Lines of code, stars, contributors, downloads, and activity are operational metrics. They are not the mission. Measure what improved for people, communities, institutions, science, or the environment.",
      },
      {
        title: "VI — Reusability",
        text: "Whenever practical, build reusable public infrastructure rather than one-off implementations.",
      },
      {
        title: "VII — Accessibility",
        text: "Accessibility is an engineering requirement. Treat failures as bugs and include disabled people in research, design, and verification.",
      },
      {
        title: "VIII — Privacy",
        text: "Collect the minimum personal information necessary. Public-interest software must not become surveillance infrastructure.",
      },
      {
        title: "IX — Sustainability",
        text: "Open source does not mean abandoned source. Every accepted project must consider maintainership, documentation, deployment, infrastructure, security, succession, and long-term operation.",
      },
    ],
  },
  governance: {
    title: "Authority with accountability.",
    eyebrow: "INSTITUTIONAL GOVERNANCE",
    intro:
      "A proposed governance structure for a public-interest institution. No board members or stewards have been appointed in this platform.",
    sections: [
      {
        title: "Roles and responsibilities",
        text: "Roles establish responsibility for stewardship; they do not confer ownership.",
        items: [
          "Board: fiduciary oversight, institutional purpose, and conflicts of interest.",
          "Institutional maintainers: platform operations, policy implementation, and security.",
          "Program stewards: coordinate research and projects within a human problem area.",
          "Project and technical maintainers: review, releases, documentation, and succession.",
          "Domain advisors and reviewers: assess evidence, safety, accessibility, and technical quality.",
          "Contributors: undertake agreed work and participate in transparent decisions.",
        ],
      },
      {
        title: "Project acceptance",
        text: "An acceptance decision should identify a public need, evidence, an appropriate license, maintainers, review capacity, operating resources, and success measures. Research may conclude that building software is not warranted.",
      },
      {
        title: "Decision records",
        text: "Record the context, options considered, decision, consequences, responsible reviewers, date, and any conflicts. Publish institutional and technical records, with a documented exception for private or security-sensitive details.",
      },
      {
        title: "Conflicts, appeals, and change",
        text: "Disclose relevant financial and organizational interests before decisions. A conflicted reviewer should recuse. Record objections and provide an appeal to unconflicted institutional stewards. Governance changes must be published with rationale and a review period.",
      },
    ],
  },
  funding: {
    title: "Fund the work. Protect the purpose.",
    eyebrow: "SUSTAINABLE PUBLIC ENGINEERING",
    intro:
      "Financial support sustains shared infrastructure, maintenance, and public service. It does not purchase control.",
    sections: [
      {
        title: "How support can help",
        text: "Potential support includes individual donations, philanthropic and institutional grants, transparent sponsorship, donated infrastructure and tooling, and university partnerships. No payment collection is enabled on this platform.",
      },
      {
        title: "What support never buys",
        text: "Sponsors do not purchase project ownership, roadmap control, contributor data, user data, proprietary access, or exclusive licensing. Public acknowledgement can be offered without changing the institution’s obligations.",
      },
      {
        title: "Transparent accounting",
        text: "Publish funding sources, grant conditions, major expenses, infrastructure contributions, and conflicts of interest. Reports must link to supporting records and distinguish cash from in-kind support. Never aggregate different currencies without a documented conversion method.",
      },
      {
        title: "Current position",
        text: "No verified funding records or donation arrangements have been published. The absence of records is not a claim that audited income or expenses equal zero. Legal status and any tax treatment must be established before fundraising representations are made.",
      },
    ],
  },
  partners: {
    title: "Shared purpose. Clear responsibilities.",
    eyebrow: "INSTITUTIONAL PARTNERSHIPS",
    intro:
      "Partnerships should connect useful engineering with real-world needs and accountable stewardship.",
    sections: [
      {
        title: "Who can participate",
        text: "Community organizations, research institutions, universities, public bodies, and humanitarian organizations can help define needs, review evidence, run consenting pilots, or contribute expertise.",
      },
      {
        title: "A partnership should specify",
        text: "Document the problem, community participation, data boundaries, accessibility requirements, operational responsibilities, license, costs, success measures, and exit or succession plan. Public acknowledgement does not imply endorsement of every activity of a partner.",
      },
      {
        title: "Current partnerships",
        text: "No institutional partnerships are represented by the demonstration catalogue. Verified partner records will be published only after agreement and review.",
      },
    ],
  },
  about: {
    title: "An institution for work that matters.",
    eyebrow: "ABOUT CODERS FOR HUMANITY",
    intro: "A shared home for open-source engineering in the public interest.",
    sections: [
      {
        title: "A coordination layer",
        text: "Coders for Humanity connects human needs to research, specifications, contribution-sized tasks, verification, and long-term operation. GitHub remains the source and code-review system; this platform provides institutional context and accountability.",
      },
      {
        title: "Open participation",
        text: "Traditional developers and AI-assisted builders are welcome alongside researchers, designers, translators, domain experts, and field testers. The quality, safety, and review requirements are the same for every contribution.",
      },
      {
        title: "Honest beginnings",
        text: "This implementation includes a clearly labelled demonstration catalogue. Example projects and people are not claims of active work, real deployments, formal partnerships, or measured outcomes. The platform’s legal formation and operating leadership are not established by the software.",
      },
      {
        title: "A public commitment",
        text: "No contributor owns what we build. No corporation owns what we build. Coders for Humanity does not exist to own what we build. We build it, maintain it, document it, and give it away.",
      },
    ],
  },
};
export const docs: Record<string, Article> = {
  "contributor-guide": {
    title: "The contributor guide",
    eyebrow: "HANDBOOK / GET STARTED",
    intro:
      "Find a bounded task, understand its context, and leave the work easier for the next person.",
    sections: [
      {
        title: "Choose work you can finish",
        text: "Filter the contribution board by discipline, skill level, commitment, project, program, and technology. Read the objective, acceptance criteria, dependencies, and reviewer information before claiming work.",
      },
      {
        title: "Make a contribution",
        text: "Create a contributor profile, claim an available real task, and use its linked issue to agree scope. Keep private or security-sensitive details out of public issues. Submit changes through the linked repository’s pull-request process.",
      },
      {
        title: "Prepare for review",
        text: "Explain the problem addressed, what changed, and how you tested it. Include accessibility checks, documentation, source attribution, and any limitations. AI-assisted work must be understood and reviewed by the contributor submitting it.",
      },
      {
        title: "Non-code contributions",
        text: "Research, translation, design, domain review, documentation, accessibility testing, and field testing are first-class work. Use the same clear objectives and acceptance criteria.",
      },
    ],
  },
  lifecycle: {
    title: "From problem to stewardship",
    eyebrow: "HANDBOOK / PROJECT LIFECYCLE",
    intro:
      "Building is a decision supported by evidence, not the automatic next step.",
    sections: [
      {
        title: "1. Proposal",
        text: "Identify the problem, people affected, existing solutions, evidence, technological rationale, risks, expertise, and proposed outcome.",
      },
      {
        title: "2. Research",
        text: "Validate the need, assumptions, existing interventions, domain constraints, regulatory considerations, and feasibility. Reject or return proposals when evidence does not justify the next step.",
      },
      {
        title: "3. Specification",
        text: "Define requirements, users, architecture, data, privacy, accessibility, security, deployment, and success measures. Publish unresolved questions.",
      },
      {
        title: "4. Build",
        text: "Break the specification into contribution-sized work units with acceptance criteria, dependencies, and named review responsibility.",
      },
      {
        title: "5. Verification",
        text: "Complete automated tests, security review, accessibility review, documentation review, and relevant domain review. Unresolved material risks block a pilot.",
      },
      {
        title: "6. Pilot",
        text: "Operate in a limited, consenting real-world setting with rollback and support plans. Collect only necessary data.",
      },
      {
        title: "7. Measurement",
        text: "Compare actual outcomes with the proposed baseline and success measures. Publish uncertainty and unintended effects.",
      },
      {
        title: "8. Deployment",
        text: "Expand only where evidence supports it and operating responsibility is clear.",
      },
      {
        title: "9. Stewardship",
        text: "Maintain security, documentation, governance, infrastructure, contributor succession, and an eventual retirement plan.",
      },
    ],
  },
  proposals: {
    title: "Write a useful proposal",
    eyebrow: "HANDBOOK / PROPOSALS",
    intro:
      "Make a case for understanding the need before committing to a solution.",
    sections: [
      {
        title: "Search before proposing",
        text: "Check the problem library and existing projects. A duplicate effort may be merged with existing work; contributing research to an established project is often more useful.",
      },
      {
        title: "Use all eleven sections",
        text: "Provide the problem, evidence, existing solutions, people affected, proposed intervention, technological rationale, risks, required expertise, deployment considerations, success measures, and sources. Separate assumptions from observations.",
      },
      {
        title: "What happens next",
        text: "A browser draft is private to your device. Submitted proposals belong to your account and enter research review. Reviewers may request information, accept, decline, or merge the proposal. Acceptance is not permission to skip verification or community consent.",
      },
    ],
  },
  maintainers: {
    title: "The maintainer guide",
    eyebrow: "HANDBOOK / STEWARDSHIP",
    intro:
      "Maintaining a project means making its responsibilities visible and durable.",
    sections: [
      {
        title: "Before accepting work",
        text: "Publish a scope, architecture, contribution guide, security contact process, appropriate license, and named reviewers. Create tasks only when the objective and acceptance criteria are clear.",
      },
      {
        title: "Review and release",
        text: "Require independent review for consequential changes. Test the complete user flow, document migration and rollback, and publish release notes. Record the decision to advance lifecycle stages with evidence.",
      },
      {
        title: "Succession and retirement",
        text: "Document operating access, infrastructure costs, dependencies, and recovery procedures in appropriate public or protected locations. Appoint successors. Archive responsibly when maintenance cannot continue and communicate the consequences to users.",
      },
    ],
  },
  governance: {
    title: "Recording institutional decisions",
    eyebrow: "HANDBOOK / GOVERNANCE",
    intro:
      "A decision should remain understandable after the people who made it have moved on.",
    sections: [
      {
        title: "Decision record format",
        text: "Include a stable identifier, title, status, context, options, decision, consequences, reviewers, conflicts, and date. Link the evidence and related project.",
      },
      {
        title: "Approval boundaries",
        text: "Contributors propose changes; appointed stewards approve according to their scope. Financial contribution never grants approval power. Record changes and preserve superseded decisions.",
      },
    ],
  },
  licensing: {
    title: "Licensing for reuse",
    eyebrow: "HANDBOOK / OPEN SOURCE",
    intro:
      "Use an open license that fits the artifact and respects upstream obligations.",
    sections: [
      {
        title: "Software",
        text: "MIT is the default for original official software. Preserve license and copyright notices. Review third-party dependencies for compatibility before inclusion.",
      },
      {
        title: "Data, documentation, and hardware",
        text: "MIT is not automatically appropriate for every artifact. Select an appropriate open data, documentation, research, or hardware license with domain review. Record provenance, permissions, and restrictions on personal or confidential information.",
      },
      {
        title: "The institution and the license",
        text: "Permitted forks and commercial reuse under an open-source license remain permitted. Those permissions do not transfer the official institution’s governance, infrastructure, name, or identity to the contributor or user.",
      },
    ],
  },
  "development-setup": {
    title: "Run the platform locally",
    eyebrow: "HANDBOOK / DEVELOPMENT",
    intro:
      "A modular Next.js application with TypeScript, React, and PostgreSQL through Supabase.",
    sections: [
      {
        title: "Local demonstration",
        text: "Install Node.js 22 or newer, run npm ci, copy .env.example to .env.local, and run npm run dev. Open http://localhost:3100. CFH_DEMO_MODE=true uses the explicitly labelled example catalogue without a database.",
      },
      {
        title: "Connected environment",
        text: "Create a dedicated Supabase project, apply the checked-in migration, configure GitHub and email authentication, and set the site URL and callback allowlist. Set the publishable environment values and CFH_DEMO_MODE=false. Never expose a secret or service-role key to the browser.",
      },
      {
        title: "Verify changes",
        text: "Run npm run typecheck, npm test, npm run build, and npm run test:e2e. The root README includes database, provider, deployment, and manual accessibility checks.",
      },
    ],
  },
  "code-standards": {
    title: "Code that can be maintained",
    eyebrow: "HANDBOOK / ENGINEERING",
    intro:
      "Prefer clear boundaries, small changes, and evidence of correct behavior.",
    sections: [
      {
        title: "Application structure",
        text: "Use server components for public reading and small client components for interaction. Keep validation and data access separate from rendering. Use normalized relationships and explicit publication boundaries.",
      },
      {
        title: "Contribution quality",
        text: "Use strict TypeScript, semantic HTML, readable names, and meaningful tests around behavior or security boundaries. Explain limitations. Avoid unnecessary services, dependencies, and client JavaScript.",
      },
      {
        title: "GitHub integration",
        text: "Link repositories, issues, and pull requests to the institutional context. GitHub owns source control and code review. Automated synchronization is an extension point and must validate signatures, use minimal scopes, and process deliveries idempotently.",
      },
    ],
  },
  security: {
    title: "Responsible security reporting",
    eyebrow: "HANDBOOK / SECURITY",
    intro:
      "Protect people and infrastructure while keeping development transparent.",
    sections: [
      {
        title: "Report privately",
        text: "Do not publish vulnerabilities, personal data, credentials, or operational secrets in public issues. Once the official GitHub repository is configured, use its private vulnerability reporting feature. Until a private channel is published, contact an appointed maintainer privately; no public disclosure inbox is claimed by this preview.",
      },
      {
        title: "What to include",
        text: "Describe the affected version, reproduction steps, likely impact, and a safe proof of concept. Do not access other people’s data or test destructively. Agree a disclosure timeline with the maintainer.",
      },
      {
        title: "Baseline controls",
        text: "All exposed database tables use row-level security. Protected actions verify the current user on the server. Validate input, restrict external URLs, prevent cross-origin mutations, rate-limit submissions and claims, and audit privileged changes.",
      },
    ],
  },
  accessibility: {
    title: "Accessibility is an engineering requirement",
    eyebrow: "HANDBOOK / ACCESSIBILITY",
    intro: "Target WCAG 2.2 AA and include real assistive-technology testing.",
    sections: [
      {
        title: "Interaction requirements",
        text: "Use semantic landmarks, a skip link, labelled controls, visible focus, keyboard navigation, useful errors, and accessible status updates. Status must never rely on color alone. Support reduced motion and light, dark, and system appearance.",
      },
      {
        title: "Verification",
        text: "Test keyboard-only workflows, screen-reader navigation, contrast, zoom to 200% and 400%, and narrow viewports. Automated checks identify some issues; they do not establish complete WCAG conformance.",
      },
      {
        title: "Content and participation",
        text: "Use plain language and descriptive links. Publish text alternatives for diagrams and documents. Include disabled people in research and usability review.",
      },
    ],
  },
  deployment: {
    title: "Deployment and operation",
    eyebrow: "HANDBOOK / OPERATIONS",
    intro: "A release is a commitment to the people who depend on it.",
    sections: [
      {
        title: "Before release",
        text: "Run the build, behavior tests, security checks, and accessibility review. Configure exact environment URLs and authentication callbacks. Verify backup restoration, operating ownership, incident response, and a rollback coordinate.",
      },
      {
        title: "Pilot first",
        text: "Use a preview or staging environment to verify authentication, row-level security, task claiming, proposal submission, and publication boundaries. Test with multiple users, including unauthorized users.",
      },
      {
        title: "Operate responsibly",
        text: "Monitor availability and failures without collecting unnecessary personal data. Review dependencies regularly and maintain an incident process. Publish operational limitations and retire systems responsibly.",
      },
    ],
  },
  "impact-reporting": {
    title: "Evidence before impact claims",
    eyebrow: "HANDBOOK / IMPACT",
    intro:
      "An operational metric tells us what happened in a system. An outcome tells us whether it helped.",
    sections: [
      {
        title: "Minimum reporting record",
        text: "State the measure, unit, baseline, observation period, method, source, limitations, and reviewer. Connect each outcome to the relevant project and deployment.",
      },
      {
        title: "No invented counters",
        text: "Do not substitute commits, stars, contributors, or downloads for human outcomes. Do not turn missing records into a zero or a success claim. Explicitly state when reliable data is unavailable.",
      },
      {
        title: "Comparable and reproducible",
        text: "Document uncertainty, confounders, collection consent, and aggregation. Avoid adding unlike units or currencies. Provide machine-readable records where it is safe to do so.",
      },
    ],
  },
};
