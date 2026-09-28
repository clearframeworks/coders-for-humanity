import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  GitPullRequest,
  GitCommitHorizontal,
  CircleDot,
  MessagesSquare,
  ShieldCheck,
  FolderGit2,
  Pin,
  Sparkles,
} from "lucide-react";
import { getCatalog } from "@/lib/catalog";
import { getGitHub, repositoryUrl } from "@/lib/github";
import { getPosts, communityReady } from "@/lib/community";
import { CommunityFeed } from "@/components/community-feed";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const [catalog, github, posts] = await Promise.all([
    getCatalog(),
    params.tab === "code" ? getGitHub() : Promise.resolve(null),
    getPosts(),
  ]);
  const tab = ["work", "code"].includes(params.tab || "")
    ? params.tab
    : "community";
  return (
    <div className="page-content community-home">
      <header className="hub-heading">
        <div>
          <div className="eyebrow">CODERS FOR HUMANITY / THE COMMONS</div>
          <h1>Good work starts with people.</h1>
          <p>
            Find your people. Share what you know. Build something useful
            together.
          </p>
        </div>
        <Link className="button primary" href="/discussions/new">
          <MessagesSquare size={16} /> Start a conversation
        </Link>
      </header>
      <div className="hub-layout">
        <div className="hub-main">
          <section className="founding-banner">
            <div className="hub-meta">
              <span className="hub-tag">FOUNDING PROJECT</span>
              <span>Help shape this space</span>
            </div>
            <h2>
              We’re building the place
              <br />
              where we build together.
            </h2>
            <p>
              The first project is this community. Bring your skills to the
              workspace, its safeguards, and the way we hand work from one
              person to the next.
            </p>
            <div className="hub-row">
              <Link
                className="button primary"
                href="/projects/community-platform"
              >
                Enter the project <ArrowRight size={16} />
              </Link>
              <Link className="text-link" href="/contribute">
                Find your first task <ArrowUpRight size={15} />
              </Link>
            </div>
            <div className="banner-mark" aria-hidden="true">
              {"{ }"}
            </div>
          </section>
          <nav className="hub-tabs" aria-label="Community view">
            {[
              ["community", "Community"],
              ["work", "Open work"],
              ["code", "GitHub activity"],
            ].map(([id, label]) => (
              <Link
                key={id}
                href={id === "community" ? "/" : `/?tab=${id}`}
                className={tab === id ? "selected" : ""}
                aria-current={tab === id ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          {tab === "community" && (
            <>
              <article className="hub-panel founding-note">
                <div className="hub-row">
                  <div className="hub-avatar">
                    <Pin size={19} />
                  </div>
                  <div>
                    <strong>Start here</strong>
                    <div className="hub-meta">
                      Founding brief · Shared context
                    </div>
                  </div>
                  <span className="hub-tag pushed">PINNED</span>
                </div>
                <h2>A thousand contributors. One shared understanding.</h2>
                <p>
                  Each project holds its purpose, decisions, conversations, and
                  work in one place. Take a task you can finish, ask for help
                  early, and leave enough context for the next person.
                </p>
                <div className="brief-steps">
                  <Link href="/projects/community-platform">
                    <span>01</span>
                    <div>
                      <strong>Understand the project</strong>
                      <small>Read the problem and current goals</small>
                    </div>
                    <ArrowUpRight size={16} />
                  </Link>
                  <Link href="/contribute">
                    <span>02</span>
                    <div>
                      <strong>Find a useful contribution</strong>
                      <small>Code, research, design, testing, or care</small>
                    </div>
                    <ArrowUpRight size={16} />
                  </Link>
                  <Link href="/harness">
                    <span>03</span>
                    <div>
                      <strong>Build trust through review</strong>
                      <small>Evidence, independent review, safe releases</small>
                    </div>
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              </article>
              {posts.length ? (
                <CommunityFeed posts={posts} />
              ) : (
                <section className="hub-panel conversation-empty">
                  <MessagesSquare size={25} />
                  <div>
                    <h2>Make room for the first conversation.</h2>
                    <p>
                      {communityReady()
                        ? "Ask a question, introduce what you can help with, or share a project update."
                        : "Shared posting opens after member accounts and moderation are connected. You can prepare a conversation draft now; it stays in your browser."}
                    </p>
                    <Link className="text-link" href="/discussions/new">
                      Draft a conversation <ArrowRight size={15} />
                    </Link>
                  </div>
                </section>
              )}
            </>
          )}
          {tab === "work" && (
            <section className="hub-panel">
              <div className="hub-section-head">
                <h2>Work ready for human ownership</h2>
                <Link href="/contribute">All tasks ↗</Link>
              </div>
              <p>
                These are the founding backlog. Review the dependencies and
                arrange a reviewer before starting.
              </p>
              <div className="compact-work">
                {catalog.tasks.map((task, i) => (
                  <Link key={task.id} href={`/work/${task.id}`}>
                    <span className="work-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3>{task.title}</h3>
                      <p>
                        {task.discipline} · {task.effort}
                      </p>
                    </div>
                    <ArrowUpRight size={16} />
                  </Link>
                ))}
              </div>
            </section>
          )}
          {tab === "code" && github && (
            <section className="hub-panel">
              <div className="hub-section-head">
                <h2>From the repository</h2>
                <a href={repositoryUrl}>Open GitHub ↗</a>
              </div>
              <p className="hub-meta">
                Public GitHub activity · refreshes about every two minutes
              </p>
              {github.error && <div className="notice">{github.error}</div>}
              <div className="github-counts">
                <span>
                  <CircleDot size={16} />
                  {github.connected ? github.issues.length : "—"} open issues
                </span>
                <span>
                  <GitPullRequest size={16} />
                  {github.connected ? github.pulls.length : "—"} pull requests
                </span>
              </div>
              {github.commits.length ? (
                github.commits.map((c) => (
                  <a className="github-event" key={c.sha} href={c.html_url}>
                    <GitCommitHorizontal size={20} />
                    <div>
                      <strong>{c.commit.message.split("\n")[0]}</strong>
                      <p>
                        {c.author?.login || c.commit.author.name} ·{" "}
                        {c.sha.slice(0, 7)}
                      </p>
                    </div>
                    <ArrowUpRight size={16} />
                  </a>
                ))
              ) : (
                <div className="quiet-empty">
                  <GitCommitHorizontal size={25} />
                  <p>
                    No public commits are available in this feed yet. The source
                    upload is pending owner approval.
                  </p>
                </div>
              )}
              {github.issues.map((issue) => (
                <a
                  className="github-event"
                  key={issue.id}
                  href={issue.html_url}
                >
                  <CircleDot size={18} />
                  <div>
                    <strong>{issue.title}</strong>
                    <p>
                      #{issue.number} · {issue.user.login}
                    </p>
                  </div>
                  <ArrowUpRight size={16} />
                </a>
              ))}
            </section>
          )}
        </div>
        <aside className="hub-rail" aria-label="Community context">
          <section className="rail-section">
            <div className="hub-section-head">
              <h2>Your starting point</h2>
              <Sparkles size={17} />
            </div>
            <p>There’s a place here for more than code.</p>
            <Link
              className="rail-action"
              href="/contribute?discipline=Security"
            >
              <ShieldCheck size={18} />
              <span>
                Help make it safe<small>Join the harness work</small>
              </span>
              <ArrowUpRight size={14} />
            </Link>
            <Link
              className="rail-action"
              href="/contribute?discipline=Documentation"
            >
              <MessagesSquare size={18} />
              <span>
                Make work understandable<small>Documentation & handoffs</small>
              </span>
              <ArrowUpRight size={14} />
            </Link>
            <Link className="rail-action" href="/workspace">
              <FolderGit2 size={18} />
              <span>
                Set up your workspace<small>Prepare your contribution</small>
              </span>
              <ArrowUpRight size={14} />
            </Link>
          </section>
          <section className="rail-section">
            <div className="hub-section-head">
              <h2>Active project</h2>
              <span className="hub-count">1</span>
            </div>
            <Link className="rail-project" href="/projects/community-platform">
              <div className="project-monogram">{"</>"}</div>
              <div>
                <strong>Community platform</strong>
                <p>Civic infrastructure</p>
              </div>
            </Link>
            <div className="rail-project-status">
              <span className="status-dot" /> Founding phase
              <span>{catalog.tasks.length} tasks</span>
            </div>
          </section>
          <section className="rail-section harness-callout">
            <ShieldCheck size={24} />
            <h2>
              Open contribution.
              <br />
              Deliberate release.
            </h2>
            <p>
              Anyone can contribute. Changes need evidence, independent review,
              and release approval before reaching people.
            </p>
            <Link className="text-link" href="/harness">
              Meet the harness model <ArrowRight size={15} />
            </Link>
          </section>
          <div className="rail-foot">
            <Link href="/mission">Our purpose</Link>
            <Link href="/governance">Governance</Link>
            <Link href="/transparency">Transparency</Link>
            <span>Open source · Shared responsibility</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
