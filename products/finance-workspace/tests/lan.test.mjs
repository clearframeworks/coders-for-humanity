import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {startServer} from '../server/index.mjs';
import {LanAuth, isPrivateIpv4, isLoopbackPeer} from '../server/lan-auth.mjs';

const ADDRESS = '192.168.50.20';
async function fixture(t, options = {}) {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'finance-lan-'));
  let service = await startServer({port: 0, lan: true, lanAddresses: [ADDRESS], runtimeDir, autoCollect: false, ...options});
  t.after(async () => { await service.close(); await rm(runtimeDir, {recursive: true, force: true}); });
  return {get service() { return service; }, async restart() { await service.close(); service = await startServer({port: 0, lan: true, lanAddresses: [ADDRESS], runtimeDir, autoCollect: false, ...options}); return service; }};
}
function request(service, route, {phone = false, cookie, method = 'GET', body, headers = {}} = {}) {
  const url = new URL(service.url), port = Number(url.port);
  const encoded = body === undefined ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({hostname: '127.0.0.1', port, path: route, method, headers: {Host: phone ? `${ADDRESS}:${port}` : `127.0.0.1:${port}`, ...(cookie ? {Cookie: cookie} : {}), ...(encoded ? {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(encoded)} : {}), ...headers}}, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8'); let data; try { data = JSON.parse(text); } catch { data = text; }
        resolve({status: res.statusCode, headers: res.headers, data});
      });
    });
    req.on('error', reject); req.end(encoded);
  });
}
async function pair(service) {
  const generated = await request(service, '/api/phone-access/pairing', {method: 'POST'}); assert.equal(generated.status, 200);
  const response = await request(service, '/api/pair', {phone: true, method: 'POST', body: {code: generated.data.code}}); assert.equal(response.status, 200);
  return {code: generated.data.code, cookie: response.headers['set-cookie'][0].split(';')[0], response};
}

test('unpaired phone sees a shell and safe health but no financial or machine-path data', async t => {
  const {service} = await fixture(t);
  assert.equal((await request(service, '/', {phone: true})).status, 200);
  const health = await request(service, '/api/health', {phone: true});
  assert.equal(health.status, 200); assert.equal(health.data.requiresPairing, true); assert.equal(health.data.isLocal, false);
  assert.equal('automation' in health.data, false); assert.equal(JSON.stringify(health.data).includes('finance.sqlite'), false);
  const session = await request(service, '/api/session', {phone: true}); assert.equal(session.data.paired, false);
  for (const route of ['/api/state', '/api/forecast', '/api/automation', '/api/ai-access']) assert.equal((await request(service, route, {phone: true})).status, 401);
  assert.equal((await request(service, '/api/phone-access', {phone: true})).status, 403);
  const local = await request(service, '/api/phone-access'); assert.equal(local.status, 200); assert.deepEqual(local.data.urls, [service.lanUrls[0]]);
});

test('one-use pairing grants a phone shared-state edits and scenarios, with desktop-only management', async t => {
  const {service} = await fixture(t);
  const {cookie, response, code} = await pair(service);
  assert.match(response.headers['set-cookie'][0], /HttpOnly/); assert.match(response.headers['set-cookie'][0], /SameSite=Strict/); assert.match(response.headers['set-cookie'][0], /Max-Age=43200/);
  const session = await request(service, '/api/session', {phone: true, cookie}); assert.equal(session.data.paired, true); assert.equal(session.data.requiresPairing, false);
  assert.equal((await request(service, '/api/pair', {phone: true, method: 'POST', body: {code}})).status, 410);
  const state = (await request(service, '/api/state', {phone: true, cookie})).data;
  state.plan.balance = 1234.5; state.plan.accounts[0].balance = 1234.5;
  assert.equal((await request(service, '/api/state', {phone: true, cookie, method: 'PUT', body: state})).status, 200);
  assert.equal((await request(service, '/api/state')).data.plan.balance, 1234.5);
  const scenario = await request(service, '/api/scenario', {phone: true, cookie, method: 'POST', body: {amount: 100, date: state.plan.startDate}});
  assert.equal(scenario.status, 200); assert.equal(scenario.data.spendingRoom, 1134.5);
  assert.equal((await request(service, '/api/forecast', {phone: true, cookie})).data.spendingRoom, 1234.5);
  for (const route of ['/api/phone-access/pairing', '/api/phone-access/revoke', '/api/collect', '/api/ai-access']) assert.equal((await request(service, route, {phone: true, cookie, method: 'POST', body: {enabled: true}})).status, 403);
  assert.equal((await request(service, '/api/ai-access')).data.enabled, false);
  assert.equal((await request(service, '/api/phone-access')).data.sessions, 1);
});

test('pairing expires and five wrong attempts globally lock it until desktop regeneration', async t => {
  let clock = Date.now();
  const {service} = await fixture(t, {now: () => clock});
  const generated = await request(service, '/api/phone-access/pairing', {method: 'POST'});
  clock += 5 * 60 * 1000;
  assert.equal((await request(service, '/api/pair', {phone: true, method: 'POST', body: {code: generated.data.code}})).status, 410);
  const fresh = await request(service, '/api/phone-access/pairing', {method: 'POST'});
  const wrong = fresh.data.code === '11111111' ? '22222222' : '11111111';
  for (let i = 0; i < 4; i++) assert.equal((await request(service, '/api/pair', {phone: true, method: 'POST', body: {code: wrong}})).status, 401);
  assert.equal((await request(service, '/api/pair', {phone: true, method: 'POST', body: {code: wrong}})).status, 429);
  assert.equal((await request(service, '/api/pair', {phone: true, method: 'POST', body: {code: fresh.data.code}})).status, 429);
  assert.equal((await request(service, '/api/phone-access')).data.pairing.attemptsRemaining, 0);
  assert.ok((await pair(service)).cookie);
});

test('logout, desktop revocation, session expiry and restart all remove phone access', async t => {
  let clock = Date.now(); const context = await fixture(t, {now: () => clock});
  let paired = await pair(context.service);
  const logout = await request(context.service, '/api/logout', {phone: true, cookie: paired.cookie, method: 'POST'});
  assert.equal(logout.data.requiresPairing, true); assert.match(logout.headers['set-cookie'][0], /Max-Age=0/);
  assert.equal((await request(context.service, '/api/state', {phone: true, cookie: paired.cookie})).status, 401);
  paired = await pair(context.service); await request(context.service, '/api/phone-access/revoke', {method: 'POST'});
  assert.equal((await request(context.service, '/api/state', {phone: true, cookie: paired.cookie})).status, 401);
  paired = await pair(context.service); clock += 12 * 60 * 60 * 1000;
  assert.equal((await request(context.service, '/api/state', {phone: true, cookie: paired.cookie})).status, 401);
  paired = await pair(context.service); await context.restart();
  assert.equal((await request(context.service, '/api/state', {phone: true, cookie: paired.cookie})).status, 401);
});

test('LAN preserves Host/Origin checks and never trusts loopback Host or forwarded headers from a remote peer', async t => {
  const {service} = await fixture(t);
  assert.equal((await request(service, '/api/session', {phone: true, headers: {Origin: 'https://evil.example'}})).status, 403);
  assert.equal((await request(service, '/api/session', {phone: true, headers: {Host: 'evil.example'}})).status, 403);
  assert.equal((await request(service, '/api/session', {phone: true, headers: {'Sec-Fetch-Site': 'cross-site'}})).status, 403);
  const auth = new LanAuth({enabled: true, addresses: [ADDRESS]});
  const spoof = auth.inspect({socket: {remoteAddress: '192.168.50.99'}, headers: {host: '127.0.0.1:4317', 'x-forwarded-for': '127.0.0.1'}}, 4317);
  assert.equal(spoof.isLocal, false); assert.equal(spoof.requiresPairing, true); assert.throws(() => auth.requireLocal(spoof), /only on the computer/);
  assert.throws(() => auth.inspect({socket: {remoteAddress: '8.8.8.8'}, headers: {host: `${ADDRESS}:4317`}}, 4317), /private network/);
  assert.equal(isLoopbackPeer('::ffff:127.0.0.1'), true); assert.equal(isPrivateIpv4('172.31.10.5'), true); assert.equal(isPrivateIpv4('172.32.10.5'), false);
});

test('LAN remains opt-in and loopback mode cannot create pairing codes', async t => {
  const {service} = await fixture(t, {lan: false});
  assert.equal((await request(service, '/api/session')).data.lanEnabled, false);
  assert.equal((await request(service, '/api/phone-access/pairing', {method: 'POST'})).status, 409);
  assert.equal((await request(service, '/api/session', {phone: true})).status, 403);
  await assert.rejects(startServer({host: '0.0.0.0'}), /explicitly enabled/);
});
