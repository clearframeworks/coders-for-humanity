import Link from "next/link";
import { ArrowUpRight, FolderGit2, ShieldCheck } from "lucide-react";
import type { Catalog, Project } from "@/lib/types";
import { Badge } from "./ui";
import { TaskRow } from "./work-board";
import { CommunityFeed, CommunityConnectionNote } from "./community-feed";
import { CommunityAction } from "./community-forms";
import { getPosts, communityReady, getViewer } from "@/lib/community";
import { getGitHub, repositoryUrl } from "@/lib/github";
import { EditorialPhoto } from "./editorial-photo";

const tabs = [
  "Overview",
  "Conversations",
  "Workboard",
  "Knowledge",
  "Code",
  "Members",
];
export async function ProjectRoom({
  project: p,
  catalog: c,
  tab: requested,
}: {
  project: Project;
  catalog: Catalog;
  tab?: string;
}) {
  const tab = tabs.find((x) => x.toLowerCase() === requested) || "Overview";
  const work = c.tasks.filter((x) => x.project_id === p.id);
  const [posts, github, viewer] = await Promise.all([
    tab === "Conversations" ? getPosts(p.id) : Promise.resolve([]),
    tab === "Code" ? getGitHub() : Promise.resolve(null),
    getViewer(),
  ]);
  const root = `/projects/${p.slug}`;
  return (
    <div className="page-content">
      {tab === "Overview" && (
        <EditorialPhoto name="workshop" className="project-cover" priority />
      )}
      <div className="project-room-header">
        <div className="page-intro">
          <div className="eyebrow">
            CIVIC INFRASTRUCTURE / PROJECT WORKSPACE
          </div>
          <h1>{p.name}</h1>
          <div className="lede">{p.summary}</div>
        </div>
        <div>
          <Badge status={p.status} />
        </div>
      </div>
      <nav className="hub-tabs project-tabs" aria-label="Project workspace">
        {tabs.map((t) => (
          <Link
            key={t}
            href={`${root}?tab=${t.toLowerCase()}`}
            aria-current={t === tab ? "page" : undefined}
            className={t === tab ? "selected" : ""}
          >
            {t}
            {t === "Workboard" ? ` · ${work.length}` : ""}
          </Link>
        ))}
      </nav>
      <div className="project-room-grid">
        <div>
          {tab === "Overview" && (
            <>
              <section className="hub-panel">
                <span className="eyebrow">SHARED PURPOSE</span>
                <h2 style={{ marginTop: 12 }}>
                  Make the next person’s contribution easier.
                </h2>
                <p>{p.problem}</p>
                <h3>Our first goal</h3>
                <p>{p.objective}</p>
                <div className="notice">
                  Founding phase. We are recruiting the first human maintainers
                  and reviewers. No community pilot or impact result has been
                  completed.
                </div>
              </section>
              <div className="project-context-grid">
                <section className="hub-panel">
                  <h3>What exists</h3>
                  <p>
                    A public workspace, founding workboard, local drafts, GitHub
                    activity reader, and database migrations with permission
                    tests.
                  </p>
                  <Link className="text-link" href={`${root}?tab=code`}>
                    Inspect the code connection ↗
                  </Link>
                </section>
                <section className="hub-panel">
                  <h3>What needs people</h3>
                  <p>
                    Independent security review, real-user testing, moderation,
                    accessible onboarding, and a complete first contribution.
                  </p>
                  <Link className="text-link" href={`${root}?tab=workboard`}>
                    Explore the founding work ↗
                  </Link>
                </section>
              </div>
              <section className="hub-panel" style={{ marginTop: 18 }}>
                <h2>Shared agreements</h2>
                <ol className="room-agreements">
                  <li>Start with the people and the problem.</li>
                  <li>Agree a small deliverable and how to verify it.</li>
                  <li>Ask for help without losing your place.</li>
                  <li>Have someone else review the work.</li>
                  <li>Leave context, evidence, and the next useful step.</li>
                </ol>
                <Link className="text-link" href="/constitution">
                  Read the constitution ↗
                </Link>
              </section>
            </>
          )}
          {tab === "Conversations" && (
            <>
              <div className="hub-section-head">
                <h2>Conversations in this project</h2>
                <Link
                  className="button primary"
                  href={`/discussions/new?project=${p.id}`}
                >
                  Start a conversation
                </Link>
              </div>
              {!communityReady() && <CommunityConnectionNote />}
              <CommunityFeed posts={posts} />
            </>
          )}
          {tab === "Workboard" && (
            <>
              <div className="hub-section-head">
                <h2>Founding work</h2>
                <Link href={`/contribute?project=${p.id}&view=Kanban`}>
                  Board view ↗
                </Link>
              </div>
              <p>
                Open work is an invitation to agree scope. Dependencies,
                acceptance criteria, and review expectations are recorded in
                each task.
              </p>
              <div className="task-list">
                {work.map((task) => (
                  <TaskRow key={task.id} task={task} catalog={c} />
                ))}
              </div>
            </>
          )}
          {tab === "Knowledge" && (
            <>
              <section className="hub-panel">
                <h2>The project memory</h2>
                <p>
                  Keep lasting context here and link the conversation that
                  changed it. A chat thread should never be the only place a
                  decision exists.
                </p>
                <a className="button" href={`${root}/brief`} download>
                  Download project brief (.md)
                </a>
                <p className="form-help">
                  Take the goal, task briefs, acceptance criteria, and review
                  requirements with you. The download contains public project
                  context.
                </p>
                <div className="brief-steps">
                  <Link href="/docs/contributor-guide">
                    <span>01</span>
                    <div>
                      <strong>Contributor handbook</strong>
                      <small>Scope, evidence, reviews, and conduct</small>
                    </div>
                    <ArrowUpRight size={16} />
                  </Link>
                  <Link href="/harness">
                    <span>02</span>
                    <div>
                      <strong>Harness and release gates</strong>
                      <small>Trust boundaries and independent review</small>
                    </div>
                    <ArrowUpRight size={16} />
                  </Link>
                  <Link href="/docs/maintainers">
                    <span>03</span>
                    <div>
                      <strong>Maintainer guide</strong>
                      <small>Stewardship and continuity</small>
                    </div>
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              </section>
              <section className="hub-panel">
                <h2>Leave a useful handoff</h2>
                <p>The next person should not have to reconstruct your work.</p>
                <div className="handoff-template">
                  Goal — What were you trying to achieve?{"\n"}Context — Which
                  problem, decision, and task does this serve?{"\n"}Changes —
                  What changed, and where?{"\n"}Evidence — What did you test?
                  Link the result.{"\n"}Open questions — What is uncertain or
                  blocked?{"\n"}Next step — What should the next person do?
                  {"\n"}Review — Who needs to review before acceptance?
                </div>
                <Link
                  className="button"
                  href="/workspace"
                  style={{ marginTop: 16 }}
                >
                  Prepare a handoff
                </Link>
              </section>
              <section className="hub-panel">
                <h2>Architecture & constraints</h2>
                <p>{p.architecture}</p>
                <p>{p.evidence}</p>
              </section>
            </>
          )}
          {tab === "Code" && github && (
            <section className="hub-panel">
              <div className="hub-row">
                <FolderGit2 size={25} />
                <div>
                  <h2 style={{ marginBottom: 4 }}>The shared codebase</h2>
                  <a className="text-link" href={repositoryUrl}>
                    clearframeworks / coders-for-humanity ↗
                  </a>
                </div>
              </div>
              <p style={{ marginTop: 20 }}>
                GitHub holds the code, issues, pull requests, and releases. This
                workspace holds the people, context, discussions, and handoffs
                around it.
              </p>
              {github.error && <div className="notice">{github.error}</div>}
              <h3>Recent commits</h3>
              {github.commits.length ? (
                github.commits.map((commit) => (
                  <a
                    className="github-event"
                    key={commit.sha}
                    href={commit.html_url}
                  >
                    <code>{commit.sha.slice(0, 7)}</code>
                    <div>
                      <strong>{commit.commit.message.split("\n")[0]}</strong>
                      <p>{commit.author?.login || commit.commit.author.name}</p>
                    </div>
                    <ArrowUpRight size={16} />
                  </a>
                ))
              ) : (
                <p>
                  No public commits are available yet. The repository exists;
                  the source upload awaits owner approval.
                </p>
              )}
              <div className="hub-row">
                <a className="button" href={`${repositoryUrl}/issues`}>
                  Issues ↗
                </a>
                <a className="button" href={`${repositoryUrl}/pulls`}>
                  Pull requests ↗
                </a>
                <a className="button" href={repositoryUrl}>
                  Repository ↗
                </a>
              </div>
            </section>
          )}
          {tab === "Members" && (
            <section className="hub-panel">
              <h2>A founding team, built on consent.</h2>
              <p>
                No human team has been appointed here yet. The first roles to
                fill are project maintainer, independent harness reviewer,
                community moderator, and accessibility reviewer.
              </p>
              <p>
                Joining the project grants contribution access only. Reviewer
                and release responsibilities are explicitly appointed and can be
                revoked.
              </p>
              <Link className="button" href="/people">
                Find collaborators
              </Link>
              {viewer?.profile && communityReady() ? (
                <CommunityAction action="join" id={p.id}>
                  Join this project
                </CommunityAction>
              ) : (
                <p className="form-help">
                  Project membership opens when verified member accounts are
                  available.
                </p>
              )}
            </section>
          )}
        </div>
        <aside className="project-room-aside">
          <section className="hub-panel">
            <span className="eyebrow">PROJECT CONTEXT</span>
            <h3 style={{ marginTop: 18 }}>Community platform</h3>
            <p>
              Stage: founding build
              <br />
              License: MIT
              <br />
              Maintainer: recruiting
              <br />
              Security reviewer: recruiting
            </p>
            <a className="button" href="https://cfh.retehost.com">
              Open live workspace ↗
            </a>
            <a className="button" href={repositoryUrl}>
              Open GitHub ↗
            </a>
            <a className="button" href={`${root}/brief`} download>
              Download project brief
            </a>
          </section>
          <section className="hub-panel">
            <ShieldCheck size={22} />
            <h3 style={{ marginTop: 14 }}>Review before release</h3>
            <p>
              Submitting or accepting a task never grants deployment authority.
              Security-sensitive changes need specialist review.
            </p>
            <Link className="text-link" href="/harness">
              Read the gates ↗
            </Link>
          </section>
          <section className="hub-panel">
            <h3>Success means</h3>
            <p>
              One person can pick up useful work, finish it with help, have it
              independently reviewed, and hand the context to someone else.
            </p>
            <p>Then we make that repeatable.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
