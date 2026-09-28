import { getCatalog } from "@/lib/catalog";
import { PageIntro, DemoNote } from "@/components/ui";
import { WorkBoard } from "@/components/work-board";
export const metadata = { title: "Find your contribution" };
export default async function Contribute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [catalog, params] = await Promise.all([getCatalog(), searchParams]);
  return (
    <div className="page-content">
      <PageIntro
        eyebrow="CONTRIBUTE TO THE COMMON GOOD"
        title="Your skills. A shared purpose."
      >
        A useful contribution can take thirty minutes or become a long-term
        commitment. Find a clear task, understand the context, and get started.
      </PageIntro>
      {catalog.demo && <DemoNote />}
      <WorkBoard catalog={catalog} params={params} />
    </div>
  );
}
