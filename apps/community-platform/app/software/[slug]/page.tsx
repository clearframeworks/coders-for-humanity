import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { products } from "../catalog/products";
import "../software.css";

type PageProps = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return products.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = products.find((item) => item.slug === slug);
  return product ? { title: `${product.name} — free software`, description: product.summary } : {};
}
export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = products.find((item) => item.slug === slug);
  if (!product) notFound();
  return (
    <div className="page-content software-page">
      <Link className="text-link" href="/software">← All free software</Link>
      <header className="software-heading product-heading">
        <div className="product-identity"><img className="software-mark" src={`/software/${product.slug}.svg`} alt="" width="88" height="88" />
          <div><p className="eyebrow">{product.category.toUpperCase()} / {product.label.toUpperCase()}</p><h1>{product.name}</h1></div>
        </div>
        <p>{product.description}</p>
        <div className="software-actions"><a className="button primary" href={product.release}>{product.releaseLabel} ↗</a><a className="button" href={product.source}>Browse source ↗</a></div>
        <p className="software-detail">Stage: {product.stage} · Free · {product.license}{product.upstream && ` · Based on ${product.upstream}`}</p>
      </header>
      <section className="software-start" aria-labelledby="before-download"><h2 id="before-download">Before you download</h2><ul>{product.details.map((detail) => <li key={detail}>{detail}</li>)}</ul></section>
      <section className="software-source" aria-labelledby="source-heading"><h2 id="source-heading">Open source, with credit</h2><p>{product.upstream ? `${product.name} is a CFH fork of ${product.upstream}. The release page includes the Windows installer and source; the repository contains the fork and its license information.` : `${product.name} is an open-source CFH project. The release page includes the Windows installer and source; the repository contains license information.`}</p><a className="text-link" href={product.source}>View the {product.name} repository ↗</a></section>
    </div>
  );
}
