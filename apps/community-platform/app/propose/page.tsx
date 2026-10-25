import { PageIntro } from "@/components/ui";
import { ProposalForm } from "@/components/proposal-form";
import { getCatalog } from "@/lib/catalog";
export const metadata = { title: "Propose a problem" };
export default async function Propose() {
  const c = await getCatalog();
  return (
    <div className="page-content">
      <PageIntro
        eyebrow="START WITH A HUMAN NEED"
        title="Bring a problem worth understanding."
      >
        A strong proposal makes the case for research, not just for building.
        Work through the evidence, alternatives, risks, and intended outcomes.
      </PageIntro>
      <ProposalForm
        demo={c.demo}
        projects={c.projects.map(({ slug, name, summary }) => ({
          slug,
          name,
          summary,
        }))}
      />
    </div>
  );
}
