import Link from "next/link";
import { MessageSquare, ArrowUpRight } from "lucide-react";
import type { CommunityPost } from "@/lib/community";

export function CommunityPostCard({
  post,
  detail = false,
}: {
  post: CommunityPost;
  detail?: boolean;
}) {
  const author = post.profiles?.name || "Community contributor";
  const when = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(post.created_at));
  return (
    <article className="hub-panel community-post">
      <div className="hub-row">
        <span className="hub-avatar" aria-hidden="true">
          {author.slice(0, 1).toUpperCase()}
        </span>
        <div>
          {post.profiles ? (
            <Link href={`/people/${post.profiles.username}`}>
              <strong>{author}</strong>
            </Link>
          ) : (
            <strong>{author}</strong>
          )}
          <div className="hub-meta">
            <time dateTime={post.created_at}>{when}</time> · {post.kind}
          </div>
        </div>
      </div>
      {!post.parent_id && (
        <h2>
          {detail ? (
            post.title
          ) : (
            <Link href={`/discussions/${post.id}`}>{post.title}</Link>
          )}
        </h2>
      )}
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {detail ? post.body : post.body.slice(0, 420)}
        {!detail && post.body.length > 420 ? "…" : ""}
      </p>
      {!detail && (
        <Link className="text-link" href={`/discussions/${post.id}`}>
          <MessageSquare size={16} /> Open conversation{" "}
          <ArrowUpRight size={14} />
        </Link>
      )}
    </article>
  );
}

export function CommunityFeed({ posts }: { posts: CommunityPost[] }) {
  return (
    <div className="hub-stack">
      {posts.map((post) => (
        <CommunityPostCard
          key={post.id}
          post={post}
          detail={!!post.parent_id}
        />
      ))}
    </div>
  );
}

export function CommunityConnectionNote() {
  return (
    <div className="notice">
      <strong>Community accounts are being connected.</strong> Shared posts and
      membership are not live yet. You can prepare a draft here and take work to
      the{" "}
      <a href="https://github.com/clearframeworks/coders-for-humanity/issues">
        project’s GitHub issues ↗
      </a>
      . Only published community activity will appear in this feed.
    </div>
  );
}
