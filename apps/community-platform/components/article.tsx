import type { Article } from "@/lib/content";
import { PageIntro } from "./ui";
export function ArticlePage({ article }: { article: Article }) {
  return (
    <div className="page-content">
      <PageIntro eyebrow={article.eyebrow} title={article.title}>
        {article.intro}
      </PageIntro>
      <div className="article-layout">
        <nav className="toc" aria-label="On this page">
          {article.sections.map((s, i) => (
            <a key={s.title} href={`#section-${i}`}>
              {s.title}
            </a>
          ))}
        </nav>
        <article className="prose">
          {article.sections.map((s, i) => (
            <section key={s.title} id={`section-${i}`}>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
              {s.items && (
                <ul>
                  {s.items.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
