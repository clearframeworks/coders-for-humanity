import Link from "next/link";
import { PageIntro } from "@/components/ui";
import { CommunityComposer } from "@/components/community-forms";
import { CommunityConnectionNote } from "@/components/community-feed";
import { communityReady, getViewer } from "@/lib/community";
import { getCatalog } from "@/lib/catalog";
export const metadata = { title: "Start a conversation" };
export default async function NewDiscussion({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const [viewer, catalog, params] = await Promise.all([
    getViewer(),
    getCatalog(),
    searchParams,
  ]);
  const projectId =
    catalog.projects.find(
      (project) => project.id === params.project && !project.is_demo,
    )?.id || null;
  const enabled = !!viewer?.profile?.is_public;
  return (
    <div className="page-content">
      <PageIntro eyebrow="COMMUNITY" title="Start a conversation.">
        Bring the context. Make the question clear. Invite a useful next step.
      </PageIntro>
      {!communityReady() ? (
        <CommunityConnectionNote />
      ) : !viewer ? (
        <div className="notice">
          <Link href="/login?next=/discussions/new">Sign in</Link> to publish.
          You can prepare a draft below.
        </div>
      ) : !viewer.profile?.is_public ? (
        <div className="notice">
          <Link href="/account">Create a public contributor profile</Link>{" "}
          before posting.
        </div>
      ) : null}
      <CommunityComposer
        enabled={enabled}
        projectId={projectId}
        projects={catalog.projects
          .filter((p) => !p.is_demo)
          .map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
