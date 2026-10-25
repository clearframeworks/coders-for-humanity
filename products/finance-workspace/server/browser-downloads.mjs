import {readFile, readdir, realpath, stat, writeFile, rename, unlink} from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {parseTransactions} from '../dist/engine.mjs';

// Explicitly enabled local transport. Names are filters, not authentication:
// stable contents must validate against an exact supported native CSV schema.
export class BrowserDownloads {
  constructor(store) { this.store = store; this.running = null; this.status = {enabled:false}; }
  async scan() {
    if (this.running) return this.running;
    this.running = this.run().finally(() => { this.running = null; });
    return this.running;
  }
  async run() {
    let config;
    try { config = JSON.parse(await readFile(path.join(this.store.runtimeDir, 'browser-collector.json'), 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') { this.status = {enabled:false}; return; } throw new Error('Browser collection configuration could not be read.'); }
    this.status = {enabled:config.enabled === true, lastCheck:new Date().toISOString(), queued:0, errors:[]};
    if (!this.status.enabled || this.store.getState().mode !== 'personal') return;
    if (!path.isAbsolute(config.downloadsDir || '') || !Number.isFinite(Date.parse(config.enabledAt))) throw new Error('Invalid browser collection configuration.');
    const root = await realpath(config.downloadsDir);
    const record = this.store.db.prepare('SELECT value FROM metadata WHERE key = ?').get('browser_downloads');
    const seen = new Set(record ? JSON.parse(record.value) : []);
    for (const entry of await readdir(root, {withFileTypes:true})) {
      if (!entry.isFile() || !/^(?:cash_app_report_\d+|EXPORT(?: \(\d+\))?)\.csv$/i.test(entry.name)) continue;
      const file = path.join(root, entry.name);
      let temporary;
      try {
        const actual = await realpath(file);
        if (path.dirname(actual).toLowerCase() !== root.toLowerCase()) throw new Error('Export points outside the configured download folder.');
        const before = await stat(actual);
        // A completed browser download must have settled; partial download names
        // do not match above and files less than two seconds old wait a scan.
        if (before.mtimeMs < Date.parse(config.enabledAt) || Date.now()-before.mtimeMs < 2000 || before.size > 5000000) continue;
        const content = await readFile(actual, 'utf8'), after = await stat(actual);
        if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) continue;
        const hash = createHash('sha256').update(content).digest('hex');
        if (seen.has(hash)) continue;
        const rows = parseTransactions(content);
        if (!rows.importSummary || rows.some(r=>!['cashapp','fifththird'].includes(r.source))) throw new Error('A native Cash App or Fifth Third export is required.');
        const expected = /^EXPORT/i.test(entry.name) ? 'fifththird' : 'cashapp';
        if (rows.some(r=>r.source!==expected)) throw new Error('Export schema does not match its source filename.');
        const destination = path.join(this.store.inboxPath, `browser-${hash}.csv`);
        temporary = destination + '.' + randomUUID() + '.tmp';
        await writeFile(temporary, content, {flag:'wx'});
        await rename(temporary,destination); temporary = null;
        seen.add(hash); this.status.queued++;
      } catch (e) { this.status.errors.push({file:entry.name,message:e.message}); }
      finally { if (temporary) await unlink(temporary).catch(()=>{}); }
    }
    this.store.db.prepare('INSERT INTO metadata(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('browser_downloads',JSON.stringify([...seen].slice(-2000)));
  }
}
