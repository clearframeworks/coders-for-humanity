import Link from "next/link";
import { getCatalog } from "@/lib/catalog";
import { searchCatalog } from "@/lib/search";
import { PageIntro, DemoNote, EmptyState } from "@/components/ui";
export const metadata = { title: "Search the institution" };
export default async function Search({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [c, { q = "" }] = await Promise.all([getCatalog(), searchParams]);
  const results = searchCatalog(c, q.slice(0, 200));
  return (
    <div className="page-content">
      <PageIntro
        eyebrow="SEARCH THE INSTITUTION"
        title="Find the work. Follow the evidence."
      >
        Search projects, problems, tasks, programs, people, and the handbook.
        Private proposals remain in your account.
      </PageIntro>
      <form action="/search" className="filters">
        <div className="field search-field">
          <label htmlFor="global-q">Search public information</label>
          <input
            id="global-q"
            name="q"
            defaultValue={q}
            placeholder="Try accessibility, food, or research"
            maxLength={200}
          />
        </div>
        <div className="filter-actions">
          <button className="button primary">Search</button>
        </div>
      </form>
      {q && (
        <>
          <div className="page-toolbar">
            <p>
              {results.length} results for “{q.slice(0, 200)}”
            </p>
          </div>
          {c.demo && <DemoNote />}
          <ul className="search-results">
            {results.map((r) => (
              <li key={r.url}>
                <span className="card-kicker">{r.type}</span>
                <h2>
                  <Link href={r.url}>{r.title} ↗</Link>
                </h2>
                <p>{r.text}</p>
              </li>
            ))}
          </ul>
          {!results.length && (
            <EmptyState title="No matching records">
              Try a broader term or browse the programs.
            </EmptyState>
          )}
        </>
      )}
    </div>
  );
}
