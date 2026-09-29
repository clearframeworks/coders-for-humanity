# Working contribution flow

This iteration connects existing surfaces so a contributor can prepare a real contribution before shared accounts are available.

1. Open a founding task and choose **Plan this task**.
2. The personal workspace selects that task without replacing notebook content.
3. Choose **Load task plan** to prepare an editable handoff with the task URL, objective, context, acceptance criteria, dependencies, and reviewer role. Existing fields require confirmation before replacement.
4. Write the work performed and evidence. Explicitly save the note on this device or export Markdown to retain it. This does not claim the task, contact someone, or submit a review.
5. The Reviews page now lists actual open GitHub pull requests with links to diffs, checks, and the discussion. The read-only public feed refreshes roughly every two minutes; unavailable data is identified rather than replaced with examples. Member review permissions remain separate.

The global `/` and Ctrl/Cmd+K shortcuts open search when focus is outside editable controls. Failed authentication callbacks retain a validated local return destination so a `/join` verification can be retried without losing its intended route.

Two Luna agents implemented/reviewed the bounded workspace and callback fixes. Root integrated them with the GitHub queue and navigation. Agent review does not replace the repository's required independent code-owner approval.

Validation uses a fresh production server for each Playwright run. `npm run test:e2e` now refuses to reuse a server already listening on port 3100, preventing an older build from being tested accidentally. Stop the local development server before running acceptance tests.

Account provisioning and real hosted multi-user authentication remain outstanding. No database credentials, release protections, or production authority flags changed.

## Draft recovery and project context

Unfinished notebook edits now recover automatically in the same browser. Recovery is a separate, bounded, versioned record from explicitly saved notes. Replacing unfinished work requires confirmation; deleted saved notes cannot return through an old recovery edit. Storage failures remain visible, and Markdown export remains available. Browser recovery is not a shared workspace or an encrypted backup.

The work board includes first-contribution, documentation, and security shortcuts, plus removable active-filter chips. Removing a chip preserves the other filters and the selected view. Query values are normalized against the actual catalogue, and long queries wrap on small screens.

Each published project offers a downloadable Markdown brief containing its public objective, context, tasks, acceptance criteria, dependencies, and review requirements. It includes canonical task links and the snapshot time. The export uses an explicit field allowlist and excludes profiles, conversations, and private notebook content. Downloading a brief grants no assignment or release authority.
