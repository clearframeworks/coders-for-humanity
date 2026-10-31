# CFH Tracker — unreleased native starter

This is an unlisted development product, not an available download or a working live tracking service. No native binary has been built or installed.

The Expo / React Native app implements a temporary local session review: enter a purpose and duration, approve or decline, stop, revoke consent, and expire the session. Starting a session does not capture data. Sessions live only in process memory; a new session replaces the previous ended session. Restarting clears all sessions and never resumes a session automatically.

There are no location or background permissions, sensors, API endpoints, accounts, external requests, callbacks or connected apps. There is no stored tracking history. The pure lifecycle module is a local control model, not a trusted server boundary.

## Run locally

From this directory:

```powershell
npm ci
npm test
npm run config:check
npm run bundle:check
npm start
```

Use a compatible Expo Go installation or a local native development build. A Metro bundle proves source compilation, not physical-device acceptance. Account sign-in, native build tooling, signing and installation may be required for the chosen device workflow. Nothing in this starter sets up an account or remote build.

## Next implementation decisions

Owner-confirmed target: **“It tracks the device logged in.”** A session is intended to concern the authenticated device. The starter does not yet implement login or bind a session to an authenticated device.

Clarify which device signals are tracked: physical location, online presence, activity or another event source. Confirm operating-system targets, the login system and the first consuming app. Then implement a concrete capture adapter, durable storage and authenticated delivery with explicit consent, retention and failure recovery. Login alone does not start collection in this starter.

Another app must request a bounded session, identify the requested data and duration, and return control to the tracker for approval. A URL scheme alone cannot authenticate the caller. Do not send tokens or private tracking data in callback URLs. No cross-app protocol is exposed by this starter.

## Verification boundaries

Lifecycle tests cover explicit consent, decline, start/stop/revoke rules, exact deadline expiration, invalid input and clock regression. UI source uses that lifecycle module and refreshes expiry when the app returns to the foreground. Device interaction, safe-area layout, screen readers, OS suspension and real app integration still need device acceptance.

No CFH web app, production service, credentials, runtime authority flags or nonprofit legal status are changed by this product.

## Checks on October 30, 2026

- `npm test`: 5 tests passed, including consent denial, expiry and backwards time rejection.
- `npm run config:check`: passed; Expo SDK 58 configuration, Android permissions empty.
- `npm run bundle:check`: passed; Android Hermes bundle compiled from 614 modules. This is not an APK or an installed application.
- `npm audit`: failed, with 8 findings (5 low, 3 high, including inherited package findings). The underlying dependencies are `expo@58.0.20` → `@expo/cli@58.1.17` → `zod@3.25.76` (high, GHSA-mrhx-c7xc-m3w5), and `expo@58.0.20` → `@expo/config@58.0.9` → `deepmerge@4.3.1` (low, GHSA-gcqx-w48m-w2h4). npm proposes a breaking SDK downgrade; it was not applied. Review compatible upstream fixes before distribution. No dependency override was introduced.

Native device testing and accessibility/layout acceptance remain pending. Lockfile is included; generated bundle output and installed dependencies are ignored.
