import Link from "next/link";
import {
  ArrowUpRight,
  GitPullRequest,
  ShieldCheck,
  LockKeyhole,
  Users,
  Check,
} from "lucide-react";
import { humanWork, releaseGates } from "@/lib/harness";
import styles from "./harness.module.css";

export const metadata = { title: "Harness · Review and release" };
const repo = "https://github.com/clearframeworks/coders-for-humanity";
export default function HarnessPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>
            <ShieldCheck size={16} /> THE HARNESS
          </div>
          <h1>
            Open contribution.
            <br />
            Accountable release.
          </h1>
          <p>
            A home for the people who test, review and protect the work.
            Everyone can propose a change. Shipping it requires independent
            evidence and authority.
          </p>
        </div>
        <a className={styles.action} href={`${repo}/pulls`}>
          <GitPullRequest size={17} /> Review pull requests{" "}
          <ArrowUpRight size={15} />
        </a>
      </header>
      <div className={styles.notice}>
        <LockKeyhole size={20} />
        <div>
          <strong>Release authority is separate from membership.</strong>
          <p>
            Joining a project, claiming work or completing a task never grants
            merge access, production credentials or permission to deploy.
          </p>
        </div>
      </div>

      <section aria-labelledby="gates-title">
        <div className={styles.sectionHead}>
          <h2 id="gates-title">The path to production</h2>
          <span>Required operating policy</span>
        </div>
        <div className={styles.gates}>
          {releaseGates.map((gate, index) => (
            <article key={gate.id}>
              <span className={styles.step}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{gate.name}</h3>
              <span className={styles.owner}>{gate.owner}</span>
              <p>{gate.evidence}</p>
            </article>
          ))}
        </div>
      </section>

      <div className={styles.columns}>
        <section className={styles.panel} aria-labelledby="evidence-title">
          <h2 id="evidence-title">What is established</h2>
          <ul className={styles.evidence}>
            <li>
              <Check size={16} />
              <div>
                <strong>Protected application actions</strong>
                <p>
                  Server verification, validated inputs and database access
                  policies are in source. Hosted behavior still requires
                  operator verification.
                </p>
              </div>
              <span>In source</span>
            </li>
            <li>
              <Check size={16} />
              <div>
                <strong>Checks defined for each pull request</strong>
                <p>
                  Known secret patterns, dependency audit, type checks, database
                  tests, build and browser tests. A definition is not a
                  successful run.
                </p>
              </div>
              <span>In source</span>
            </li>
            <li>
              <LockKeyhole size={16} />
              <div>
                <strong>Repository and hosting enforcement</strong>
                <p>
                  Required reviews, protected branches and production approvers
                  must be verified in the providers. No live enforcement status
                  is claimed here.
                </p>
              </div>
              <span>Verify setup</span>
            </li>
            <li>
              <Users size={16} />
              <div>
                <strong>Independent harness reviewers</strong>
                <p>
                  Security, maintainer and release roles need named, consenting
                  people. This page does not invent a staffed team.
                </p>
              </div>
              <span>Recruiting</span>
            </li>
          </ul>
          <a className={styles.textLink} href={`${repo}/actions`}>
            View actual workflow runs <ArrowUpRight size={14} />
          </a>
        </section>
        <section className={styles.panel} aria-labelledby="review-title">
          <h2 id="review-title">Review the change, not the reputation.</h2>
          <p>
            New and experienced contributors follow the same review boundary.
            Passing tests never substitutes for an independent review.
          </p>
          <ul className={styles.rules}>
            <li>Author cannot approve their own contribution.</li>
            <li>
              Approvals and checks refer to the exact commit. New changes
              require fresh evidence.
            </li>
            <li>
              Authentication, permissions, data, dependencies and CI changes
              receive security review.
            </li>
            <li>
              Untrusted contribution code runs without production secrets.
            </li>
            <li>
              Release records include a preview, approvals and rollback
              coordinate.
            </li>
          </ul>
          <Link className={styles.textLink} href="/docs/security">
            Read the security guidance <ArrowUpRight size={14} />
          </Link>
        </section>
      </div>

      <section aria-labelledby="work-title">
        <div className={styles.sectionHead}>
          <div>
            <h2 id="work-title">Build the team. Prove the boundary.</h2>
            <p>
              Real founding work, ready for humans to take over. Roles remain
              unassigned until someone accepts them.
            </p>
          </div>
          <Link className={styles.textLink} href="/work">
            All open work <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className={styles.work}>
          {humanWork
            .filter((task) =>
              ["Security", "Testing", "DevOps"].includes(task.discipline),
            )
            .map((task) => (
              <article key={task.id}>
                <div className={styles.tags}>
                  <span>{task.discipline}</span>
                  <span>{task.effort}</span>
                </div>
                <h3>
                  <Link href={`/work/${task.id}`}>
                    {task.title} <ArrowUpRight size={15} />
                  </Link>
                </h3>
                <p>{task.objective}</p>
                <details>
                  <summary>Acceptance criteria</summary>
                  <p>{task.acceptance}</p>
                  <p>
                    <strong>Needs:</strong> {task.dependencies}
                  </p>
                </details>
                <Link className={styles.textLink} href={`/work/${task.id}`}>
                  Open work brief <ArrowUpRight size={14} />
                </Link>
              </article>
            ))}
        </div>
      </section>
      <aside className={styles.reporting}>
        <h2>Found a vulnerability?</h2>
        <p>
          Do not post credentials, exploit details or personal data in a public
          conversation. A staffed private reporting route is not yet verified.
          Contact a known repository owner privately before sending sensitive
          details.
        </p>
        <a className={styles.textLink} href={`${repo}/security/policy`}>
          Repository security policy <ArrowUpRight size={14} />
        </a>
      </aside>
    </div>
  );
}
