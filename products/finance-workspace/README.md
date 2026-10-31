# Your finances

Free personal cash-flow planning, bills, transaction imports and spending comparisons. Runs on your own computer, with no account or AI subscription required. Full editable source is included under the MIT license.

**Windows installer:** run **Your-Finances-Setup-1.1.1-x64.exe**, install for your account, then open **Your finances** from your desktop or Start menu. Node.js is included; no terminal or administrator account is needed. The installer is unsigned; Windows may show an unknown-publisher or SmartScreen prompt.

Your installed data is kept in `%LOCALAPPDATA%/CFH/Your finances/runtime`, separately from the app. Updates and uninstall preserve it. To stop the service, use **Stop Your finances** in the Start menu. Closing the browser leaves the local service running. Export backups in the app.

Both installed and portable versions store financial data without app-level encryption. Protect your Windows account, computer and exported backups.

**Portable source download:** extract the ZIP, then double-click **Start-Finances.cmd**. The app opens in your browser. On first start it downloads a checksum-verified, private copy of Node.js if a compatible version is not already installed. Keep the extracted folder somewhere writable. Windows or your organisation may ask you to allow downloaded software.

Enter your available money, bills and paychecks, or explore the fictional example in the app. Import transaction CSVs from Settings & tools. Your own plan starts empty.

Double-click **Stop-Finances.cmd** to stop the service. Closing the browser leaves the service running. For the portable download, your data is saved under `runtime/`; export a backup inside the app before moving or deleting the folder. That data is not encrypted by this app.

macOS / Linux: install Node.js 24 or newer, then run `npm start` in this folder and open http://127.0.0.1:4317. There are no packages to install. The portable Windows launcher uses port 4318; the installed app automatically finds a free port from 4318 to 4338 and remembers it. Both listen only on this computer. Automatic first-start setup supports Windows x64 and ARM64 and requires internet access; later starts can run offline.

## Optional AI

The normal app makes no model requests. To let a compatible local MCP client read your finances, configure `node` with the absolute path to `scripts/ai-bridge.mjs` as its argument. The installed runtime is `vendor/node/node.exe` inside the application folder; the portable runtime is under `runtime/tools/`. The bridge automatically finds the matching installed or portable data folder. In the app, enable AI access for a 15-minute session when you want it. The bridge is read-only; your AI provider's own terms and charges apply. You can keep AI access off and use every core planning feature.

## Optional imports

Generic CSV, Cash App statement exports and Fifth Third CSV exports are supported. Drop complete CSV files into the `inbox/` folder under your data directory for automatic import while the service runs, or import in the app. Neither manual entry nor statement import needs a bank connection.

The included browser collector is optional. It works in your own signed-in browser and never sends your bank sign-in or data to a third-party aggregator. Never share the `runtime/` folder: it contains your database, imported files and private configuration.

Forecasts depend on the balances, dates and spending you enter. Review suggested transaction categories and estimates before relying on them. Imported history does not automatically change your available-money snapshot.

For development, run `npm test`. Source lives in `dist/` (browser code), `server/`, `scripts/` and `browser-connector/`; `dist/` contains the readable application source and needs no build step.

## Email updates and balance dates

The screen refreshes saved data every minute while the app runs. Mailbox collection is a separate, optional connection: Settings shows its last actual check, pending request, and any error. A fresh installation does not include access to your email.

Your calculated balance starts with the amount and date you enter, subtracts new charges and adds known credits. Pending and reported charges reserve funds once. Matching statement records and repeated emails do not deduct the same payment again. Choose the charge source for each account in Accounts; setting a fresh starting balance absorbs already known activity. Original starting balances and transaction history are preserved.
