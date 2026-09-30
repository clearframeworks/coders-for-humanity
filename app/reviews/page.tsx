import Link from "next/link";
import { PageIntro } from "@/components/ui";
import { WorkReview } from "@/components/work-review";
import { CommunityConnectionNote } from "@/components/community-feed";
import { communityReady, getViewer } from "@/lib/community";
import { createClient } from "@/lib/supabase";
import { getGitHub } from "@/lib/github";
import { GitHubReviewQueue } from "@/components/github-review-queue";

export const metadata = { title: "Independent reviews" };
type ReviewTask = {
  id: string;
  title: string;
  acceptance: string;
  objective: string;
  submission_evidence: string | null;
  submission_version: number;
  projects: { name: string; slug: string } | null;
  task_assignments: { user_id: string } | null;
};

export default async function ReviewsPage() {
  const [viewer, github] = await Promise.all([getViewer(), getGitHub()]);
  const heading = (
    <PageIntro
      eyebrow="INDEPENDENT REVIEW"
      title="Make the next handoff trustworthy."
    >
      Review the evidence, explain your findings, and accept only work that
      meets its agreed criteria.
    </PageIntro>
  );
  if (!viewer)
    return (
      <div className="page-content">
        {heading}
        <GitHubReviewQueue github={github} />
        {communityReady() ? (
          <div className="notice">
            <Link href="/login?next=/reviews">Sign in</Link> to see work
            awaiting your review.
          </div>
        ) : (
          <CommunityConnectionNote />
        )}
        <section className="hub-panel">
          <h2>Review is a responsibility.</h2>
          <p>
            Project maintainers review another contributor’s work. Authors
            cannot approve their own submissions, and every new submission
            invalidates the previous approval.
          </p>
          <Link className="text-link" href="/harness">
            Read the harness requirements →
          </Link>
        </section>
      </div>
    );
  const db = await createClient();
  const maintained = await db
    .from("project_maintainers")
    .select("project_id")
    .eq("user_id", viewer.id);
  if (maintained.error)
    throw new Error("Your maintainer responsibilities could not be loaded.");
  const projectIds = (maintained.data || []).map(
    (row) => row.project_id as string,
  );
  if (!projectIds.length)
    return (
      <div className="page-content">
        {heading}
        <GitHubReviewQueue github={github} />
        <section className="hub-panel">
          <h2>No maintainer responsibilities yet.</h2>
          <p>
            A project maintainer must be appointed before they can accept
            another contributor’s work. Joining a project does not grant review
            or release authority.
          </p>
          <Link className="text-link" href="/workspace">
            Return to your workspace →
          </Link>
        </section>
      </div>
    );
  const result = await db
    .from("tasks")
    .select(
      "id,title,acceptance,objective,submission_evidence,submission_version,projects(name,slug),task_assignments(user_id)",
    )
    .in("project_id", projectIds)
    .eq("status", "REVIEW")
    .eq("is_demo", false)
    .order("created_at", { ascending: true })
    .limit(100);
  if (result.error) throw new Error("The review queue could not be loaded.");
  const tasks = (result.data as unknown as ReviewTask[]).filter(
    (task) => task.task_assignments?.user_id !== viewer.id,
  );
  const approvals = tasks.length
    ? await db
        .from("reviews")
        .select("task_id,submission_version")
        .eq("reviewer_id", viewer.id)
        .eq("outcome", "APPROVED")
        .in(
          "task_id",
          tasks.map((task) => task.id),
        )
    : { data: [], error: null };
  if (approvals.error)
    throw new Error("Your review history could not be loaded.");
  return (
    <div className="page-content">
      {heading}
      <GitHubReviewQueue github={github} />
      <div className="notice">
        Only submissions in projects you maintain appear here. Your own assigned
        work is excluded. Task approval does not authorize a production release.
      </div>
      <div className="hub-stack">
        {tasks.length ? (
          tasks.map((task) => (
            <article
              className="hub-panel"
              key={`${task.id}:${task.submission_version}`}
            >
              <div className="hub-meta">
                {task.projects?.name} · Submission {task.submission_version}
              </div>
              <h2>
                <Link href={`/work/${task.id}`}>{task.title}</Link>
              </h2>
              <p>{task.objective}</p>
              <h3>Acceptance criteria</h3>
              <p className="hub-post-body">{task.acceptance}</p>
              {task.submission_evidence?.startsWith("https://") && (
                <p>
                  <a
                    className="text-link"
                    href={task.submission_evidence}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open submitted evidence ↗
                  </a>
                </p>
              )}
              <WorkReview
                taskId={task.id}
                version={task.submission_version}
                approved={(approvals.data || []).some(
                  (review) =>
                    review.task_id === task.id &&
                    review.submission_version === task.submission_version,
                )}
              />
            </article>
          ))
        ) : (
          <section className="hub-panel">
            <h2>No independent reviews waiting.</h2>
            <p>
              Submissions from other contributors in your projects will appear
              here when they are ready.
            </p>
            <Link className="text-link" href="/workspace">
              Return to your workspace →
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
