# CFH owner authority

The owner (`clearframeworks`) is the final decision maker for this repository and
`cfh.retehost.com`. The owner's explicit approval authorizes the scoped release;
the owner does not need permission from a second person, agent, or service.
Everyone else needs the owner's approval or an explicit delegation from the owner.
When the owner is the only active human, do not invent a second reviewer as a
prerequisite. This owner authority continues when contributors join.

Keep required build, test, dependency-audit, and secret-scan checks in force.
The owner exception applies to human review requirements only. Agents acting
through the owner's account must have the owner's explicit scoped instruction;
access to that account is not standing permission to release arbitrary changes.
Never label owner-approved work as independently reviewed when it was not.

See `docs/owner-authority.md`. This policy is scoped to CFH; it does not change
the separate Clear Frameworks production lock or application authentication roles.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
