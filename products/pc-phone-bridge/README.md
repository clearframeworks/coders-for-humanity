# PC Bridge

A small local app library for web apps running on your Windows PC. It stays bound to `127.0.0.1`; it does not open a firewall port, configure a router, or publish anything to the internet. It is an original implementation inspired by the app-library and local-hosting ideas discussed during research; it does not contain Collabhost code.

## What you need

- Windows and Node.js (version 20 or newer). Node is not bundled in this early build.
- A web app already running on this PC and listening on `127.0.0.1`.
- To connect a phone, install Tailscale on the PC and phone and sign both into your private tailnet. The PC must be on and awake. Tailscale is a separate service, and using it may involve its coordination servers or relays.

## Start and add an app

Double-click `Start Bridge.cmd`. The first run creates a private access key in your Windows user profile and opens the local portal. Keep the window open while using the bridge. To see the key, run `Show Access Key.cmd` on the PC.

Open PowerShell in this folder, then register a running app (replace the example values):

```
node bridge.js add my-app 3000 "My App"
node bridge.js list
node bridge.js remove my-app
```

The port must belong to a trusted local web app; the bridge does not start or manage the app. Refresh the portal after adding or removing it. The registry and access key persist in `%LOCALAPPDATA%\PCPhoneBridge`. Protect this folder as you would a password. Deleting `access-key.txt` while the bridge is stopped generates a new key on the next start and invalidates old sessions.

## Phone connection

With Tailscale installed and connected on both devices, use its private Serve feature to forward HTTPS to the bridge. In an administrator PowerShell window on the PC:

```
tailscale serve --bg 46820
```

Use the HTTPS address that Tailscale prints on your phone, then enter the key from the PC. This requires a working Tailscale account and policy, and Tailscale may prompt you to enable HTTPS. To remove this configuration, inspect `tailscale serve status` and use the current Tailscale documentation for the appropriate reset command. Do not use Funnel, which publishes to the internet, for this setup.

## Important limits

This is an early local build, not a completed installer or a general-purpose remote desktop. The bridge supports basic HTTP apps under `/app/<id>/`. Basic WebSocket forwarding and app cookies are supported, but apps that assume they live at the root, use absolute redirects/assets, depend on a particular cookie domain or path, or expect a particular origin may not work. WebSocket behavior has not yet been tested against a real app. It cannot make a Windows desktop program into a phone app. A stopped or sleeping PC cannot serve apps. Access to the portal should be restricted to your own trusted devices and apps: the access key is a second layer, not a substitute for a private network. The key is sent over the connection, so use Tailscale HTTPS; do not expose the bridge directly to a LAN or the internet. The bridge does not automatically update or start with Windows.


## Trust and security limits

All proxied apps share the bridge's browser origin. A malicious or compromised app could interact with the portal or other apps. Register only apps you trust equally; do not use this prototype with sensitive apps or data. The Windows access-key file is stored in your user profile; restrictive Windows file permissions have not been verified, so check who can read that folder before use. Login attempts are temporarily throttled in memory; restarting the bridge resets the limit. This prototype has not received an independent security audit and is not ready for public exposure.
