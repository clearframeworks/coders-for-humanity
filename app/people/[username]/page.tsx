import { notFound } from "next/navigation";
import Link from "next/link";
import { getCatalog } from "@/lib/catalog";
import { createClient, isDemo } from "@/lib/supabase";
import { PageIntro, DemoNote } from "@/components/ui";
export default async function Person({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const [c, { username }] = await Promise.all([getCatalog(), params]);
  const p = c.profiles.find((p) => p.username === username);
  if (!p) notFound();
  let work: { task_id: string; tasks: { title: string; status: string } }[] =
    [];
  let skills: { skills: { name: string; kind: string } }[] = [];
  let roles: { project_id: string; role: string }[] = [];
  let reviewCount = 0;
  if (!isDemo()) {
    const db = await createClient();
    const results = await Promise.all([
      db
        .from("task_assignments")
        .select("task_id,tasks!inner(title,status)")
        .eq("user_id", p.id),
      db
        .from("user_skills")
        .select("skills!inner(name,kind)")
        .eq("user_id", p.id),
      db
        .from("project_maintainers")
        .select("project_id,role")
        .eq("user_id", p.id),
      db
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("reviewer_id", p.id),
    ]);
    if (results.some((r) => r.error))
      throw new Error("Contribution history could not be loaded.");
    work = results[0].data as unknown as typeof work;
    skills = results[1].data as unknown as typeof skills;
    roles = results[2].data as typeof roles;
    reviewCount = results[3].count || 0;
  }
  return (
    <div className="page-content">
      <div className="profile-avatar" aria-hidden="true">
        {p.name.slice(0, 1)}
      </div>
      <PageIntro eyebrow={`CONTRIBUTOR / ${p.username}`} title={p.name}>
        {p.bio}
      </PageIntro>
      {p.is_demo && <DemoNote />}
      <dl className="metadata-grid">
        <div>
          <dt>Location</dt>
          <dd>{p.location || "Not shared"}</dd>
        </div>
        <div>
          <dt>Availability</dt>
          <dd>{p.availability || "Not specified"}</dd>
        </div>
        <div>
          <dt>Skills & interests</dt>
          <dd>
            {skills.map((s) => s.skills.name).join(", ") || "Not specified"}
          </dd>
        </div>
      </dl>
      <div className="inline-links">
        {p.github_url && (
          <a className="text-link" href={p.github_url}>
            GitHub ↗
          </a>
        )}
        {p.website_url && (
          <a className="text-link" href={p.website_url}>
            Website ↗
          </a>
        )}
      </div>
      <div className="prose">
        <h2>Current & completed contributions</h2>
        {work.length ? (
          work.map((w) => (
            <p key={w.task_id}>
              <Link href={`/work/${w.task_id}`}>{w.tasks.title}</Link> ·{" "}
              {w.tasks.status}
            </p>
          ))
        ) : (
          <p>No contributions are recorded.</p>
        )}
        <h2>Maintainer responsibilities</h2>
        {roles.length ? (
          roles.map((r) => (
            <p key={r.project_id}>
              {r.role} · {c.projects.find((x) => x.id === r.project_id)?.name}
            </p>
          ))
        ) : (
          <p>No maintainer roles are recorded.</p>
        )}
        <h2>Reviews & documented outcomes</h2>
        <p>
          {reviewCount
            ? `${reviewCount} task reviews are recorded.`
            : "No reviews are recorded."}{" "}
          Human outcomes are reported at the project level with evidence and
          limitations.
        </p>
        <Link href="/impact">Read verified impact reports ↗</Link>
      </div>
    </div>
  );
}
