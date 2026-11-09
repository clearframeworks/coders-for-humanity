import type { Project } from "./types";

// Source-managed until a project record is created in the community database.
export const pcBridgeProject: Project = {
  id: "b37c4049-ec61-4ca7-a9ca-9af99b62b8ec",
  slug: "pc-bridge",
  name: "PC Bridge",
  program_id: "civic-infrastructure",
  summary: "A prototype for opening selected web apps on your PC from your phone.",
  problem: "People using locally hosted apps need a practical way to reach them from another device while the host computer is running.",
  objective: "Build a private, usable bridge from a Windows computer to a phone for selected local web apps, and verify it with real devices and applications.",
  status: "BUILDING",
  license: "MIT",
  architecture: "An original Node.js host with a local app registry, access-key sign-in, a mobile web portal, and a proxy to selected loopback web apps. Private remote access currently requires separate networking software.",
  evidence: "A local prototype and automated checks exist. Phone access, a real target app, WebSockets, and app isolation have not been verified. Registered apps share a browser origin; use only mutually trusted, non-sensitive apps. An installer, automatic startup, and native desktop streaming are not implemented.",
  is_demo: false,
};
