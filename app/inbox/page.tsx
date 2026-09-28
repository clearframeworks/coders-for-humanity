import Link from "next/link";
import { PageIntro } from "@/components/ui";
import { CommunityAction } from "@/components/community-forms";
import { CommunityConnectionNote } from "@/components/community-feed";
import { communityReady, getViewer } from "@/lib/community";
import { createClient } from "@/lib/supabase";
export const metadata = { title: "Inbox" };
export default async function Inbox() {
  const viewer = await getViewer();
  if (!viewer)
    return (
      <div className="page-content">
        <PageIntro eyebrow="INBOX" title="The things that need you.">
          Replies and updates about your contributions, in one place.
        </PageIntro>
        {!communityReady() ? (
          <CommunityConnectionNote />
        ) : (
          <div className="notice">
            <Link href="/login?next=/inbox">Sign in</Link> to read your private
            notifications.
          </div>
        )}
        <section className="hub-panel">
          <h2>No account connected.</h2>
          <p>
            Notifications will appear after you join the community. GitHub
            repository notifications remain available in your GitHub inbox.
          </p>
          <a className="button" href="https://github.com/notifications">
            Open GitHub inbox ↗
          </a>
        </section>
      </div>
    );
  const db = await createClient();
  const { data, error } = await db
    .from("notifications")
    .select("id,message,read_at,created_at")
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Your notifications could not be loaded.");
  return (
    <div className="page-content">
      <PageIntro eyebrow="INBOX" title="The things that need you.">
        Replies and updates about your contributions.
      </PageIntro>
      {data.some((n) => !n.read_at) && (
        <CommunityAction action="read">Mark all as read</CommunityAction>
      )}
      <div className="hub-stack">
        {data.length ? (
          data.map((n) => (
            <article className="hub-panel" key={n.id}>
              <div className="hub-meta">
                {n.read_at ? "Read" : "Unread"} ·{" "}
                <time dateTime={n.created_at}>
                  {new Date(n.created_at).toLocaleDateString("en", {
                    timeZone: "UTC",
                  })}
                </time>
              </div>
              <p>{n.message}</p>
            </article>
          ))
        ) : (
          <section className="hub-panel">
            <h2>You’re caught up.</h2>
            <p>
              Replies and project updates will appear here as you participate.
            </p>
            <Link className="button" href="/workspace">
              Back to my workspace
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
