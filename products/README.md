# Software catalog

[Back to the hub](../README.md) · [Web catalog](https://cfh.retehost.com/software)

Every app below includes its complete editable source. Download a product on its own, or [download the whole repository](https://github.com/clearframeworks/coders-for-humanity/archive/refs/heads/main.zip).

## Your finances

Plan paydays, bills, and daily spending, import transaction CSVs, and compare changes before saving a plan. Your records stay on your computer. AI is optional and off by default.

**[Download ZIP](https://github.com/clearframeworks/coders-for-humanity/raw/refs/heads/main/public/downloads/finance-workspace.zip)** · [Full source](finance-workspace/) · [Product page](https://cfh.retehost.com/software/finance-workspace) · [Checksum](../public/downloads/finance-workspace.sha256)

Windows: extract the ZIP and double-click **Start-Finances.cmd** inside its folder. First setup downloads a runtime if needed. Windows x64 startup is tested; ARM64 is supported by the launcher but has not been tested on ARM hardware. On macOS or Linux, use Node.js 24 or newer and `npm start`. [More about the app](finance-workspace/README.md).

License: [MIT](finance-workspace/LICENSE).

## CFH community platform

The community platform's source is at the repository root. Its [guide](../docs/community-platform.md) covers local startup, hosting, account setup, and verification. [Visit the community](https://cfh.retehost.com).

## Adding a product

Give each new app a dedicated `products/<product-name>/` folder with:

- Complete source and a license, excluding private records, credentials, and runtime files.
- A short README that explains what the app does and how to start it.
- A launcher or the smallest practical setup path, with platform requirements stated beside the download.
- A dedicated page under `app/software/<product-name>/`, linked from the web catalog.
- A full-source download under `public/downloads/`, with a checksum and a repeatable packaging check.

List the finished product here and in the root README. State whether AI is required or optional. Verify the extracted download starts clean and preserves data after restart before listing it as ready to use.
