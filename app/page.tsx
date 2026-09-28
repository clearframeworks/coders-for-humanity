import Link from "next/link";
import { ArrowRight, ArrowUpRight, Code2, Clock3, Check } from "lucide-react";
import { getCatalog } from "@/lib/catalog";
import { SectionHead, ProjectCard, DemoNote } from "@/components/ui";
import { World } from "@/components/world";
export default async function Home() {
  const catalog = await getCatalog();
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span />
            TECHNOLOGY IN SERVICE OF PEOPLE
          </div>
          <h1>
            Open engineering for
            <br />
            the human problems
            <br />
            <em>worth solving.</em>
          </h1>
          <p>
            Developers, researchers, designers, and domain experts.
            <br className="desktop-break" /> Working together to build
            technology that belongs to everyone.
          </p>
          <div className="hero-actions">
            <Link href="/contribute" className="button primary">
              Find work <ArrowUpRight size={17} />
            </Link>
            <Link href="/projects" className="button secondary">
              Explore projects <ArrowRight size={17} />
            </Link>
          </div>
          <Link className="quiet-link" href="/propose">
            See a problem worth solving? Propose it <ArrowUpRight size={14} />
          </Link>
        </div>
        <World />
      </section>
      <div className="principle-strip">
        <span>
          <Check size={15} />
          Open source, always
        </span>
        <span>
          <Check size={15} />
          Public benefit first
        </span>
        <span>
          <Check size={15} />
          No commercial ownership of the institution
        </span>
        <Link href="/constitution">
          Our constitution <ArrowUpRight size={14} />
        </Link>
      </div>
      <section className="home-section">
        <SectionHead
          number="01"
          title="Work with a purpose"
          href="/projects"
          label="Explore all projects"
        />
        <p className="section-caption">
          Small contributions. Shared infrastructure. Meaningful possibilities.
        </p>
        {catalog.demo && <DemoNote />}
        <div className="project-grid">
          {catalog.projects.slice(0, 3).map((p) => (
            <ProjectCard key={p.id} project={p} catalog={catalog} />
          ))}
        </div>
        {!catalog.projects.length && (
          <p>
            No projects have been published yet.{" "}
            <Link href="/propose">Propose a problem.</Link>
          </p>
        )}
      </section>
      <section className="contribution-callout">
        <div className="callout-icon">
          <Code2 size={27} />
        </div>
        <div>
          <div className="eyebrow">YOUR SKILLS HAVE A PLACE HERE</div>
          <h2>A better tomorrow is a team effort.</h2>
          <p>
            You don’t need to be a coder. You just need a way to contribute.
          </p>
          <div className="contribution-chips">
            <Link href="/contribute?effort=%3C+1+hour">
              <Clock3 size={13} />I have 30 minutes
            </Link>
            <Link href="/contribute?technology=React">I know React</Link>
            <Link href="/contribute?discipline=UX%2FUI">I’m a designer</Link>
            <Link href="/contribute?discipline=Research">I’m a researcher</Link>
            <Link href="/contribute?discipline=Domain+Expertise">
              I work in logistics
            </Link>
            <Link href="/contribute?discipline=Testing">I can test</Link>
            <Link href="/contribute?discipline=Translation">
              I can translate
            </Link>
            <Link href="/contribute?level=First+Contribution">
              I’m not a coder
            </Link>
          </div>
        </div>
        <Link
          className="circle-link"
          href="/contribute"
          aria-label="Find your contribution"
        >
          <ArrowUpRight />
        </Link>
      </section>
      <section className="home-section">
        <SectionHead
          number="02"
          title="Start with the problem"
          href="/problems"
          label="Open problem library"
        />
        <div className="problem-list">
          {catalog.problems.map((p, i) => (
            <Link href={`/problems/${p.slug}`} key={p.id}>
              <span className="problem-number">0{i + 1}</span>
              <div>
                <span className="card-kicker">
                  {catalog.programs.find((x) => x.id === p.program_id)?.name}
                  {p.is_demo ? " · Example question" : ""}
                </span>
                <h3>{p.title}</h3>
              </div>
              <ArrowUpRight size={21} />
            </Link>
          ))}
        </div>
      </section>
      <section className="process-section">
        <div>
          <div className="eyebrow">A RESPONSIBLE PATH FROM IDEA TO IMPACT</div>
          <h2>
            Understand first.
            <br />
            Build what helps.
            <br />
            <em>Stay to maintain it.</em>
          </h2>
          <Link className="text-link" href="/docs/lifecycle">
            Our project lifecycle <ArrowUpRight size={16} />
          </Link>
        </div>
        <ol>
          {[
            "Identify the problem",
            "Research & specify",
            "Build & verify",
            "Pilot & measure",
            "Deploy & steward",
          ].map((s, i) => (
            <li key={s}>
              <span>0{i + 1}</span>
              {s}
              <ArrowRight size={16} />
            </li>
          ))}
        </ol>
      </section>
      <section className="closing-note">
        <span className="eyebrow">THE FOUNDING QUESTION</span>
        <h2>
          What could we build if
          <br />
          monetization wasn’t the objective?
        </h2>
        <p>
          No contributor owns what we build. No corporation owns what we build.
          <br />
          Coders for Humanity does not exist to own what we build.
        </p>
        <strong>
          We build it, maintain it, document it, and give it away.
        </strong>
        <Link href="/mission" className="text-link">
          Read our mission <ArrowUpRight size={16} />
        </Link>
      </section>
    </div>
  );
}
