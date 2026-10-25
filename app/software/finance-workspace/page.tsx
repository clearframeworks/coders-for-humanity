import Link from "next/link";
import type { Metadata } from "next";
import "../software.css";

export const metadata: Metadata = {
  title: "Your finances — free local finance planner",
  description: "Plan paydays, bills and spending on your own computer. Free full-source download, Windows quick start, and optional AI assistance.",
};

export default function FinanceSoftware() {
  return (
    <div className="page-content software-page">
      <Link className="text-link" href="/software">← All free software</Link>
      <header className="software-heading">
        <p className="eyebrow">YOUR FINANCES / LOCAL FINANCE PLANNER</p>
        <h1>Know what your money needs to cover.</h1>
        <p>Bring paydays, bills, and spending into one view. See where your balance could dip, try a different plan, and keep the details on your own computer.</p>
        <div className="software-actions">
          <a className="button primary" href="/downloads/finance-workspace.zip" download>Download Your finances (.zip)</a>
          <a className="button" href="https://github.com/clearframeworks/coders-for-humanity/tree/main/products/finance-workspace">Browse the full source ↗</a>
        </div>
        <p className="software-detail">Free · MIT licensed · No account or AI subscription required</p>
      </header>
      <section className="software-start" aria-labelledby="start-heading">
        <h2 id="start-heading">Extract. Open. Start planning.</h2>
        <p>On Windows 10 or 11, extract the ZIP and double-click <strong>Start-Finances.cmd</strong> inside the finance-workspace folder. It sets up the runtime if needed and opens the app in your browser.</p>
        <p>The first setup needs internet access if a suitable Node.js runtime is not installed. Windows may ask you to confirm a downloaded script. After setup, the core planner runs offline.</p>
      </section>
      <div className="software-columns">
        <section aria-labelledby="features-heading">
          <h2 id="features-heading">A plan you can adjust</h2>
          <ul>
            <li>Add balances, upcoming income, and recurring bills.</li>
            <li>Forecast daily balances and spot possible shortfalls.</li>
            <li>Import transaction CSVs and review spending patterns.</li>
            <li>Compare spending changes before saving a plan.</li>
          </ul>
        </section>
        <section aria-labelledby="privacy-heading">
          <h2 id="privacy-heading">Your computer. Your records.</h2>
          <p>The app starts with empty records and stores your data locally in SQLite. Keep a backup of the app’s runtime folder when moving computers. It does not connect to your bank automatically.</p>
          <p>AI is optional and off by default. The forecasts work without it. You can also give the included source to an AI coding assistant to customize your copy.</p>
        </section>
      </div>
      <section className="software-source" aria-labelledby="source-heading">
        <h2 id="source-heading">The whole app is included</h2>
        <p>The download contains the interface, server, calculation modules, tests, browser connector, and launcher. No paid upgrade is needed to get the code.</p>
        <p>On macOS or Linux, install Node.js 24 or newer, open a terminal in the extracted folder, and run <code>npm start</code>. The automatic launcher is for Windows.</p>
        <a className="text-link" href="/downloads/finance-workspace.sha256" download>Download checksum</a>
      </section>
    </div>
  );
}
