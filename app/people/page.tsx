import Link from "next/link";
import { PageIntro } from "@/components/ui";
import { getCatalog } from "@/lib/catalog";
export const metadata = { title: "People" };
export default async function People({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const catalog = await getCatalog();
  const people = catalog.profiles.filter(
    (p) =>
      !p.is_demo &&
      (p as typeof p & { is_public?: boolean }).is_public !== false &&
      (!q ||
        `${p.name} ${p.username} ${p.bio} ${p.availability}`
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  return (
    <div className="page-content">
      <PageIntro eyebrow="PEOPLE" title="Find your collaborators.">
        Engineers, researchers, designers, organizers, and people who know the
        problem firsthand. Public profiles appear here by choice.
      </PageIntro>
      <form className="hub-panel hub-row" role="search">
        <div className="field">
          <label htmlFor="people-search">Search people and interests</label>
          <input
            id="people-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Name, skill, or area of interest"
          />
        </div>
        <button className="button">Search</button>
        <Link className="button primary" href="/join">
          Create profile
        </Link>
      </form>
      {people.length ? (
        <div className="hub-grid">
          {people.map((p) => (
            <article className="hub-panel" key={p.id}>
              <div className="hub-row">
                <span className="hub-avatar" aria-hidden="true">
                  {p.name.slice(0, 1)}
                </span>
                <div>
                  <h2>
                    <Link href={`/people/${p.username}`}>{p.name}</Link>
                  </h2>
                  <span className="hub-meta">@{p.username}</span>
                </div>
              </div>
              <p>{p.bio || "This contributor hasn’t added a bio yet."}</p>
              {p.availability && (
                <p>
                  <strong>Availability:</strong> {p.availability}
                </p>
              )}
              <Link className="text-link" href={`/people/${p.username}`}>
                View contributions →
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <section className="hub-panel">
          <h2>
            {q
              ? "No matching public profiles."
              : "The founding team starts here."}
          </h2>
          <p>
            {q
              ? "Try a broader interest or name."
              : "No public contributor profiles have been published yet. Start with a real contribution, then share the experience and interests that help others work with you."}
          </p>
          <div className="hub-row">
            <Link className="button" href="/contribute">
              Find a first contribution
            </Link>
            <Link className="button" href="/harness">
              Join the harness effort
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
