import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Installed data lives outside replaceable application files. Explicit runtime
 * overrides remain available for isolated tests and intentional integrations. */
export function resolveRuntimeDir({root = ROOT, env = process.env} = {}) {
  if (env.FINANCE_RUNTIME_DIR) return path.resolve(env.FINANCE_RUNTIME_DIR);
  const marker = path.join(root, 'installed.json');
  if (!existsSync(marker)) return path.join(root, 'runtime');
  const configuration = JSON.parse(readFileSync(marker, 'utf8').replace(/^\uFEFF/, ''));
  if (configuration.product !== 'cfh-finance-workspace' || configuration.installed !== true) throw new Error('The installed app configuration is invalid. Run the installer again.');
  if (!env.LOCALAPPDATA) throw new Error('Your Windows local application data folder is unavailable.');
  return path.join(env.LOCALAPPDATA, 'CFH', 'Your finances', 'runtime');
}
