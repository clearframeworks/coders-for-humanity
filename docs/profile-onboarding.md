# Profile onboarding and photography

Visitors enter `/join` from the header, sidebar, homepage, People directory, login page, or disconnected account page. The three steps collect identity, contribution interests, and an explicit visibility choice. The preview uses initials rather than a fictional member portrait. Profiles default to private. Local drafts are versioned, size-bounded, validated on restoration, and removable.

## Account boundary

An unconnected installation allows profile preparation and preview only. It identifies this before onboarding begins and never reports that an account or shared profile was created. No database credentials or provisioning changes are included in this release.

When the dedicated Supabase service is configured, a new contributor verifies their email or signs in with GitHub, returns to `/join`, reviews the browser draft, and explicitly creates the profile. Email registration uses `shouldCreateUser: true`; existing-account email sign-in uses `false`. Existing profiles go to `/account`. Email verification should be completed in the same browser so the local draft and PKCE session are available. Another browser can start a new draft after authentication.

The save operation uses verified `auth.getUser()`, existing origin validation, shared schema validation, and owner-only database policies. No role, review, moderation, or deployment permission is granted by signup. Public directory placement is opt-in. Username uniqueness is enforced at save, not claimed by the preview.

## Remaining hosted verification

On October 3, 2026 the owner chose the existing `retehost-cfw` project with CFH data in separate schemas. See `supabase/shared/README.md` for the isolated migration and the current read-only database blocker. After that blocker is resolved, configure exact callback URLs and email delivery, verify any enabled OAuth provider, apply and audit the shared-schema migration, and exercise real signup and two-user isolation. Local policy tests do not substitute for hosted auth checks.

## Photography

Four real photographs replace the homepage decoration and project card artwork, introduce photographed program cards, and anchor the project overview and profile preview. They are local assets with responsive image optimization. Licensing and source details are in `public/photos/README.md` and `/photo-credits`. Photos are illustrative and do not claim an existing CFH team or completed fieldwork.

## Release path

This change uses a feature branch and preview. Main requires the three CI checks. The owner has final release authority under `docs/owner-authority.md`; everyone else requires owner approval or explicit delegation.
