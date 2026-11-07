# Private local password vault — setup files

This is a starter for Vaultwarden, a community-maintained Bitwarden-compatible server, not an official Bitwarden product. Password data is stored on this computer in a Docker volume. The service binds to localhost by default. It can run without a cloud service after the required images and apps have been downloaded. **The server has been started locally and HTTPS has been tested on loopback; the complete account, phone, and recovery flows have not been tested or audited here.** Do not import real passwords until you have tested access and recovery.

## Install and create your account

1. Install and start Docker Desktop with Linux containers. Open PowerShell in this folder. Internet access is needed to download the container image on first start.
2. Stop phone access before enabling registration. With the same `TETHER_IP` used to start the phone proxy, run the commands below. If either command fails, or the second command prints a container ID, **do not enable registration**. If you have not set up phone access, use the Windows manager instead; it stops the proxy before opening registration.

   ```powershell
   docker compose -f compose.yaml -f phone.yaml stop phone_https
   if ($LASTEXITCODE -ne 0) { throw 'Could not stop phone access.' }
   $phoneRunning = docker compose -f compose.yaml -f phone.yaml ps --status running -q phone_https
   if ($LASTEXITCODE -ne 0 -or $phoneRunning) { throw 'Phone access could not be confirmed stopped.' }
   ```

3. Temporarily enable account registration and start the service:

   ```powershell
   $env:VAULT_SIGNUPS_ALLOWED = 'true'
   docker compose up -d
   ```

4. On this computer open http://localhost:8787, create an account and choose a unique master password. A lost master password cannot be recovered by this setup. Test two-step login if supported by your client and preserve recovery codes separately.
5. Immediately turn off new account registration:

   ```powershell
   $env:VAULT_SIGNUPS_ALLOWED = 'false'
   docker compose up -d --force-recreate
   ```

6. Confirm that you can log in and that creating a second account is refused. Signups must remain disabled except during deliberate account enrollment.

## Optional: phone over local tether or hotspot

This supplies a local HTTPS proxy rather than sending passwords over plain HTTP. It does not require a third-party online service. Setup requires knowing the computer's tether network IP address, and installing a private certificate authority on the phone. Trusting a CA permits it to validate other sites too: protect its private key, use it only on devices you control, and remove trust when no longer needed. Android and iOS versions differ in CA installation and trust, and many apps do not trust user-installed CAs. The mobile browser route is the intended starting point; the Bitwarden phone app may reject the certificate. This path has **not** been tested on a phone or hotspot.

1. Connect the PC and phone over the hotspot or tether, and use `ipconfig` to identify the computer's IPv4 address on that network. Confirm the phone can reach that address. Some hotspot configurations isolate clients or change addresses; use an address both devices can reach.
2. With signups disabled, set the address and start the HTTPS proxy (Docker must be able to pull Caddy on first use):

   ```powershell
   $env:TETHER_IP = '192.168.1.10' # Replace with the computer's actual tether IP
   $env:VAULT_SIGNUPS_ALLOWED = 'false'
   docker compose -f compose.yaml -f phone.yaml up -d
   docker compose -f compose.yaml -f phone.yaml cp phone_https:/data/caddy/pki/authorities/local/root.crt .\local-vault-root.crt
   ```

3. Transfer `local-vault-root.crt` to your phone through a trusted connection and install it as a trusted CA using your phone's current instructions. iOS also requires enabling full trust for the installed root certificate. Do not transfer the private key. The public certificate is not the private key. Check the phone actually trusts the certificate; do not bypass browser warnings.
4. In the phone browser open `https://<computer-IP>:8443`, using the same IP. Confirm the certificate is trusted and sign in. The computer must remain on. If the IP changes, update `TETHER_IP`, recreate the stack and use the new HTTPS address. Keep port 8443 limited to the tether interface in firewall settings. The proxy is bound to the specified IP, but network and Docker behavior vary; verify it is not reachable from other networks.
5. Stop phone access with `docker compose -f compose.yaml -f phone.yaml stop phone_https`. To return the vault domain to localhost, run `docker compose up -d --force-recreate` with `VAULT_SIGNUPS_ALLOWED` still false. Remove the installed CA from the phone when you no longer need it.

## Import and backup

Use the vault's import function and instructions for the source password manager. Exported CSV and JSON can contain plaintext passwords: handle them on a trusted computer and securely dispose of temporary copies. Keep an independent encrypted backup and test restoring it before relying on this vault. Back up the complete Docker volume using Vaultwarden's documented backup procedure; a plain copy while SQLite is active may be inconsistent. Protect the backup and master password. Never casually run `docker compose down -v`: it deletes stored vault data.

## API and AI access

A separate manual, one-time local grant tool is included as described below. Direct vault-item access is disabled pending security review. No AI connector or audit system is provided. Do not give an AI agent the master password, unlocked vault, vault database, or broad API token. These features require a separately designed and tested permission system. A recipient who receives a password can retain it after access is revoked; rotate the password if necessary. Bitwarden Send may support expiring sharing in compatible clients, but has not been verified here and is not an AI permission system.

## References

- https://github.com/dani-garcia/vaultwarden
- https://github.com/dani-garcia/vaultwarden/wiki/Using-Docker-Compose
- https://github.com/dani-garcia/vaultwarden/wiki/Backing-up-your-vault
- https://caddyserver.com/docs/automatic-https#local-https

## Windows manager and one-time local access

Run **Install Local Vault.cmd** to install the manager and desktop shortcut, or double-click **Open Vault Manager.cmd** to run it from this folder. Docker Desktop is required for the vault; Node.js is required only for one-time grants. The manager is a launcher, not an installer, and has not been tested through its full graphical workflow.

To share a single password with a local program, open **Create one-time access grant**, paste only that password and choose a duration. The grant service keeps the password in process memory, not a vault connection or disk. Copy the token to the local program; the program sends it in the `Authorization: Bearer <token>` header in a POST to `http://127.0.0.1:8788/consume`. A valid token retrieves the one secret once, before expiry. You can revoke an unused grant; closing the manager stops the service and discards its grants. Do not paste tokens in terminal commands, URLs, logs, or shared chats. A recipient can save the secret even after access is revoked. Direct vault-item access is disabled pending security review; this manual grant has not been tested with an AI integration. Other software running as your Windows user may be able to access local processes or the clipboard. Only use this on a trusted computer.




During initial account creation, the manager stops phone HTTPS before enabling registration. It attempts to disable registration after five minutes or when the manager closes normally, and checks the container configuration. A crash, forced termination, or Docker failure can prevent that cleanup: reopen the manager, select Turn registration off, and confirm the result. This does not replace testing account creation and login.


## Source and third-party software

The files in this folder are distributed under the accompanying MIT license. They configure separately distributed software, including [Vaultwarden](https://github.com/dani-garcia/vaultwarden) and [Caddy](https://github.com/caddyserver/caddy), which have their own licenses. Docker Desktop and Node.js are separate dependencies and are not included. The experimental direct-vault grant is disabled by default and requires additional components; no AI integration is included. This folder contains no vault data or configuration from the original computer.
