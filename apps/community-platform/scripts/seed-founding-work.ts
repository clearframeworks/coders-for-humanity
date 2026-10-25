import { writeFileSync } from "node:fs";
import { humanWork } from "../lib/harness";

// Regenerate only this data migration before its first hosted application.
const migration = "supabase/migrations/20260928040326_founding_human_work.sql";
const columns = [
  "id",
  "project_id",
  "title",
  "discipline",
  "level",
  "effort",
  "technology",
  "objective",
  "context",
  "acceptance",
  "dependencies",
  "reviewer",
  "assignee",
  "issue_url",
  "status",
  "is_demo",
] as const;
function literal(value: string | boolean | null | undefined): string {
  if (value == null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  return "'" + value.replaceAll("'", "''") + "'";
}
const rows = humanWork.map(
  (task) =>
    "(" + columns.map((column) => literal(task[column])).join(",") + ")",
);
writeFileSync(
  migration,
  `-- Real founding work requested by the owner. No fabricated people or outcomes.\n-- Stable IDs match lib/harness.ts; never overwrite task progress during provisioning.\nbegin;\ninsert into public.tasks (${columns.join(",")}) values\n${rows.join(",\n")}\non conflict (id) do nothing;\ncommit;\n`,
);
