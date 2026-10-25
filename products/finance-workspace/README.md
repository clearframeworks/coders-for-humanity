# Your finances

Free personal cash-flow planning, bills, transaction imports and spending comparisons. Runs on your own computer, with no account or AI subscription required. Full editable source is included under the MIT license.

**Windows:** extract the download, then double-click **Start-Finances.cmd**. The app opens in your browser. On first start it downloads a checksum-verified, private copy of Node.js if a compatible version is not already installed. Keep the extracted folder somewhere writable. Windows or your organisation may ask you to allow downloaded software.

Enter your available money, bills and paychecks, or explore the fictional example in the app. Import transaction CSVs from Settings & tools. Your own plan starts empty.

Double-click **Stop-Finances.cmd** to stop the service. Closing the browser leaves the service running. Your data is saved under `runtime/`; export a backup inside the app before moving or deleting the folder. That data is not encrypted by this app.

macOS / Linux: install Node.js 24 or newer, then run `npm start` in this folder and open http://127.0.0.1:4317. There are no packages to install. The Windows launcher uses port 4318 and never enables network access. Automatic first-start setup supports Windows x64 and ARM64 and requires internet access; later starts can run offline.

## Optional AI

The normal app makes no model requests. To let a compatible local MCP client read your finances, configure `node` with the absolute path to `scripts/ai-bridge.mjs` as its argument. The Windows portable executable is under `runtime/tools/` if needed. In the app, enable AI access for a 15-minute session when you want it. The bridge is read-only; your AI provider's own terms and charges apply. You can keep AI access off and use every core planning feature.

## Optional imports

Generic CSV, Cash App statement exports and Fifth Third CSV exports are supported. Drop complete CSV files into `runtime/inbox/` for automatic import while the service runs, or import in the app. Neither manual entry nor statement import needs a bank connection.

The included browser collector and bank adapter are optional. Live bank sync needs your own approved Plaid production access and bank consent; it is not preconfigured. Run `node scripts/configure-plaid.mjs` only if you choose to set it up. Never share the `runtime/` folder: it contains your database, imported files, private configuration and any bank encryption keys.

Forecasts depend on the balances, dates and spending you enter. Review suggested transaction categories and estimates before relying on them. Imported history does not automatically change your available-money snapshot.

For development, run `npm test`. Source lives in `dist/` (browser code), `server/`, `scripts/` and `browser-connector/`; `dist/` contains the readable application source and needs no build step.
