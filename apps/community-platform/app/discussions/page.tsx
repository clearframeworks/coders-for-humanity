import Link from "next/link";
import { PageIntro } from "@/components/ui";
import {
  CommunityFeed,
  CommunityConnectionNote,
} from "@/components/community-feed";
import { getPosts, communityReady } from "@/lib/community";
export const metadata = { title: "Discussions" };
export default async function Discussions({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string }>;
}) {
  const { kind, q } = await searchParams;
  const posts = await getPosts();
  const filtered = posts.filter(
    (p) =>
      (!kind || p.kind === kind) &&
      (!q || `${p.title} ${p.body}`.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <div className="page-content">
      <PageIntro eyebrow="THE COMMONS" title="Work starts with a conversation.">
        Ask for help, share what you learned, or find people to build with.
      </PageIntro>
      <div className="hub-row">
        <Link className="button primary" href="/discussions/new">
          Start a conversation
        </Link>
        <Link className="button" href="/projects">
          Project spaces
        </Link>
      </div>
      {!communityReady() && <CommunityConnectionNote />}
      <form className="hub-panel hub-row" role="search">
        <div className="field">
          <label htmlFor="discussion-search">Search conversations</label>
          <input
            id="discussion-search"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Topic, question, or idea"
          />
        </div>
        <div className="field">
          <label htmlFor="discussion-type">Type</label>
          <select id="discussion-type" name="kind" defaultValue={kind || ""}>
            <option value="">All conversations</option>
            <option value="discussion">Discussions</option>
            <option value="question">Questions</option>
            <option value="update">Updates</option>
          </select>
        </div>
        <button className="button">Filter</button>
      </form>
      {filtered.length ? (
        <CommunityFeed posts={filtered} />
      ) : (
        <section className="hub-panel">
          <h2>
            {q || kind
              ? "No conversations match these filters."
              : "Room for the first conversation."}
          </h2>
          <p>
            {q || kind
              ? "Try another topic or show all conversation types."
              : "Introduce the problem you care about, what you can contribute, and the kind of help you need. Published discussions will appear here."}
          </p>
          {(q || kind) && (
            <Link className="text-link" href="/discussions">
              Clear filters
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
