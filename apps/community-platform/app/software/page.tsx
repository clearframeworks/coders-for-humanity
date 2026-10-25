import Link from "next/link";
import type { Metadata } from "next";
import "./software.css";

export const metadata: Metadata = {
  title: "Free software",
  description: "Free software from Coders for Humanity. Download the complete source, run it yourself, and make it your own.",
};

export default function Software() {
  return (
    <div className="page-content software-page">
      <header className="software-heading">
        <p className="eyebrow">CODERS FOR HUMANITY / FREE SOFTWARE</p>
        <h1>Useful software. Yours to keep.</h1>
        <p>Download it, use it, change it. Every product here includes its complete source code, with no account required. Use it on your own or with AI assistance.</p>
      </header>
      <article className="software-listing">
        <div>
          <p className="eyebrow">LOCAL FINANCE PLANNER · MIT LICENSE</p>
          <h2><Link href="/software/finance-workspace">Your finances</Link></h2>
          <p>See how paydays, bills, and everyday spending affect the money ahead. Import transaction CSVs and compare spending plans on your own computer.</p>
          <p className="software-detail">Windows installer · No AI required · Full source included</p>
        </div>
        <Link className="button primary" href="/software/finance-workspace">Get Your finances →</Link>
      </article>
    </div>
  );
}
