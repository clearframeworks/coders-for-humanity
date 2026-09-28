import { cache } from "react";
export const repository = "clearframeworks/coders-for-humanity";
export const repositoryUrl = `https://github.com/${repository}`;
export type GitHubIssue = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  created_at: string;
  updated_at: string;
  comments: number;
  user: { login: string; html_url: string };
  labels: { name: string }[];
  pull_request?: { url: string };
  body: string | null;
};
export type GitHubCommit = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } };
  author: { login: string; html_url: string } | null;
};
export type GitHubData = {
  connected: boolean;
  error: string | null;
  issues: GitHubIssue[];
  pulls: GitHubIssue[];
  commits: GitHubCommit[];
  description: string;
  defaultBranch: string;
  checkedAt: string;
};
async function read<T>(path: string): Promise<T> {
  const r = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "Coders-for-Humanity",
    },
    next: { revalidate: 120 },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok)
    throw new Error(
      r.status === 403 || r.status === 429
        ? "GitHub’s public API is rate-limited. The repository remains available on GitHub."
        : r.status === 409
          ? "The repository has no commits yet."
          : `GitHub could not be reached (${r.status}).`,
    );
  return r.json();
}
export const getGitHub = cache(async (): Promise<GitHubData> => {
  const empty: GitHubData = {
    connected: false,
    error: null,
    issues: [],
    pulls: [],
    commits: [],
    description: "",
    defaultBranch: "main",
    checkedAt: new Date().toISOString(),
  };
  try {
    const repo = await read<{
      private: boolean;
      description: string | null;
      default_branch: string;
      size: number;
    }>("");
    if (repo.private)
      throw new Error("Only the public CFH repository can be shown.");
    const results = await Promise.allSettled([
      read<GitHubIssue[]>("/issues?state=open&per_page=50"),
      read<GitHubIssue[]>("/pulls?state=open&per_page=50"),
      read<GitHubCommit[]>("/commits?per_page=12"),
    ]);
    return {
      ...empty,
      connected: true,
      description: repo.description || "",
      defaultBranch: repo.default_branch || "main",
      issues:
        results[0].status === "fulfilled"
          ? results[0].value.filter((x) => !x.pull_request)
          : [],
      pulls: results[1].status === "fulfilled" ? results[1].value : [],
      commits: results[2].status === "fulfilled" ? results[2].value : [],
      error: results.some((r) => r.status === "rejected")
        ? "Some GitHub activity is unavailable. Open the repository for its current state."
        : null,
    };
  } catch (e) {
    return {
      ...empty,
      error: e instanceof Error ? e.message : "GitHub is unavailable.",
    };
  }
});
