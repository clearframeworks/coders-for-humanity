import Link from "next/link";
import { redirect } from "next/navigation";
import { PageIntro, EmptyState } from "@/components/ui";
import { ProfileForm } from "@/components/profile-form";
import { createClient, isDemo, configured } from "@/lib/supabase";
import { signOut } from "@/app/actions";
export const metadata = { title: "Your account" };
type Assignment = {
  task_id: string;
  tasks: { title: string; status: string } | null;
};
export default async function Account() {
  if (isDemo() || !configured())
    return (
      <div className="page-content">
        <PageIntro
          eyebrow="YOUR CONTRIBUTIONS"
          title="A record of useful work."
        />
        <EmptyState title="Member accounts are not connected yet">
          Start your profile and save it in this browser while registration is
          being connected. <Link href="/join">Create your profile →</Link>
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
  const profile = p.data;
  const tasks = assignments.data as unknown as Assignment[];
  const profileSuggestions = [
    !profile?.bio?.trim() && "a short introduction",
    !profile?.availability?.trim() && "the time you have available",
  ].filter(Boolean);
  return (
    <div className="page-content">
      <PageIntro
        eyebrow="YOUR ACCOUNT"
        title={profile?.name ? `Welcome, ${profile.name}.` : "Welcome to CFH."}
      >
        Find your next contribution, follow your commitments, and keep your
        profile up to date.
      </PageIntro>
      <section className="notice" aria-labelledby="profile-status">
        <h2 id="profile-status">
          {profile?.is_public
            ? "Your profile is published"
            : profile
              ? "Your profile is private"
              : "Create your contributor profile"}
        </h2>
        {profile?.is_public ? (
          <p>
            <Link href={`/people/${profile.username}`}>View your public profile</Link>
            {" "}and how other contributors see you. Your email stays private.
          </p>
        ) : (
          <p>
            {profile
              ? "Publish your profile below when you’re ready to join projects and take part in discussions. Your email stays private."
              : "Add your name and username below, then choose whether to publish your profile. A public profile lets you join projects and discussions."}
          </p>
        )}
        {profileSuggestions.length > 0 && (
          <p>
            Help people find a good way to work with you: add{" "}
            {profileSuggestions.join(" and ")}.
          </p>
        )}
        <a className="text-link" href="#your-profile">Edit your profile →</a>
      </section>
      <nav className="prose" aria-label="Your community">
        <h2>Your place in the community</h2>
        <ul>
          <li><Link href="/workspace">My workspace</Link> — commitments, projects, and saved conversations.</li>
          <li><Link href="/inbox">Inbox</Link> — replies and updates to your work.</li>
          <li><Link href="/discussions">Discussions</Link> — meet contributors and share what you’re working on.</li>
          <li><Link href="/projects">Projects</Link> — find a project to join.</li>
        </ul>
      </nav>
      <div className="prose">
        <h2>Your tasks</h2>
        {tasks.length ? (
          <ul>
            {tasks.map(({ task_id, tasks: task }) => (
              <li key={task_id}>
                {task ? (
                  <>
                    <Link href={`/work/${task_id}`}>{task.title}</Link>
                    {" · "}{task.status.toLowerCase().replaceAll("_", " ")}
                  </>
                ) : (
                  "This assigned task is no longer available."
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            You haven’t claimed a task yet.{" "}
            <Link href="/contribute">Find work that fits your skills and time</Link>.
          </p>
        )}
        <h2>Your proposals</h2>
        {proposals.data?.length ? (
          proposals.data.map((p) => (
            <p key={p.id}>
              <Link href={`/proposals/${p.id}`}>{p.title}</Link> · {p.status}
            </p>
          ))
        ) : (
          <p>
            No submitted proposals yet. Have a problem the community could help solve?{" "}
            <Link href="/propose">Describe the problem</Link>.
          </p>
        )}
      </div>
      <section id="your-profile" aria-label="Edit your contributor profile">
        <ProfileForm profile={profile} />
      </section>
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
