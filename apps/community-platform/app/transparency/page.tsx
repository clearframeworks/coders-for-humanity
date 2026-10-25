import Link from "next/link";
import { PageIntro, EmptyState } from "@/components/ui";
import { ledger } from "@/lib/records";
import { getCatalog } from "@/lib/catalog";
export const metadata = { title: "Transparency" };
export default async function Transparency() {
  const [l, c] = await Promise.all([ledger(), getCatalog()]);
  return (
    <div className="page-content">
      <PageIntro
        eyebrow="THE PUBLIC RECORD"
        title="Trust should be inspectable."
      >
        Funding, expenses, governance, and project decisions belong in the open,
        with appropriate protection for personal and security-sensitive
        information.
      </PageIntro>
      <div className="prose">
        <h2>Funding & expenses</h2>
      </div>
      {!l.funding.length && !l.expenses.length ? (
        <EmptyState title="No financial records have been published">
          This means records are unavailable, not that audited income and
          expenses are zero. No sponsors or grants are implied by example
          projects.
        </EmptyState>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="record-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {[
                ...l.funding.map((r) => ({ ...r, type: "Funding" })),
                ...l.expenses.map((r) => ({ ...r, type: "Expense" })),
              ].map((r) => (
                <tr key={r.id}>
                  <td>{r.type}</td>
                  <td>{r.source_name || r.description}</td>
                  <td>
                    {r.currency} {r.amount}
                  </td>
                  <td>{r.received_at || r.incurred_at}</td>
                  <td>
                    <a href={r.source_url}>Source ↗</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="inline-links">
        <Link className="button" href="/api/transparency">
          Machine-readable ledger ↗
        </Link>
        <Link className="button" href="/funding">
          Funding principles ↗
        </Link>
      </div>
      <div className="prose">
        <h2>Governance & acceptance decisions</h2>
        {c.decisions.length ? (
          c.decisions.map((d) => (
            <p key={d.id}>
              <Link href={`/decisions/${d.id}`}>{d.title}</Link>
              {d.is_demo ? " · Example decision" : ""}
            </p>
          ))
        ) : (
          <p>No public decisions have been recorded.</p>
        )}
        <h2>Annual reports & conflicts of interest</h2>
        <p>
          No annual reports, grant reports, infrastructure donations, or
          conflict declarations have been published. Future records must
          identify their reporting period and supporting evidence.
        </p>
      </div>
    </div>
  );
}
