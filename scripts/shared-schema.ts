import { readFileSync } from "node:fs";

// Preserve the reviewed foundation, but never run its public-schema loops on
// the shared project. Every object and schema-wide grant is scoped to CFH.
export function sharedSchemaMigration(readSource = (file: string) => readFileSync(file, "utf8")) {
  const files = [
    "20260928025534_institutional_foundation.sql",
    "20260928034553_community_workspace.sql",
    "20260928040326_founding_human_work.sql",
    "20261008173854_task_development.sql",
    "20261008173918_cfh_profile_notifications.sql",
  ];
  const body = files.map((file) =>
    readSource(`supabase/migrations/${file}`)
      // Normalize before multiline expressions: CRLF changes their boundaries.
      .replace(/\r\n/g, "\n")
      .replace(/^-- Apply to a new, dedicated.*\r?\n/m, "")
      .replace(/^\s*(begin|commit);\s*$/gim, "")
      .replace(/\bpublic\./g, "cfh.")
      .replace(/\bon schema public\b/g, "on schema cfh")
      .replace(/'public'/g, "'cfh'")
      .replace(/\bprivate\./g, "cfh_private.")
      .replace(/\b(schema\s+(?:if\s+not\s+exists\s+)?)private\b/gi, "$1cfh_private")
      .replace(/'private'/g, "'cfh_private'"),
  );
  return [
    "-- CFH only. Apply this bundle, not the dedicated-project migrations, to retehost-cfw.",
    "begin;",
    "create schema cfh;",
    "revoke all on schema cfh from public;",
    "grant usage on schema cfh to anon, authenticated;",
    ...body,
    "commit;",
    "",
  ].join("\n");
}
