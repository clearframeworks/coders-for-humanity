import type { Metadata } from "next";
import Link from "next/link";
import { Navigation, Topbar } from "@/components/navigation";
import "./globals.css";
import "./hub.css";
export const metadata: Metadata = {
  title: {
    default: "Coders for Humanity — Community workspace",
    template: "%s | Coders for Humanity",
  },
  description:
    "Developers, researchers, designers, and domain experts working together on open technology for meaningful human problems.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('cfh-theme');document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:'system'}catch(e){document.documentElement.dataset.theme='system'}",
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Navigation />
        <div className="workspace">
          <Topbar />
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <footer>
            <div>
              <strong>Coders for Humanity</strong>
              <p>People, shared context, and work that matters.</p>
            </div>
            <div>
              <Link href="/constitution">Constitution</Link>
              <Link href="/funding">Funding</Link>
              <Link href="/partners">Partners</Link>
              <Link href="/about">About</Link>
              <Link href="/docs/security">Security</Link>
            </div>
            <span>Open source · MIT</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
