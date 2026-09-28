import Link from "next/link";
import { redirect } from "next/navigation";
import { PageIntro, EmptyState } from "@/components/ui";
import { ProfileForm } from "@/components/profile-form";
import { createClient, isDemo, configured } from "@/lib/supabase";
import { signOut } from "@/app/actions";
export const metadata = { title: "Your contributions" };
export default async function Account() {
  if (isDemo() || !configured())
    return (
      <div className="page-content">
        <PageIntro
          eyebrow="YOUR CONTRIBUTIONS"
          title="A record of useful work."
        />
        <EmptyState title="Member accounts are not connected yet">
          You can browse the public catalogue and save a proposal draft in your
          browser. <Link href="/contribute">Explore the founding tasks.</Link>
        </EmptyState>
      </div>
    );
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login?next=/account");
  const [p, proposals, assignments] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    db.from("proposals").select("id,title,status").eq("user_id", user.id),
    db
      .from("task_assignments")
      .select("task_id,tasks(title,status)")
      .eq("user_id", user.id),
  ]);
  if (p.error || proposals.error || assignments.error)
    throw new Error("Your account records could not be loaded.");
  return (
    <div className="page-content">
      <PageIntro eyebrow="YOUR CONTRIBUTIONS" title="Make your time count.">
        A record of the work you contribute and the responsibilities you take
        on.
      </PageIntro>
      <ProfileForm profile={p.data} />
      <div className="prose">
        <h2>Your proposals</h2>
        {proposals.data?.length ? (
          proposals.data.map((p) => (
            <p key={p.id}>
              <Link href={`/proposals/${p.id}`}>{p.title}</Link> · {p.status}
            </p>
          ))
        ) : (
          <p>No submitted proposals yet.</p>
        )}
        <h2>Your tasks</h2>
        {assignments.data?.length ? (
          assignments.data.map((t) => (
            <p key={t.task_id}>
              <Link href={`/work/${t.task_id}`}>Open assigned task ↗</Link>
            </p>
          ))
        ) : (
          <p>No tasks claimed yet.</p>
        )}
      </div>
      <div className="inline-links">
        <Link className="button" href="/contribute">
          Find work
        </Link>
        <Link className="button" href="/propose">
          Propose a problem
        </Link>
        <form action={signOut}>
          <button className="button">Sign out</button>
        </form>
      </div>
    </div>
  );
}
