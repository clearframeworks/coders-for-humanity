import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityPostCard, CommunityFeed } from "@/components/community-feed";
import {
  CommunityComposer,
  CommunityAction,
} from "@/components/community-forms";
import { getPost, getPosts, getViewer } from "@/lib/community";
export const metadata = { title: "Community conversation" };
export default async function Discussion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) notFound();
  const [replies, viewer] = await Promise.all([
    getPosts(undefined, id),
    getViewer(),
  ]);
  return (
    <div className="page-content">
      <Link className="text-link" href="/discussions">
        ← All conversations
      </Link>
      <h1>{post.title}</h1>
      <CommunityPostCard post={post} detail />
      {viewer && (
        <CommunityAction action="save" id={post.id} saved>
          Save to my workspace
        </CommunityAction>
      )}
      <h2>
        {replies.length} {replies.length === 1 ? "reply" : "replies"}
      </h2>
      <CommunityFeed posts={replies} />
      <h2>Keep the conversation moving</h2>
      {!viewer && (
        <p>
          <Link href={`/login?next=/discussions/${id}`}>Sign in</Link> to reply.
        </p>
      )}
      {viewer && !viewer.profile?.is_public && (
        <p>
          <Link href="/account">Publish your contributor profile</Link> to
          reply.
        </p>
      )}
      <CommunityComposer
        enabled={!!viewer?.profile?.is_public}
        projectId={post.project_id}
        parentId={id}
      />
    </div>
  );
}
