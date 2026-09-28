import Link from "next/link";
import { PageIntro } from "@/components/ui";
import { CommunityAction, WorkProgress } from "@/components/community-forms";
import { CommunityConnectionNote } from "@/components/community-feed";
import { communityReady, getViewer } from "@/lib/community";
import { createClient } from "@/lib/supabase";
import { WorkspaceNotebook } from "@/components/workspace-notebook";
export const metadata = { title: "My workspace" };
type Assigned = {
  task_id: string;
  tasks: {
    id: string;
    title: string;
    status: string;
    submission_evidence: string | null;
  } | null;
};
type Membership = {
  role: string;
  projects: { id: string; slug: string; name: string } | null;
};
type Saved = {
  post_id: string;
  community_posts: { id: string; title: string; body: string } | null;
};
export default async function Workspace() {
  const viewer = await getViewer();
  if (!viewer)
    return (
      <div className="page-content">
        <PageIntro eyebrow="MY WORKSPACE" title="Your place in the work.">
          Keep your commitments, handoffs, and conversations together.
        </PageIntro>
        {!communityReady() ? (
          <CommunityConnectionNote />
        ) : (
          <div className="notice">
            <Link href="/login?next=/workspace">Sign in</Link> to see your
            projects and assigned work.
          </div>
        )}
        <WorkspaceNotebook />
        <div className="hub-grid">
          <section className="hub-panel">
            <span className="eyebrow">01 / FIND YOUR PLACE</span>
            <h2>Pick a useful first contribution.</h2>
            <p>
              Find a task with clear acceptance criteria and a reviewer.
              Research, accessibility, documentation, and testing matter as much
              as code.
            </p>
            <Link className="button primary" href="/contribute">
              Find work →
            </Link>
          </section>
          <section className="hub-panel">
            <span className="eyebrow">02 / BRING THE CONTEXT</span>
            <h2>Start the conversation.</h2>
            <p>
              Explain what you want to work on and where you need help. A draft
              stays on this device until you choose to publish it.
            </p>
            <Link className="button" href="/discussions/new">
              Prepare a conversation →
            </Link>
          </section>
          <section className="hub-panel">
            <span className="eyebrow">03 / MAKE IT SAFE</span>
            <h2>Read the harness requirements.</h2>
            <p>
              A claimed task is not permission to release. Changes need
              evidence, independent review, and a controlled deployment.
            </p>
            <Link className="button" href="/harness">
              Open the harness →
            </Link>
          </section>
        </div>
      </div>
    );
  const db = await createClient();
  const [assigned, member, saved] = await Promise.all([
    db
      .from("task_assignments")
      .select("task_id,tasks(id,title,status,submission_evidence)")
      .eq("user_id", viewer.id),
    db
      .from("project_members")
      .select("role,projects(id,slug,name)")
      .eq("user_id", viewer.id),
    db
      .from("saved_posts")
      .select("post_id,community_posts(id,title,body)")
      .eq("user_id", viewer.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (assigned.error || member.error || saved.error)
    throw new Error("Your workspace could not be loaded. Please try again.");
  const tasks = assigned.data as unknown as Assigned[];
  const projects = member.data as unknown as Membership[];
  const posts = saved.data as unknown as Saved[];
  return (
    <div className="page-content">
      <PageIntro
        eyebrow="MY WORKSPACE"
        title={
          viewer.profile
            ? `${viewer.profile.name}’s workspace`
            : "Your workspace"
        }
      >
        Small commitments. Clear context. A useful handoff for the next person.
      </PageIntro>
      {!viewer.profile?.is_public && (
        <div className="notice">
          <Link href="/account">Publish your contributor profile</Link> to join
          projects and participate in discussions.
        </div>
      )}
      <div className="hub-row">
        <Link className="button primary" href="/contribute">
          Find work
        </Link>
        <Link className="button" href="/account">
          Edit profile
        </Link>
        <Link className="button" href="/inbox">
          Open inbox
        </Link>
        <Link className="button" href="/reviews">
          Review queue
        </Link>
      </div>
      <WorkspaceNotebook />
      <section className="hub-stack">
        <h2>My commitments</h2>
        {tasks.length ? (
          tasks.map(
            ({ task_id, tasks: task }) =>
              task && (
                <article className="hub-panel" key={task_id}>
                  <div className="hub-meta">{task.status.toLowerCase()}</div>
                  <h3>
                    <Link href={`/work/${task.id}`}>{task.title}</Link>
                  </h3>
                  <WorkProgress
                    id={task.id}
                    status={task.status}
                    evidence={task.submission_evidence || ""}
                  />
                  <Link className="text-link" href={`/work/${task.id}`}>
                    Full context and acceptance criteria →
                  </Link>
                </article>
              ),
          )
        ) : (
          <div className="hub-panel">
            <p>
              No work claimed yet. Choose something that fits the time you have,
              and leave the next person clear notes.
            </p>
            <Link className="text-link" href="/contribute">
              Browse available work →
            </Link>
          </div>
        )}
      </section>
      <section className="hub-stack">
        <h2>My projects</h2>
        {projects.length ? (
          projects.map(
            (p) =>
              p.projects && (
                <article className="hub-panel" key={p.projects.id}>
                  <div className="hub-meta">{p.role}</div>
                  <h3>
                    <Link href={`/projects/${p.projects.slug}`}>
                      {p.projects.name}
                    </Link>
                  </h3>
                </article>
              ),
          )
        ) : (
          <div className="hub-panel">
            <p>You haven’t joined a project yet.</p>
            <Link className="text-link" href="/projects">
              Explore project workspaces →
            </Link>
          </div>
        )}
      </section>
      <section className="hub-stack">
        <h2>Saved conversations</h2>
        {posts.length ? (
          posts.map((p) => (
            <article className="hub-panel" key={p.post_id}>
              {p.community_posts ? (
                <>
                  <h3>
                    <Link href={`/discussions/${p.post_id}`}>
                      {p.community_posts.title}
                    </Link>
                  </h3>
                  <p>{p.community_posts.body.slice(0, 220)}</p>
                </>
              ) : (
                <p>This conversation is no longer available.</p>
              )}
              <CommunityAction action="save" id={p.post_id} saved={false}>
                Remove saved conversation
              </CommunityAction>
            </article>
          ))
        ) : (
          <div className="hub-panel">
            <p>Save a conversation to return to its context later.</p>
            <Link className="text-link" href="/discussions">
              Open the commons →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
