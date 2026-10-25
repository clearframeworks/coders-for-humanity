import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCatalog } from "@/lib/catalog";
import { PageIntro, ProgramIcon } from "@/components/ui";
import { EditorialPhoto } from "@/components/editorial-photo";
import { programPhoto } from "@/lib/photos";
export const metadata = { title: "Programs" };
export default async function Programs() {
  const c = await getCatalog();
  return (
    <div className="page-content">
      <PageIntro
        eyebrow="AREAS OF INSTITUTIONAL WORK"
        title="Human problems cross disciplines."
      >
        Our programs organize work around public needs. They connect research,
        domain knowledge, and engineering over the long term.
      </PageIntro>
      <div className="program-photo-grid">
        {c.programs
          .filter((p) =>
            ["civic-infrastructure", "environment", "education"].includes(
              p.slug,
            ),
          )
          .map((p) => (
            <Link
              className="program-photo-card"
              key={p.id}
              href={`/programs/${p.slug}`}
            >
              <EditorialPhoto
                name={programPhoto(p.slug)}
                sizes="(max-width: 700px) 100vw, 33vw"
              />
              <div>
                <h2>
                  {p.name}
                  <ArrowUpRight size={18} />
                </h2>
                <p>{p.description}</p>
                <span className="text-link">Explore this area →</span>
              </div>
            </Link>
          ))}
      </div>
      <h2 className="program-list-heading">All areas of work</h2>
      <div className="program-grid">
        {c.programs.map((p) => (
          <Link
            key={p.id}
            href={`/programs/${p.slug}`}
            className="program-card"
          >
            <ProgramIcon name={p.icon} size={27} />
            <div>
              <h2>{p.name}</h2>
              <p>{p.description}</p>
              <small>
                {c.projects.filter((x) => x.program_id === p.id).length}{" "}
                {c.demo ? "example " : ""}projects
              </small>
            </div>
            <ArrowUpRight size={17} />
          </Link>
        ))}
      </div>
    </div>
  );
}
