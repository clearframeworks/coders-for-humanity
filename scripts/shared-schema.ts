import { readFileSync } from "node:fs";

// Preserve the reviewed foundation, but never run its public-schema loops on
// the shared project. Every object and schema-wide grant is scoped to CFH.
export function sharedSchemaMigration() {
  const files = [
    "20260928025534_institutional_foundation.sql",
    "20260928034553_community_workspace.sql",
    "20260928040326_founding_human_work.sql",
  ];
  const body = files.map((file) =>
    readFileSync(`supabase/migrations/${file}`, "utf8")
      .replace(/^-- Apply to a new, dedicated.*\r?\n/m, "")
      .replace(/^\s*(begin|commit);\s*$/gim, "")
      .replace(/\bpublic\./g, "cfh.")
      .replace(/'public'/g, "'cfh'")
      .replace(/\bprivate\b/g, "cfh_private"),
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
