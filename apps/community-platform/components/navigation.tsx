"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
      ["Free software", "/software", BookOpen],
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
export function Navigation({ authenticated = false }: { authenticated?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const mobileBar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    function resize() {
      setMobile(query.matches);
      if (!query.matches) setOpen(false);
    }
    resize();
    query.addEventListener("change", resize);
    return () => query.removeEventListener("change", resize);
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open || !mobile) return;
    const panel = sidebar.current;
    const workspace = document.querySelector<HTMLElement>(".workspace");
    const bar = mobileBar.current;
    const previousOverflow = document.body.style.overflow;
    const previousInert = workspace?.inert ?? false;
    document.body.style.overflow = "hidden";
    if (workspace) workspace.inert = true;
    if (bar) bar.inert = true;
    const controls = () => Array.from(panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]',
    ) || []).filter(element => element.getClientRects().length > 0);
    controls()[0]?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if (event.key === "Tab") {
        const items = controls();
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && (document.activeElement === first || !panel?.contains(document.activeElement))) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panel?.contains(document.activeElement))) {
          event.preventDefault(); first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      if (workspace) workspace.inert = previousInert;
      if (bar) bar.inert = false;
      toggle.current?.focus();
    };
  }, [open, mobile]);
  return (
    <>
      <div className="mobile-bar" ref={mobileBar}>
        <Link href="/">
          Coders <em>for</em> Humanity
        </Link>
        <button
          ref={toggle}
          aria-expanded={open}
          aria-controls="main-navigation"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && mobile && <button className="navigation-backdrop" aria-label="Close navigation backdrop" tabIndex={-1} onClick={() => setOpen(false)} />}
      <aside
        ref={sidebar}
        className={`sidebar ${open ? "is-open" : ""}`}
        id="main-navigation"
        role={open && mobile ? "dialog" : undefined}
        aria-modal={open && mobile ? true : undefined}
        aria-label={open && mobile ? "Site navigation" : undefined}
        aria-hidden={mobile && !open ? true : undefined}
        inert={mobile && !open ? true : undefined}
      >
        <div className="navigation-heading"><strong>Explore CFH</strong><button className="navigation-close" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={20} /></button></div>
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
                  aria-current={pathname === href || (href !== "/" && pathname.startsWith(href + "/")) ? "page" : undefined}
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
            href={authenticated ? "/account" : "/join"}
            onClick={() => setOpen(false)}
          >
            {authenticated ? "My account" : "Create profile"} <ArrowRight size={15} />
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
export function Topbar({ authenticated = false }: { authenticated?: boolean }) {
  const router = useRouter();
  const [shortcutsReady, setShortcutsReady] = useState(false);
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
    setShortcutsReady(true);
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
          aria-keyshortcuts={shortcutsReady ? "/ Control+k Meta+k" : undefined}
        >
          <Search size={17} />
          <span>Search</span>
          <kbd>/</kbd>
        </Link>
        {authenticated ? <>
          <Link className="signin" href="/account">My account</Link>
          <Link className="button primary" href="/workspace">My workspace <ArrowRight size={15} /></Link>
        </> : <>
          <Link className="signin" href="/login">Sign in <ArrowRight size={15} /></Link>
          <Link className="button primary" href="/join">Create profile</Link>
        </>}
      </div>
    </div>
  );
}
