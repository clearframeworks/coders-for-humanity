"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeSettings } from "./theme-settings";
import {
  ArrowUpRight,
  LayoutDashboard,
  Layers3,
  FolderGit2,
  Lightbulb,
  ListTodo,
  ChartNoAxesCombined,
  BookOpen,
  Landmark,
  ShieldCheck,
  HeartHandshake,
  Menu,
  X,
  Search,
  ArrowRight,
  MessagesSquare,
  Users,
  Inbox,
  Github,
} from "lucide-react";
const groups = [
  {
    label: "THE COMMONS",
    items: [
      ["Community", "/", LayoutDashboard],
      ["Conversations", "/discussions", MessagesSquare],
      ["Projects", "/projects", FolderGit2],
      ["People", "/people", Users],
    ],
  },
  {
    label: "YOUR WORK",
    items: [
      ["My workspace", "/workspace", Layers3],
      ["Find work", "/contribute", ListTodo],
      ["Reviews", "/reviews", ShieldCheck],
      ["Inbox", "/inbox", Inbox],
    ],
  },
  {
    label: "SHARED RESPONSIBILITY",
    items: [
      ["Harness team", "/harness", ShieldCheck],
      ["Handbook", "/docs", BookOpen],
      ["Programs", "/programs", Landmark],
    ],
  },
] as const;
export function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mobile-bar">
        <Link href="/">
          Coders <em>for</em> Humanity
        </Link>
        <button
          aria-expanded={open}
          aria-controls="main-navigation"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <aside
        className={`sidebar ${open ? "is-open" : ""}`}
        id="main-navigation"
      >
        <Link
          className="brand"
          href="/"
          aria-label="Coders for Humanity home"
          onClick={() => setOpen(false)}
        >
          <Image
            src="/cfh-logo.png"
            alt="Coders for Humanity"
            width={180}
            height={135}
            priority
          />
          <span>THE HUMAN COLLABORATION NETWORK</span>
        </Link>
        <nav aria-label="Main navigation">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map(([name, href, Icon]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={
                    pathname === href ||
                    (href !== "/" && pathname.startsWith(href + "/"))
                      ? "active"
                      : ""
                  }
                  aria-current={pathname === href ? "page" : undefined}
                >
                  <Icon size={18} strokeWidth={1.7} />
                  {name}
                  {href === "/contribute" && (
                    <ArrowUpRight className="nav-arrow" size={14} />
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link
            className="button primary sidebar-join"
            href="/join"
            onClick={() => setOpen(false)}
          >
            Create profile <ArrowRight size={15} />
          </Link>
          <ThemeSettings />
          <div className="open-mark">
            <span />A place to build together
          </div>
          <a href="https://github.com/clearframeworks/coders-for-humanity">
            <Github size={15} /> Our GitHub repository{" "}
            <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>
    </>
  );
}
export function Topbar() {
  const router = useRouter();
  useEffect(() => {
    function searchShortcut(event: KeyboardEvent) {
      const target = event.target;
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.closest("input, textarea, select, [role='textbox']")))
      )
        return;
      if (
        (event.key === "/" && !event.ctrlKey && !event.metaKey) ||
        (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey))
      ) {
        event.preventDefault();
        if (window.location.pathname === "/search")
          document.getElementById("global-q")?.focus();
        else router.push("/search");
      }
    }
    window.addEventListener("keydown", searchShortcut);
    return () => window.removeEventListener("keydown", searchShortcut);
  }, [router]);
  return (
    <div className="topbar">
      <div className="institution-label">
        <span className="small-cross">⌘</span> Shared context. Human
        contribution.
      </div>
      <div className="topbar-actions">
        <Link
          className="search-link"
          href="/search"
          aria-keyshortcuts="/ Control+k Meta+k"
        >
          <Search size={17} />
          <span>Search</span>
          <kbd>/</kbd>
        </Link>
        <Link className="signin" href="/login">
          Sign in <ArrowRight size={15} />
        </Link>
        <Link className="button primary" href="/join">
          Create profile
        </Link>
      </div>
    </div>
  );
}
