import { photos } from "@/lib/photos";
import { EditorialPhoto } from "@/components/editorial-photo";
import { PageIntro } from "@/components/ui";
export const metadata = { title: "Photography" };
export default function PhotoCredits() {
  return (
    <div className="page-content">
      <PageIntro eyebrow="PHOTOGRAPHY" title="Real photographs. With credit.">
        These photographs illustrate collaboration, learning, and care for the
        environment. The people pictured are not identified as CFH members, and
        the scenes do not document CFH projects.
      </PageIntro>
      <p>
        Photographs are used under the{" "}
        <a className="text-link" href="https://unsplash.com/license">
          Unsplash license
        </a>
        . They are not covered by this repository’s MIT software license.
      </p>
      <div className="photo-credit-grid">
        {Object.entries(photos).map(([name, photo]) => (
          <article className="project-card" key={name}>
            <EditorialPhoto name={name as keyof typeof photos} />
            <div className="project-body">
              <h2>{photo.photographer}</h2>
              <p>{photo.alt}</p>
              <a className="text-link" href={photo.source}>
                Original photograph on Unsplash ↗
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
