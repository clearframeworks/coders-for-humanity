import { ArrowUpRight, GitPullRequest } from "lucide-react";
import { repositoryUrl, type GitHubData } from "@/lib/github";

export function GitHubReviewQueue({ github }: { github: GitHubData }) {
  return (
    <section
      className="hub-panel repository-review-queue"
      aria-labelledby="code-review-title"
    >
      <div className="hub-section-head">
        <h2 id="code-review-title">Code changes on GitHub</h2>
        <a className="text-link" href={`${repositoryUrl}/pulls`}>
          All pull requests <ArrowUpRight size={15} />
        </a>
      </div>
      <p>
        Read a change, inspect its checks, and leave a review where the code
        lives. A CFH account isn’t needed to browse. GitHub requires sign-in to
        comment.
      </p>
      <p className="hub-meta">
        Public repository · refreshes about every two minutes
      </p>
      {github.error && (
        <div className="notice" role="status">
          {github.error}
        </div>
      )}
      {github.pulls.length ? (
        <div className="repository-review-list">
          {github.pulls.map((pull) => (
            <article className="repository-review-item" key={pull.id}>
              <div className="hub-row">
                <GitPullRequest size={19} aria-hidden="true" />
                <span className="hub-meta">
                  #{pull.number} · {pull.user.login} ·{" "}
                  {pull.draft ? "Draft" : "Open pull request"}
                </span>
              </div>
              <h3>
                <a href={pull.html_url}>{pull.title}</a>
              </h3>
              <div className="hub-row repository-review-actions">
                <a className="button" href={`${pull.html_url}/files`}>
                  Read the diff <ArrowUpRight size={14} />
                </a>
                <a className="text-link" href={`${pull.html_url}/checks`}>
                  Inspect checks
                </a>
                <a className="text-link" href={pull.html_url}>
                  Discussion & review
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : !github.error && github.connected ? (
        <p className="repository-empty">
          No open pull requests are listed. New code changes will appear here
          when they are proposed.
        </p>
      ) : null}
      <p className="form-help">
        This list does not grant approval or release access. GitHub enforces the
        repository’s checks and independent review requirements.
      </p>
    </section>
  );
}
