import Link from "next/link";
import type { Metadata } from "next";
import { products } from "./catalog/products";
import "./software.css";

export const metadata: Metadata = {
  title: "Free software",
  description: "Explore free software from Coders for Humanity, organized by what you want to do.",
};

export default function Software() {
  return (
    <div className="page-content software-page">
      <header className="software-heading">
        <p className="eyebrow">CODERS FOR HUMANITY / FREE SOFTWARE</p>
        <h1>Useful software. Yours to keep.</h1>
        <p>Explore free software by task. Each app includes source you can inspect and change.</p>
      </header>
      <section className="software-category" aria-labelledby="finance-heading">
        <p className="eyebrow">FINANCE</p>
        <article className="software-listing software-product-listing">
          <img className="software-mark" src="/software/finance.svg" alt="" width="72" height="72" />
          <div><h2 id="finance-heading"><Link href="/software/finance-workspace">Your finances</Link></h2>
            <p>See how paydays, bills, and everyday spending affect the money ahead. Import transaction CSVs and compare spending plans on your own computer.</p>
            <p className="software-detail">Stage: Released · Windows installer · MIT license · Full source included</p>
          </div>
          <Link className="button primary" href="/software/finance-workspace">Explore Your finances →</Link>
        </article>
      </section>
      {products.map((product) => (
        <section className="software-category" key={product.slug} aria-labelledby={`${product.slug}-heading`}>
          <p className="eyebrow">{product.category.toUpperCase()}</p>
          <article className="software-listing software-product-listing">
            <img className="software-mark" src={`/software/${product.slug}.svg`} alt="" width="72" height="72" />
            <div><h2 id={`${product.slug}-heading`}><Link href={`/software/${product.slug}`}>{product.name}</Link></h2>
              <p>{product.summary}</p><p className="software-detail">Stage: {product.stage} · {product.label} · {product.license}</p>
            </div>
            <Link className="button primary" href={`/software/${product.slug}`}>Explore {product.name} →</Link>
          </article>
        </section>
      ))}
    </div>
  );
}
