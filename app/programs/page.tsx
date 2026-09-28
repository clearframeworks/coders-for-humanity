import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCatalog } from "@/lib/catalog";
import { PageIntro, ProgramIcon } from "@/components/ui";
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
