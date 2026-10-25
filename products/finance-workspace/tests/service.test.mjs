import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, mkdir, writeFile, readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {Store, defaultState} from '../server/store.mjs';
import {startServer} from '../server/index.mjs';

const cleanups = new WeakMap();
async function temporary(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'finance-service-'));
  const callbacks = []; cleanups.set(t, callbacks);
  t.after(async () => { for (const close of callbacks.reverse()) await close(); await rm(dir, {recursive: true, force: true}); });
  return dir;
}
const request = async (url, method = 'GET', body, headers = {}) => fetch(url, {method, headers: {...(body !== undefined ? {'Content-Type': 'application/json'} : {}), ...headers}, ...(body !== undefined ? {body: JSON.stringify(body)} : {})});
const rawStatus = (origin, pathname, headers = {}) => new Promise((resolve, reject) => {
  const url = new URL(origin);
  const req = http.request({hostname: url.hostname, port: url.port, path: pathname, headers}, response => { response.resume(); resolve(response.statusCode); });
  req.on('error', reject); req.end();
});

test('SQLite state persists across restart and stale revisions cannot overwrite it', async t => {
  const runtimeDir = await temporary(t);
  let store = new Store({runtimeDir});
  const stale = store.getState();
  const state = store.getState(); state.plan.balance = 1200; state.plan.accounts[0].balance = 1200;
  const saved = store.setState(state);
  assert.equal(saved.revision, 2);
  assert.throws(() => store.setState(stale), /changed since/);
  store.close(); store = new Store({runtimeDir});
  assert.equal(store.getState().plan.balance, 1200); assert.equal(store.getState().revision, 2);
  store.close();
});

test('state validation rejects broken financial inputs without altering saved state', async t => {
  const store = new Store({runtimeDir: await temporary(t)}); cleanups.get(t).push(() => store.close());
  const state = store.getState();
  for (const bad of [
    {...state, plan: {...state.plan, balance: 50}},
    {...state, plan: {...state.plan, dailySpend: -1}},
    {...state, plan: {...state.plan, horizon: 999}},
    {...state, transactions: [{id: 'x', key: 'x', date: '2026-02-30', description: 'Invalid', category: 'Other', amount: -10}]},
  ]) assert.throws(() => store.setState(bad));
  assert.deepEqual(store.getState(), state);
});

test('inbox imports valid CSV, isolates invalid originals, deduplicates and leaves plan unchanged', async t => {
  const runtimeDir = await temporary(t); const store = new Store({runtimeDir}); cleanups.get(t).push(() => store.close());
  const originalPlan = store.getState().plan;
  const csv = 'date,description,amount\n2026-10-20,Groceries,-45.50\n2026-10-21,Paycheck,800.00';
  await writeFile(path.join(store.inboxPath, 'good.csv'), csv);
  await writeFile(path.join(store.inboxPath, 'bad.csv'), 'date,description,amount\n2026-02-30,Invalid,-5');
  const first = await store.collect();
  assert.equal(first.added, 2); assert.equal(first.processed, 1); assert.equal(first.errors.length, 1);
  assert.deepEqual(store.getState().plan, originalPlan);
  assert.equal(store.getState().transactions.length, 2);
  const archived = await readdir(store.archivePath); assert.equal(archived.length, 1);
  const errors = await readdir(store.errorPath); assert.equal(errors.length, 2);
  const originalErrorFile = errors.find(name => name.endsWith('.csv'));
  assert.match(await readFile(path.join(store.errorPath, originalErrorFile), 'utf8'), /2026-02-30/);
  await writeFile(path.join(store.inboxPath, 'same.csv'), csv + '\n');
  const second = await store.collect(); assert.equal(second.added, 0); assert.equal(second.duplicates, 2);
  assert.equal(store.getState().transactions.length, 2);
  assert.equal((await readdir(store.inboxPath)).length, 0);
  await writeFile(path.join(store.inboxPath, 'exact.csv'), csv);
  const exact = await store.collect(); assert.equal(exact.added, 0); assert.equal(exact.duplicates, 2);
});

test('API saves persist, validates input, and scenario calculations do not change baseline', async t => {
  const service = await startServer({port: 0, runtimeDir: await temporary(t), autoCollect: false}); cleanups.get(t).push(() => service.close());
  const health = await (await request(`${service.url}/api/health`)).json(); assert.equal(health.storage, 'sqlite'); assert.equal(health.localOnly, true);
  const state = await (await request(`${service.url}/api/state`)).json();
  state.plan.balance = 1000; state.plan.accounts[0].balance = 1000; state.plan.cushion = 100;
  const save = await request(`${service.url}/api/state`, 'PUT', state); assert.equal(save.status, 200);
  assert.equal((await (await request(`${service.url}/api/state`)).json()).plan.balance, 1000);
  const scenario = await request(`${service.url}/api/scenario`, 'POST', {amount: 125, date: state.plan.startDate, name: 'Repair'});
  assert.equal(scenario.status, 200); assert.equal((await scenario.json()).spendingRoom, 775);
  const baseline = await (await request(`${service.url}/api/forecast`)).json(); assert.equal(baseline.spendingRoom, 900);
  assert.equal((await request(`${service.url}/api/state`, 'PUT', state)).status, 409);
  const current = await (await request(`${service.url}/api/state`)).json(); current.plan.horizon = -1;
  assert.equal((await request(`${service.url}/api/state`, 'PUT', current)).status, 400);
  assert.equal((await request(`${service.url}/api/collect`, 'POST')).status, 200);
  assert.equal((await request(`${service.url}/api/automation`)).status, 200);
});

test('service rejects foreign origins, DNS-rebinding hosts, traversal, and oversized bodies', async t => {
  const service = await startServer({port: 0, runtimeDir: await temporary(t), autoCollect: false}); cleanups.get(t).push(() => service.close());
  assert.equal((await request(`${service.url}/api/state`, 'GET', undefined, {Origin: 'https://evil.example'})).status, 403);
  assert.equal(await rawStatus(service.url, '/api/state', {Host: 'evil.example'}), 403);
  assert.equal((await request(`${service.url}/api/state`, 'GET', undefined, {'Sec-Fetch-Site': 'cross-site'})).status, 403);
  const traversalStatus = await rawStatus(service.url, '/%2e%2e/server/store.mjs');
  assert.equal(traversalStatus, 403);
  const large = await fetch(`${service.url}/api/state`, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({junk: 'x'.repeat(2 * 1024 * 1024)})}); assert.equal(large.status, 413);
});

test('static app files are served and automatic inbox collection runs without browser requests', async t => {
  const fixture = await temporary(t), distDir = path.join(fixture, 'dist'), runtimeDir = path.join(fixture, 'runtime');
  await mkdir(distDir); await writeFile(path.join(distDir, 'index.html'), '<!doctype html><title>Local finance</title>');
  await writeFile(path.join(distDir, 'app.mjs'), 'export const ready = true;');
  const service = await startServer({port: 0, runtimeDir, distDir, intervalMs: 1000}); cleanups.get(t).push(() => service.close());
  const page = await request(`${service.url}/`); assert.equal(page.status, 200); assert.match(await page.text(), /Local finance/);
  assert.match((await request(`${service.url}/app.mjs`)).headers.get('content-type'), /javascript/);
  assert.equal((await request(`${service.url}/unknown`)).status, 404);
  assert.equal((await request(`${service.url}/api/unknown`)).status, 404);
  await writeFile(path.join(service.store.inboxPath, 'automatic.csv'), 'date,description,amount\n2026-10-22,Auto import,-4.50');
  await new Promise(resolve => setTimeout(resolve, 1250));
  assert.equal(service.store.getState().transactions.length, 1);
  const status = service.store.getAutomationStatus(); assert.equal(status.enabled, true); assert.equal(status.added, 1); assert.ok(status.lastSuccess);
});

test('automatic collection does not mix real imports into an example plan', async t => {
  const store = new Store({runtimeDir: await temporary(t)}); cleanups.get(t).push(() => store.close());
  const example = store.getState(); example.mode = 'example'; store.setState(example);
  await writeFile(path.join(store.inboxPath, 'real.csv'), 'date,description,amount\n2026-10-22,Personal record,-10');
  const paused = await store.collect();
  assert.equal(paused.added, 0); assert.match(paused.lastError, /example plan/);
  assert.equal((await readdir(store.inboxPath)).length, 1); assert.equal(store.getState().transactions.length, 0);
  const personal = store.getState(); personal.mode = 'personal'; store.setState(personal);
  assert.equal((await store.collect()).added, 1);
});

test('AI access is locked by default, grants a 15-minute lease, expires, revokes and locks on restart', async t => {
  const runtimeDir = await temporary(t);
  let service = await startServer({port: 0, runtimeDir, autoCollect: false});
  cleanups.get(t).push(() => service.close());
  assert.deepEqual(await (await request(`${service.url}/api/ai-access`)).json(), {enabled: false, expiresAt: null});
  const grant = await (await request(`${service.url}/api/ai-access`, 'POST', {enabled: true})).json();
  assert.equal(grant.enabled, true); assert.ok(Date.parse(grant.expiresAt) > Date.now() + 14 * 60 * 1000);
  await assert.rejects(startServer({port: service.server.address().port, runtimeDir, autoCollect: false}), /EADDRINUSE/);
  assert.equal(service.store.getAiAccess().enabled, true);
  service.store.db.prepare('UPDATE metadata SET value = ? WHERE key = ?').run(new Date(Date.now() - 1000).toISOString(), 'ai_access_expires_at');
  assert.equal((await (await request(`${service.url}/api/ai-access`)).json()).enabled, false);
  assert.equal((await request(`${service.url}/api/ai-access`, 'POST', {enabled: 'yes'})).status, 400);
  assert.equal((await (await request(`${service.url}/api/ai-access`, 'POST', {enabled: false})).json()).expiresAt, null);
  await request(`${service.url}/api/ai-access`, 'POST', {enabled: true});
  await service.close();
  service = await startServer({port: 0, runtimeDir, autoCollect: false});
  assert.deepEqual(await (await request(`${service.url}/api/ai-access`)).json(), {enabled: false, expiresAt: null});
  await writeFile(path.join(service.store.inboxPath, 'without-ai.csv'), 'date,description,amount\n2026-10-22,Collection works without AI,-3');
  assert.equal((await service.store.collect()).added, 1);
});
