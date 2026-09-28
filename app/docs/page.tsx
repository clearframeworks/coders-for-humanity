import Link from "next/link";
import { BookOpen } from "lucide-react";
import { docs } from "@/lib/content";
import { PageIntro } from "@/components/ui";
export const metadata = { title: "The open handbook" };
export default function Docs() {
  return (
    <div className="page-content">
      <PageIntro
        eyebrow="THE OPEN HANDBOOK"
        title="Good work starts with shared understanding."
      >
        How to contribute, propose, build, review, and steward public
        technology.
      </PageIntro>
      <div className="docs-grid">
        {Object.entries(docs).map(([slug, d]) => (
          <Link href={`/docs/${slug}`} key={slug} className="docs-card">
            <BookOpen size={22} strokeWidth={1.5} />
            <h2>{d.title}</h2>
            <p>{d.intro}</p>
            <span className="text-link">Read the guide ↗</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
