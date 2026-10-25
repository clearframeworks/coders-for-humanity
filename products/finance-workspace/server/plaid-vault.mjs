import {randomBytes, createCipheriv, createDecipheriv} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync, renameSync} from 'node:fs';
import path from 'node:path';
import {InputError} from './validation.mjs';

export class PlaidVault {
  constructor(runtimeDir) {
    this.runtimeDir = runtimeDir;
    this.keyPath = path.join(runtimeDir, 'plaid.key');
    this.configPath = path.join(runtimeDir, 'plaid-config.enc.json');
  }
  key(create = false) {
    if (!existsSync(this.keyPath)) {
      if (!create || existsSync(this.configPath)) throw new InputError('The local bank encryption key is missing. Restore the original runtime/plaid.key before using saved bank connections.', 503);
      mkdirSync(this.runtimeDir, {recursive: true});
      try { writeFileSync(this.keyPath, randomBytes(32), {flag: 'wx', mode: 0o600}); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    const key = readFileSync(this.keyPath);
    if (key.length !== 32) throw new InputError('The local bank encryption key is invalid. Restore the original runtime/plaid.key.', 503);
    return key;
  }
  encrypt(value, purpose, createKey = false) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key(createKey), iv);
    cipher.setAAD(Buffer.from(purpose));
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return JSON.stringify({v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64')});
  }
  decrypt(value, purpose) {
    try {
      const record = JSON.parse(value);
      if (record.v !== 1) throw new Error('version');
      const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(record.iv, 'base64'));
      decipher.setAAD(Buffer.from(purpose)); decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(record.data, 'base64')), decipher.final()]).toString('utf8');
    } catch { throw new InputError('Saved bank credentials could not be decrypted. Restore the matching original bank key; no connection data was overwritten.', 503); }
  }
  saveConfig(config) {
    const encrypted = this.encrypt(JSON.stringify(config), 'finance-plaid-config-v1', true);
    const temporary = `${this.configPath}.${randomBytes(6).toString('hex')}.tmp`;
    writeFileSync(temporary, encrypted, {flag: 'wx', mode: 0o600}); renameSync(temporary, this.configPath);
  }
  readConfig() {
    if (!existsSync(this.configPath)) return null;
    return JSON.parse(this.decrypt(readFileSync(this.configPath, 'utf8'), 'finance-plaid-config-v1'));
  }
}

export function plaidConfiguration(vault, env = process.env) {
  try {
    const hasEnv = !!(env.PLAID_CLIENT_ID || env.PLAID_SECRET);
    const file = hasEnv ? null : vault.readConfig();
    const config = hasEnv ? {clientId: env.PLAID_CLIENT_ID, secret: env.PLAID_SECRET, environment: env.PLAID_ENV || 'production', redirectUri: env.PLAID_REDIRECT_URI || ''} : file || {environment: 'production'};
    const missing = [['PLAID_CLIENT_ID', config.clientId], ['PLAID_SECRET', config.secret]].filter(([, value]) => typeof value !== 'string' || !value.trim()).map(([name]) => name);
    if (config.environment !== 'production') return {configured: false, environment: 'production', missing, message: 'This bank adapter accepts production Plaid credentials only. Sandbox data cannot be presented as real accounts.'};
    if (missing.length) return {configured: false, environment: 'production', missing, message: 'Real bank linking needs your own production Plaid app credentials. Run node scripts/configure-plaid.mjs on this computer, then restart the app.'};
    if (config.redirectUri) {
      const uri = new URL(config.redirectUri);
      if (uri.protocol !== 'https:' || uri.username || uri.password || uri.hash) throw new Error('redirect');
    }
    return {configured: true, environment: 'production', missing: [], message: 'Production credentials are configured. Bank access is confirmed only after you complete Plaid Link. Some banks also require an approved OAuth redirect URI.', config};
  } catch { return {configured: false, environment: 'production', missing: [], message: 'The local Plaid configuration could not be read or its HTTPS redirect is invalid. Check the local bank key and setup configuration; nothing was sent to Plaid.'}; }
}
