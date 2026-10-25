import Link from "next/link";
import { getCatalog } from "@/lib/catalog";
import { PageIntro, DemoNote, EmptyState } from "@/components/ui";
export const metadata = { title: "Open problem library" };
export default async function Problems() {
  const c = await getCatalog();
  return (
    <div className="page-content">
      <PageIntro
        eyebrow="THE OPEN PROBLEM LIBRARY"
        title="Before a solution, a better question."
      >
        A problem belongs here even when software is not the answer. Help
        establish evidence, understand existing interventions, and identify what
        remains unknown.
      </PageIntro>
      {c.demo && <DemoNote />}
      <div className="problem-list">
        {c.problems.map((p, i) => (
          <Link key={p.id} href={`/problems/${p.slug}`}>
            <span className="problem-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <span className="card-kicker">
                {c.programs.find((x) => x.id === p.program_id)?.name}
              </span>
              <h3>{p.title}</h3>
              <p>{p.description}</p>
            </div>
            <span>↗</span>
          </Link>
        ))}
      </div>
      {!c.problems.length && (
        <EmptyState title="The library is open for questions">
          No problems have been published yet.
        </EmptyState>
      )}
      <div className="detail-actions">
        <Link className="button primary" href="/propose">
          Propose a problem ↗
        </Link>
      </div>
    </div>
  );
}
