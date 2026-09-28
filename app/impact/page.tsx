import Link from "next/link";
import { PageIntro, EmptyState } from "@/components/ui";
import { impactRecords } from "@/lib/records";
export const metadata = { title: "Verified impact" };
export default async function Impact() {
  const records = await impactRecords();
  return (
    <div className="page-content">
      <PageIntro
        eyebrow="ACCOUNTABILITY TO HUMAN OUTCOMES"
        title="Useful is something we have to prove."
      >
        Impact reporting connects a result to evidence, methodology, and the
        people or systems it benefits.
      </PageIntro>
      {!records.length ? (
        <EmptyState title="No verified impact data yet">
          There are no reliable outcome records to report. Example projects,
          code activity, and contributor counts are not evidence of human
          impact.
        </EmptyState>
      ) : (
        records.map((r) => (
          <article key={r.id} className="form-card">
            <h2>
              {r.value} {r.project_metrics.unit}
            </h2>
            <p>
              {r.project_metrics.name} ·{" "}
              <Link href={`/projects/${r.project_metrics.projects.slug}`}>
                {r.project_metrics.projects.name}
              </Link>
            </p>
            <p>Method: {r.project_metrics.methodology}</p>
            <p>
              Measured: {r.measured_at}. Limitations: {r.limitations}
            </p>
            <a className="text-link" href={r.source_url}>
              Verify the source ↗
            </a>
          </article>
        ))
      )}
      <div className="prose">
        <h2>Every future claim needs a source.</h2>
        <p>
          Publish the observation period, baseline, method, limitations, and
          verification record. We will distinguish active deployments and
          organizations using a system from documented outcomes for people and
          communities.
        </p>
        <Link href="/docs/impact-reporting">Read our reporting standard ↗</Link>
      </div>
    </div>
  );
}
