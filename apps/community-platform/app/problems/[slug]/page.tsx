import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/catalog";
import { PageIntro, DemoNote } from "@/components/ui";
export default async function Problem({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [c, { slug }] = await Promise.all([getCatalog(), params]);
  const p = c.problems.find((p) => p.slug === slug);
  if (!p) notFound();
  return (
    <div className="page-content">
      <PageIntro eyebrow="OPEN RESEARCH QUESTION" title={p.title}>
        {p.description}
      </PageIntro>
      {p.is_demo && <DemoNote />}
      <div className="prose">
        {[
          ["Evidence", p.evidence],
          ["People affected", p.affected],
          ["Geographic relevance", p.geography],
          ["Existing interventions", p.interventions],
          ["Open research questions", p.questions],
        ].map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
        <section>
          <h2>Related work in this program</h2>
          {c.projects
            .filter((x) => x.program_id === p.program_id)
            .map((x) => (
              <p key={x.id}>
                <Link href={`/projects/${x.slug}`}>{x.name} ↗</Link>
              </p>
            ))}
        </section>
        <section>
          <h2>Interested contributors</h2>
          <p>
            No expressions of interest are recorded. You can contribute through
            an available research task or submit additional evidence in a
            proposal.
          </p>
          <Link href={`/contribute?program=${p.program_id}`}>
            Find related work ↗
          </Link>
        </section>
      </div>
    </div>
  );
}
