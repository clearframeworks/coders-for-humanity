import { notFound, redirect } from "next/navigation";
import { createClient, isDemo, configured } from "@/lib/supabase";
import { PageIntro, Badge } from "@/components/ui";
import { proposalSteps } from "@/lib/validation";
export default async function Proposal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (isDemo() || !configured() || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/proposals/" + id)}`);
  const { data: p, error } = await db
    .from("proposals")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error("The proposal could not be loaded.");
  if (!p) notFound();
  const { data: sources, error: sourceError } = await db
    .from("proposal_sources")
    .select("*")
    .eq("proposal_id", id);
  if (sourceError) throw new Error("The proposal sources could not be loaded.");
  return (
    <div className="page-content">
      <PageIntro eyebrow="YOUR PRIVATE PROPOSAL" title={p.title}>
        <Badge status={p.status} />
      </PageIntro>
      <div className="prose">
        {proposalSteps
          .filter(([key]) => key !== "sources")
          .map(([key, title]) => (
            <section key={key}>
              <h2>{title}</h2>
              <p style={{ whiteSpace: "pre-wrap" }}>{p[key]}</p>
            </section>
          ))}
        <h2>Supporting sources</h2>
        {sources?.map((s) => (
          <p key={s.id}>
            <a href={s.url} rel="noreferrer">
              {s.title} ↗
            </a>
          </p>
        ))}
      </div>
    </div>
  );
}
