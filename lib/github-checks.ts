export type CheckRun = {
  id: number; name: string; head_sha: string; status: string;
  conclusion: string | null; html_url: string | null;
  app?: { slug: string };
};
export type CommitStatus = {
  context: string; state: string; target_url: string | null;
  creator?: { login: string };
};
export type CheckReport = {
  sha: string;
  state: "passed" | "failed" | "pending" | "unavailable" | "unreported";
  label: string;
  checks: { name: string; state: string; url: string | null }[];
  deployment: { state: string; url: string | null } | null;
};

// Provider data is external input. Do not render arbitrary status target schemes.
export function providerUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return ["github.com", "vercel.com"].includes(url.hostname) || url.hostname.endsWith(".vercel.app") ? url.href : null;
  } catch { return null; }
}

export function summarizeChecks(
  sha: string,
  runs: { check_runs: CheckRun[]; total_count: number } | null,
  statuses: { sha: string; statuses: CommitStatus[]; total_count: number } | null,
): CheckReport {
  const checks = [
    ...(runs?.check_runs || []).filter((run) => run.head_sha === sha).map((run) => ({
      name: run.name,
      state: run.status === "completed" ? run.conclusion || "unknown" : "pending",
      url: providerUrl(run.html_url),
    })),
    ...(statuses?.sha === sha ? statuses.statuses : []).map((status) => ({
      name: status.context, state: status.state, url: providerUrl(status.target_url),
    })),
  ];
  const deployment = statuses?.sha === sha ? statuses.statuses.find((status) =>
    /^vercel(?:\b|\s|-)/i.test(status.context) && ["vercel", "vercel[bot]"].includes(status.creator?.login || ""),
  ) : undefined;
  const complete = runs !== null && statuses !== null && statuses.sha === sha
    && runs.total_count <= runs.check_runs.length && statuses.total_count <= statuses.statuses.length
    && runs.check_runs.every((run) => run.head_sha === sha);
  const failed = checks.some((check) => ["failure", "error", "cancelled", "timed_out", "action_required", "startup_failure", "stale"].includes(check.state));
  const state: CheckReport["state"] = failed ? "failed" : !complete ? "unavailable" : !checks.length ? "unreported" : checks.every((check) => check.state === "success") ? "passed" : "pending";
  const labels = { passed: "Reported checks passed", failed: "Checks need attention", pending: "Checks pending or need review", unavailable: "Check results incomplete", unreported: "No checks reported" };
  return { sha, state, label: labels[state], checks, deployment: deployment ? { state: deployment.state, url: providerUrl(deployment.target_url) } : null };
}
