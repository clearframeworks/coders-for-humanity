import { getCatalog } from "@/lib/catalog";
import { PageIntro, DemoNote } from "@/components/ui";
import { WorkBoard } from "@/components/work-board";
export const metadata = { title: "Public work board" };
export default async function Work({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [catalog, params] = await Promise.all([getCatalog(), searchParams]);
  return (
    <div className="page-content">
      <PageIntro
        eyebrow="THE INSTITUTIONAL WORK BOARD"
        title="The work, in the open."
      >
        Follow tasks across projects and disciplines. Each contribution has an
        objective, acceptance criteria, and a path to review.
      </PageIntro>
      {catalog.demo && <DemoNote />}
      <WorkBoard catalog={catalog} params={params} path="/work" />
    </div>
  );
}
