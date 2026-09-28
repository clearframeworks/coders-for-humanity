import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/catalog";
import { PageIntro, Badge, DemoNote } from "@/components/ui";
import { ClaimButton } from "@/components/claim-button";
export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [c, { id }] = await Promise.all([getCatalog(), params]);
  const t = c.tasks.find((t) => t.id === id);
  if (!t) notFound();
  const p = c.projects.find((p) => p.id === t.project_id);
  return (
    <div className="page-content">
      <PageIntro
        eyebrow={`${t.discipline.toUpperCase()} / CONTRIBUTION TASK`}
        title={t.title}
      >
        {p && <Link href={`/projects/${p.slug}`}>{p.name} ↗</Link>}
      </PageIntro>
      {t.is_demo && <DemoNote />}
      <dl className="metadata-grid">
        <div>
          <dt>Status</dt>
          <dd>
            <Badge status={t.status} />
          </dd>
        </div>
        <div>
          <dt>Estimated effort</dt>
          <dd>{t.effort}</dd>
        </div>
        <div>
          <dt>Skill level</dt>
          <dd>{t.level}</dd>
        </div>
        <div>
          <dt>Technology</dt>
          <dd>{t.technology}</dd>
        </div>
        <div>
          <dt>Assigned contributor</dt>
          <dd>{t.assignee}</dd>
        </div>
        <div>
          <dt>Reviewer</dt>
          <dd>{t.reviewer}</dd>
        </div>
      </dl>
      <div className="prose">
        {[
          ["Objective", t.objective],
          ["Context", t.context],
          ["Acceptance criteria", t.acceptance],
          ["Dependencies", t.dependencies],
        ].map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
        <section>
          <h2>Repository & issue</h2>
          {t.issue_url ? (
            <a href={t.issue_url} rel="noreferrer">
              Open linked GitHub issue ↗
            </a>
          ) : (
            <p>No repository issue is linked yet.</p>
          )}
        </section>
        <ClaimButton id={t.id} demo={t.is_demo} status={t.status} />
      </div>
    </div>
  );
}
