import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/catalog";
import { PageIntro, Badge, DemoNote } from "@/components/ui";
export default async function Decision({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [c, { id }] = await Promise.all([getCatalog(), params]);
  const d = c.decisions.find((d) => d.id === id);
  if (!d) notFound();
  return (
    <div className="page-content">
      <PageIntro eyebrow="PUBLIC DECISION RECORD" title={d.title}>
        <Badge status={d.status} />
      </PageIntro>
      {d.is_demo && <DemoNote />}
      <div className="prose">
        {[
          ["Context", d.context],
          ["Decision", d.decision],
          ["Consequences", d.consequences],
        ].map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
        <p>
          {d.decided_at
            ? `Recorded on ${d.decided_at}`
            : "No adoption date is recorded."}
        </p>
      </div>
    </div>
  );
}
