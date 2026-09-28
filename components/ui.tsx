import Link from "next/link";
import {
  ArrowUpRight,
  Sprout,
  House,
  Accessibility,
  Radio,
  BookOpen,
  Leaf,
  HeartPulse,
  Landmark,
  Route,
  FlaskConical,
  Globe2,
} from "lucide-react";
import type { Catalog, Project } from "@/lib/types";
const icons = {
  Sprout,
  House,
  Accessibility,
  Radio,
  BookOpen,
  Leaf,
  HeartPulse,
  Landmark,
  Route,
  FlaskConical,
};
export function ProgramIcon({
  name,
  size = 22,
}: {
  name: string;
  size?: number;
}) {
  const Icon = icons[name as keyof typeof icons] || Globe2;
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}
export function Badge({ status }: { status: string }) {
  return (
    <span
      className={`badge badge-${status.toLowerCase().replaceAll(" ", "-")}`}
    >
      <i />
      {status.toLowerCase()}
    </span>
  );
}
export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-intro">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {children && <div className="lede">{children}</div>}
    </header>
  );
}
export function DemoNote() {
  return (
    <div className="demo-note">
      <span className="demo-dot" /> Demonstration catalogue{" "}
      <span>
        These examples show how the institution will work. They are not active
        projects or verified outcomes.
      </span>
    </div>
  );
}
export function SectionHead({
  number,
  title,
  href,
  label = "View all",
}: {
  number: string;
  title: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="section-head">
      <h2>
        <span>{number}</span>
        {title}
      </h2>
      {href && (
        <Link className="text-link" href={href}>
          {label}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function ProjectCard({
  project,
  catalog,
}: {
  project: Project;
  catalog: Catalog;
}) {
  const program = catalog.programs.find((p) => p.id === project.program_id);
  const count = catalog.tasks.filter(
    (t) => t.project_id === project.id && t.status === "OPEN",
  ).length;
  return (
    <article className="project-card">
      <div className={`project-art art-${program?.slug}`}>
        <ProgramIcon name={program?.icon || ""} size={47} />
        <span className="art-coordinate">
          CFH / {project.id.slice(0, 3).toUpperCase()}
        </span>
        <div className="art-lines" />
      </div>
      <div className="project-body">
        <div className="card-kicker">
          {program?.name}
          {project.is_demo && <span>Example</span>}
        </div>
        <h3>
          <Link href={`/projects/${project.slug}`}>
            {project.name}
            <ArrowUpRight size={19} />
          </Link>
        </h3>
        <p>{project.summary}</p>
        <div className="card-bottom">
          <Badge status={project.status} />
          <span>{count} open tasks</span>
        </div>
      </div>
    </article>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <Globe2 size={30} strokeWidth={1.2} />
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
