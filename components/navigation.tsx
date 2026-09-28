"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
} from "lucide-react";
const groups = [
  {
    label: "THE COLLECTIVE",
    items: [
      ["Overview", "/", LayoutDashboard],
      ["Programs", "/programs", Layers3],
      ["Projects", "/projects", FolderGit2],
      ["Problem library", "/problems", Lightbulb],
    ],
  },
  {
    label: "GET INVOLVED",
    items: [
      ["Find work", "/contribute", ListTodo],
      ["Impact", "/impact", ChartNoAxesCombined],
      ["Documentation", "/docs", BookOpen],
    ],
  },
  {
    label: "THE INSTITUTION",
    items: [
      ["Our mission", "/mission", Landmark],
      ["Governance", "/governance", ShieldCheck],
      ["Transparency", "/transparency", HeartHandshake],
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
          <span>OPEN ENGINEERING. PUBLIC GOOD.</span>
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
          <ThemeSettings />
          <div className="open-mark">
            <span />
            Built in the open
          </div>
          <p>
            Public purpose.
            <br />
            Shared responsibility.
          </p>
          <Link href="/constitution">
            Read our constitution <ArrowUpRight size={14} />
          </Link>
        </div>
      </aside>
    </>
  );
}
export function Topbar() {
  return (
    <div className="topbar">
      <div className="institution-label">
        <span className="small-cross">+</span> A public-interest engineering
        institution
      </div>
      <div className="topbar-actions">
        <Link className="search-link" href="/search">
          <Search size={17} />
          <span>Search</span>
          <kbd>/</kbd>
        </Link>
        <Link className="signin" href="/login">
          Join the work <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
