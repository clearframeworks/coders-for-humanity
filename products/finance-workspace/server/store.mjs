import {categoryForHistory} from '../dist/spending-plan.mjs';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {readdir, readFile, stat, rename, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseTransactions, mergeTransactions} from '../dist/engine.mjs';
import {InputError, validateState} from './validation.mjs';
import {reconcileEmailHistory} from './email-alerts.mjs';

const APP_ROOT = fileURLToPath(new URL('../', import.meta.url));
export function defaultState() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: process.env.FINANCE_TIME_ZONE || 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date()).map(part => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return {version: 1, mode: 'personal', plan: {startDate: date, balance: 0, cushion: 0, dailySpend: 0, horizon: 30, accounts: [{id: 'manual', name: 'Available money', balance: 0}], paychecks: [], bills: []}, transactions: []};
}

export class Store {
  constructor({runtimeDir = path.join(APP_ROOT, 'runtime'), initialState} = {}) {
    this.runtimeDir = path.resolve(runtimeDir);
    this.inboxPath = path.join(this.runtimeDir, 'inbox');
    this.archivePath = path.join(this.runtimeDir, 'archive');
    this.errorPath = path.join(this.runtimeDir, 'errors');
    for (const directory of [this.runtimeDir, this.inboxPath, this.archivePath, this.errorPath]) mkdirSync(directory, {recursive: true});
    this.db = new DatabaseSync(path.join(this.runtimeDir, 'finance.sqlite'));
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;');
    this.db.exec(`CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS imports (digest TEXT PRIMARY KEY, filename TEXT NOT NULL, completed_at TEXT NOT NULL, added INTEGER NOT NULL, duplicates INTEGER NOT NULL);`);
    const schema = this.db.prepare('SELECT value FROM metadata WHERE key = ?').get('schema_version');
    if (schema && schema.value !== '1') { this.db.close(); throw new Error(`Unsupported database schema ${schema.value}.`); }
    this.db.prepare('INSERT OR IGNORE INTO metadata(key, value) VALUES (?, ?)').run('schema_version', '1');
    if (!this.db.prepare('SELECT id FROM app_state WHERE id = 1').get()) {
      const state = structuredClone(initialState || defaultState()); validateState(state); delete state.revision;
      this.db.prepare('INSERT INTO app_state(id, data, revision, updated_at) VALUES (1, ?, 1, ?)').run(JSON.stringify(state), new Date().toISOString());
    }
    this.intervalMs = 60000; this.automationEnabled = false; this.collecting = null;
  }
  getState() {
    const row = this.db.prepare('SELECT data, revision FROM app_state WHERE id = 1').get();
    return {...JSON.parse(row.data), revision: row.revision};
  }
  setState(value, {expectedRevision = value?.revision} = {}) {
    const state = structuredClone(value); validateState(state);
    const current = this.getState();
    if (expectedRevision !== undefined && (!Number.isInteger(expectedRevision) || expectedRevision !== current.revision)) throw new InputError('Your plan changed since it was loaded. Reload the latest state before saving to avoid losing changes.', 409);
    delete state.revision;
    const result = this.db.prepare('UPDATE app_state SET data = ?, revision = revision + 1, updated_at = ? WHERE id = 1 AND revision = ?').run(JSON.stringify(state), new Date().toISOString(), current.revision);
    if (Number(result.changes) !== 1) throw new InputError('State changed during saving. Reload and retry.', 409);
    return this.getState();
  }
  getAutomationStatus() {
    const record = this.db.prepare('SELECT value FROM metadata WHERE key = ?').get('automation_status');
    return {enabled: this.automationEnabled, intervalMs: this.intervalMs, inboxPath: this.inboxPath, storagePath: path.join(this.runtimeDir, 'finance.sqlite'), ...(record ? JSON.parse(record.value) : {lastRun: null, lastSuccess: null, lastError: null, added: 0, duplicates: 0, processed: 0, errors: []})};
  }
  getAiAccess() {
    const row = this.db.prepare('SELECT value FROM metadata WHERE key = ?').get('ai_access_expires_at');
    const expiresAt = row?.value || null;
    return {enabled: !!expiresAt && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) > Date.now(), expiresAt};
  }
  setAiAccess(enabled) {
    if (typeof enabled !== 'boolean') throw new InputError('AI access enabled must be true or false.');
    const expiresAt = enabled ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : '';
    this.db.prepare('INSERT INTO metadata(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('ai_access_expires_at', expiresAt);
    return this.getAiAccess();
  }
  async collect() {
    if (this.collecting) return this.collecting;
    this.collecting = this.scanInbox();
    try { return await this.collecting; } finally { this.collecting = null; }
  }
  async scanInbox() {
    const previous = this.getAutomationStatus();
    const result = {lastRun: new Date().toISOString(), lastSuccess: previous.lastSuccess, lastError: null, added: 0, updated: 0, removed: 0, duplicates: 0, processed: 0, errors: []};
    let files;
    try { files = await readdir(this.inboxPath, {withFileTypes: true}); }
    catch (error) { result.lastError = `Cannot read inbox: ${error.message}`; result.errors.push({file: null, message: result.lastError}); files = []; }
    if (this.getState().mode !== 'personal' && files.some(entry => entry.isFile() && /\.csv$/i.test(entry.name))) {
      result.lastError = 'Inbox collection is paused while an example plan is active. Switch to your own plan to import these files; originals remain in the inbox.';
      result.errors.push({file: null, message: result.lastError});
      files = [];
    }
    for (const entry of files.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isFile() || !/\.csv$/i.test(entry.name)) continue;
      const inputPath = path.join(this.inboxPath, entry.name);
      const uniqueName = `${Date.now()}-${randomUUID()}-${entry.name}`;
      let committed = false;
      try {
        const before = await stat(inputPath);
        if (before.size > 5000000) throw new Error('CSV exceeds the 5 MB import limit.');
        const content = await readFile(inputPath, 'utf8');
        const after = await stat(inputPath);
        if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) continue;
        const digest = createHash('sha256').update(content).digest('hex');
        let added = 0, updated = 0, removed = 0, duplicates = 0;
        const rows = parseTransactions(content);
        this.db.exec('BEGIN IMMEDIATE');
        try {
          const state = this.getState();
          if (state.mode !== 'personal') {
            const paused = new Error('Inbox collection paused because an example plan became active. The original file remains in the inbox.');
            paused.keepInbox = true; throw paused;
          }
          const incoming=state.plan.forecastBasis?.ownerPurposeRules?rows.map(row=>({...row,category:categoryForHistory(row)})):rows;
          const merged = mergeTransactions(state.transactions, incoming);
          const emailMatch = reconcileEmailHistory(this,merged.transactions);
          merged.transactions = emailMatch.transactions; merged.removed += emailMatch.reconciled;
          ({added, updated, removed, duplicates} = merged);
          if (added || updated || removed) { state.transactions = merged.transactions; this.setState(state); }
          this.db.prepare('INSERT INTO imports(digest, filename, completed_at, added, duplicates) VALUES (?, ?, ?, ?, ?) ON CONFLICT(digest) DO UPDATE SET filename = excluded.filename, completed_at = excluded.completed_at, added = excluded.added, duplicates = excluded.duplicates').run(digest, entry.name, new Date().toISOString(), added, duplicates);
          this.db.exec('COMMIT');
        } catch (error) { this.db.exec('ROLLBACK'); throw error; }
        committed = true;
        result.added += added; result.updated += updated; result.removed += removed; result.duplicates += duplicates; result.processed++;
        result.lastSuccess = new Date().toISOString();
        await rename(inputPath, path.join(this.archivePath, uniqueName));
      } catch (error) {
        const message = committed ? `Data was saved, but archiving failed: ${error.message}. The inbox file is retained for retry.` : error.message;
        result.lastError = message; result.errors.push({file: entry.name, message});
        if (!committed && !error.keepInbox) {
          try {
            const destination = path.join(this.errorPath, uniqueName);
            await rename(inputPath, destination);
            await writeFile(`${destination}.error.txt`, `${message}\n`, {flag: 'wx'});
          } catch (moveError) { result.errors.push({file: entry.name, message: `Could not isolate the original file: ${moveError.message}`}); }
        }
      }
    }
    this.db.prepare('INSERT INTO metadata(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('automation_status', JSON.stringify(result));
    return {...this.getAutomationStatus(), ...result};
  }
  close() { this.db.close(); }
}
