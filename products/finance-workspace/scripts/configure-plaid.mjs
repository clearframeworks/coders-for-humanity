import readline from 'node:readline';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {PlaidVault, plaidConfiguration} from '../server/plaid-vault.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtimeDir = process.env.FINANCE_RUNTIME_DIR || path.join(root, 'runtime');

async function hiddenQuestion(label) {
  const terminal = readline.createInterface({input: process.stdin, output: process.stdout, terminal: true});
  let hidden = false;
  terminal._writeToOutput = value => { if (!hidden) process.stdout.write(value); };
  const answer = new Promise(resolve => terminal.question(label, value => { hidden = false; terminal.close(); process.stdout.write('\n'); resolve(value.trim()); }));
  hidden = true;
  return answer;
}

export async function configurePlaid() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run this setup interactively in a terminal. Credentials are accepted only through hidden prompts, never command-line arguments.');
  console.log('Configure your own production Plaid app. This does not create an account, buy access, activate a product, or connect a bank.');
  console.log('Use production credentials approved for Transactions. Sandbox credentials are not accepted as real account access.');
  const clientId = await hiddenQuestion('Production Plaid client ID (hidden): ');
  const secret = await hiddenQuestion('Production Plaid secret (hidden): ');
  const redirectUri = await hiddenQuestion('Approved HTTPS OAuth redirect URI, or Enter for desktop popup flow: ');
  const config = {clientId, secret, environment: 'production', redirectUri};
  const vault = new PlaidVault(runtimeDir);
  const valid = plaidConfiguration(vault, {PLAID_CLIENT_ID: clientId, PLAID_SECRET: secret, PLAID_ENV: 'production', PLAID_REDIRECT_URI: redirectUri});
  if (!valid.configured) throw new Error(valid.message);
  const dbPath = path.join(runtimeDir, 'finance.sqlite');
  if (!existsSync(vault.keyPath) && existsSync(dbPath)) {
    const db = new DatabaseSync(dbPath, {readOnly: true});
    try {
      const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'bank_items'").get();
      if (table && db.prepare('SELECT COUNT(*) AS count FROM bank_items').get().count) throw new Error('Existing bank connections have a missing encryption key. Restore the original runtime/plaid.key before saving setup.');
    } finally { db.close(); }
  }
  vault.saveConfig(config);
  console.log('Encrypted production configuration saved under runtime. Keep its matching plaid.key private. Restart the local finance service, then use Connect bank on the computer.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await configurePlaid(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
