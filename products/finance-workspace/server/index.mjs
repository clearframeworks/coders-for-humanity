import {resolveRuntimeDir} from './runtime-path.mjs';
import {categoryForHistory} from '../dist/spending-plan.mjs';
import {projectForecast} from '../dist/projection.mjs';
import http from 'node:http';
import path from 'node:path';
import {readFile, stat, realpath} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {Store} from './store.mjs';
import {BrowserDownloads} from './browser-downloads.mjs';
import {readEmailStatus,readBalanceReceipts,readEmailAlerts,reconcileEmailHistory,requestEmailCheck,readEmailCheckRequest} from './email-alerts.mjs';
import {InputError, validateScenario, validateState} from './validation.mjs';
import {forecast} from '../dist/engine.mjs';
import {LanAuth} from './lan-auth.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MAX_BODY = 2 * 1024 * 1024;
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'};

function sendJson(res, status, value) { res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'}); res.end(JSON.stringify(value)); }
async function jsonBody(req) {
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new InputError('Send a JSON request body with Content-Type: application/json.', 415);
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) throw new InputError('JSON body exceeds 2 MB.', 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new InputError('Request body must contain valid JSON.'); }
}

export async function startServer({port = 4317, lan = false, host = lan ? '0.0.0.0' : '127.0.0.1', lanAddresses, now = Date.now, runtimeDir = resolveRuntimeDir(), distDir = path.join(ROOT, 'dist'), intervalMs = 60000, initialState, autoCollect = true} = {}) {
  if (typeof lan !== 'boolean') throw new Error('LAN mode must be explicitly true or false.');
  if (!['127.0.0.1', '::1', ...(lan ? ['0.0.0.0'] : [])].includes(host)) throw new Error('Finance service must bind to loopback unless LAN mode is explicitly enabled.');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Choose a port from 0 to 65535.');
  if (!Number.isInteger(intervalMs) || intervalMs < 1000 || intervalMs > 86400000) throw new Error('Import interval must be between 1 second and 24 hours.');
  const auth = new LanAuth({enabled: lan, ...(lanAddresses ? {addresses: lanAddresses} : {}), now});
  const store = new Store({runtimeDir, initialState});
  const browserDownloads = new BrowserDownloads(store);
  const collect = async () => {
    try { await browserDownloads.scan(); }
    catch { browserDownloads.status = {...browserDownloads.status,lastCheck:new Date().toISOString(),errors:[{message:'Browser download collection is paused. Check its local folder configuration.'}]}; }
    return store.collect();
  };
  store.intervalMs = intervalMs; store.automationEnabled = autoCollect;
  const staticRoot = path.resolve(distDir);
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    try {
      const boundPort = server.address()?.port;
      const requestedHost = req.headers.host;
      const session = auth.inspect(req, boundPort);
      if (req.headers.origin && req.headers.origin !== `http://${requestedHost}`) throw new InputError('Cross-origin requests are not allowed.', 403);
      if (req.headers['sec-fetch-site'] === 'cross-site') throw new InputError('Cross-site requests are not allowed.', 403);
      const rawPath = (req.url || '/').split('?')[0];
      let pathname;
      try { pathname = decodeURIComponent(rawPath); } catch { throw new InputError('Invalid URL encoding.'); }
      if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(part => part === '..' || part === '.')) throw new InputError('Invalid file path.', 403);
      if (pathname.startsWith('/api/')) {
        if (pathname === '/api/session' && req.method === 'GET') return sendJson(res, 200, session);
        if (pathname === '/api/health' && req.method === 'GET') return sendJson(res, 200, {ok: true, installationId: process.env.FINANCE_INSTALLATION_ID || null, storage: 'sqlite', localOnly: !lan, ...session, ...(!session.requiresPairing ? {automation: store.getAutomationStatus()} : {})});
        if (pathname === '/api/pair' && req.method === 'POST') {
          const body = await jsonBody(req);
          const paired = auth.pair(req, res, body?.code);
          return sendJson(res, 200, {...session, ...paired, requiresPairing: false});
        }
        if (pathname === '/api/logout' && req.method === 'POST') {
          auth.logout(req, res);
          return sendJson(res, 200, {...session, paired: false, requiresPairing: !session.isLocal, sessionExpiresAt: null});
        }
        if (pathname.startsWith('/api/phone-access')) {
          auth.requireLocal(session);
          if (pathname === '/api/phone-access' && req.method === 'GET') return sendJson(res, 200, auth.status(boundPort));
          if (pathname === '/api/phone-access/pairing' && req.method === 'POST') return sendJson(res, 200, auth.createPairing());
          if (pathname === '/api/phone-access/revoke' && req.method === 'POST') { auth.revoke(); return sendJson(res, 200, auth.status(boundPort)); }
          return sendJson(res, 404, {error: 'API route or method not found.'});
        }
        auth.requireAuthorized(session);
        if (pathname === '/api/balance-activity' && req.method === 'GET') return sendJson(res, 200, readBalanceReceipts(store));
        if (pathname === '/api/state' && req.method === 'GET') return sendJson(res, 200, store.getState());
        if (pathname === '/api/state' && req.method === 'PUT') {
          const state = await jsonBody(req);
          if (!Number.isInteger(state?.revision)) throw new InputError('Include the current state revision when saving.', 409);
          validateState(state);
          store.db.exec('BEGIN IMMEDIATE');
          try { if(state.plan.forecastBasis?.ownerPurposeRules){const known=new Set(store.getState().transactions.map(r=>r.id));state.transactions=state.transactions.map(row=>known.has(row.id)?row:{...row,category:categoryForHistory(row)});} state.transactions = reconcileEmailHistory(store,state.transactions).transactions; const saved = store.setState(state); store.db.exec('COMMIT'); return sendJson(res,200,saved); }
          catch(error) { store.db.exec('ROLLBACK'); throw error; }
        }
        if (pathname === '/api/automation' && req.method === 'GET') return sendJson(res, 200, {...store.getAutomationStatus(), browserCollection:browserDownloads.status,email:{...readEmailStatus(store),alerts:readEmailAlerts(store,{limit:50}).filter(a=>a.status==='pending'||a.needsReview).map(a=>({date:a.date,merchant:a.merchant,amount:a.amount,status:a.status,needsReview:a.needsReview,matchMethod:a.matchMethod,dateBasis:a.dateBasis}))}});
        if (pathname === '/api/ai-access' && req.method === 'GET') return sendJson(res, 200, store.getAiAccess());
        if (pathname === '/api/ai-access' && req.method === 'POST') {
          auth.requireLocal(session);
          const body = await jsonBody(req);
          return sendJson(res, 200, store.setAiAccess(body?.enabled));
        }
        if (pathname === '/api/email-check/request') {
          auth.requireLocal(session);
          if (req.method === 'GET') return sendJson(res,200,{request:readEmailCheckRequest(store)});
          if (req.method === 'POST') return sendJson(res,202,{request:requestEmailCheck(store),message:'Request saved for your email checker. A request does not mean the mailbox has already been checked.'});
          return sendJson(res,405,{error:'Use GET or POST for email check requests.'});
        }
        if (pathname === '/api/collect' && req.method === 'POST') { auth.requireLocal(session); return sendJson(res, 200, {...await collect(), browserCollection:browserDownloads.status}); }
        if (pathname === '/api/forecast' && req.method === 'GET') return sendJson(res, 200, projectForecast(store.getState()));
        if (pathname === '/api/scenario' && req.method === 'POST') {const current=store.getState(),expense=await jsonBody(req);validateScenario(expense,current.plan);return sendJson(res,200,projectForecast(current,expense));}
        return sendJson(res, 404, {error: 'API route or method not found.'});
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw new InputError('Use GET to load app files.', 405);
      const target = path.resolve(staticRoot, `.${pathname === '/' ? '/index.html' : pathname}`);
      const relative = path.relative(staticRoot, target);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new InputError('Invalid file path.', 403);
      try {
        const realTarget = await realpath(target);
        const realRoot = await realpath(staticRoot);
        const realRelative = path.relative(realRoot, realTarget);
        if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) return sendJson(res, 403, {error: 'Invalid file path.'});
        const info = await stat(target); if (!info.isFile()) throw new Error('Not a file');
        const bytes = await readFile(target);
        res.writeHead(200, {'Content-Type': TYPES[path.extname(target)] || 'application/octet-stream', 'Content-Length': bytes.length});
        return res.end(req.method === 'HEAD' ? undefined : bytes);
      } catch { return sendJson(res, 404, {error: 'File not found.'}); }
    } catch (error) {
      if (!res.headersSent) return sendJson(res, error.status || 500, {error: error.status ? error.message : 'The local service could not complete this request.'});
      res.end();
    }
  });
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => { server.off('error', reject); resolve(); }); }); }
  catch (error) { store.close(); throw error; }
  // A user must grant access again after a successful service restart. Merely
  // importing Store or a failed competing launch must not change an active lease.
  store.setAiAccess(false);
  let timer;
  if (autoCollect) {
    const scan = () => collect().catch(error => console.error(`Import scan failed: ${error.message}`));
    await scan(); timer = setInterval(scan, intervalMs); timer.unref();
  }
  let closed = false;
  const url = `http://${host === '::1' ? '[::1]' : '127.0.0.1'}:${server.address().port}`;
  return {server, store, url, lanUrls: auth.status(server.address().port).urls, async close() {
    if (closed) return; closed = true; clearInterval(timer); auth.revoke();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (browserDownloads.running) await browserDownloads.running;
    if (store.collecting) await store.collecting;
    store.close();
  }};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const addresses = process.env.FINANCE_LAN_ADDRESSES;
  const service = await startServer({port: Number(process.env.FINANCE_PORT || 4317), lan: process.env.FINANCE_LAN === '1', ...(addresses !== undefined ? {lanAddresses: addresses.split(',').map(value => value.trim()).filter(Boolean)} : {}), runtimeDir: resolveRuntimeDir(), intervalMs: Number(process.env.FINANCE_IMPORT_INTERVAL_MS || 60000)});
  console.log(`Finance workspace: ${service.url}`);
  console.log(`SQLite storage and CSV inbox: ${service.store.runtimeDir}`);
  if (process.env.FINANCE_LAN === '1') {
    console.log(`Phone URLs (pair on your computer first): ${service.lanUrls.join(', ') || 'No private IPv4 address found; check Wi-Fi.'}`);
    console.log('Phone access uses unencrypted HTTP on your private network. Keep it on trusted Wi-Fi; do not forward this port to the internet.');
  }
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await service.close(); process.exit(0); });
}
