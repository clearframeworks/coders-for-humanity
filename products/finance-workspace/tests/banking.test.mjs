// These are adapter/SQLite tests using explicit fake provider responses.
// They are not evidence of a genuine bank connection or production permission.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {Store} from '../server/store.mjs';
import {BankingService} from '../server/banking.mjs';
import {PlaidVault, plaidConfiguration} from '../server/plaid-vault.mjs';
import {PlaidError} from '../server/plaid-client.mjs';
import {startServer} from '../server/index.mjs';

const FAKE_ENV = {PLAID_CLIENT_ID: 'test-client-id', PLAID_SECRET: 'test-provider-secret', PLAID_ENV: 'production'};
const ACCESS = 'access-production-fake-provider-test-token';
const accounts = [
  {account_id: 'checking', name: 'Checking', mask: '1234', type: 'depository', subtype: 'checking', balances: {available: 900, current: 950, iso_currency_code: 'USD'}},
  {account_id: 'credit', name: 'Credit card', mask: '4321', type: 'credit', subtype: 'credit card', balances: {available: 5000, current: 200, iso_currency_code: 'USD'}},
];
const transaction = (id, overrides = {}) => ({transaction_id: id, account_id: 'checking', date: '2026-10-22', amount: 25, name: 'Cafe', merchant_name: 'Cafe', pending: false, pending_transaction_id: null, iso_currency_code: 'USD', personal_finance_category: {primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_RESTAURANTS'}, ...overrides});
const page = (overrides = {}) => ({added: [], modified: [], removed: [], next_cursor: 'cursor-initial', has_more: false, ...overrides});

function provider() {
  const queue = new Map(), calls = [];
  const enqueue = (endpoint, ...responses) => { if (!queue.has(endpoint)) queue.set(endpoint, []); queue.get(endpoint).push(...responses); };
  const fetchImpl = async (url, options) => {
    assert.ok(url.startsWith('https://production.plaid.com/'));
    const endpoint = new URL(url).pathname, payload = JSON.parse(options.body); calls.push({endpoint, payload});
    assert.equal(payload.client_id, FAKE_ENV.PLAID_CLIENT_ID); assert.equal(payload.secret, FAKE_ENV.PLAID_SECRET);
    let response = queue.get(endpoint)?.shift();
    if (response === undefined) {
      if (endpoint === '/item/public_token/exchange') response = {access_token: ACCESS, item_id: 'provider-item'};
      else if (endpoint === '/item/get') response = {item: {item_id: 'provider-item', institution_id: 'ins-test', institution_name: 'Test institution'}};
      else if (endpoint === '/accounts/get') response = {accounts};
      else if (endpoint === '/transactions/sync') response = page();
      else if (endpoint === '/item/remove') response = {removed: true};
      else if (endpoint === '/link/token/create') response = {link_token: 'link-production-fake-test-token', expiration: '2026-10-23T10:00:00Z'};
      else throw new Error(`Unexpected mocked endpoint ${endpoint}`);
    }
    if (response instanceof Error) throw response;
    return {ok: !response.error_code, json: async () => response};
  };
  return {fetchImpl, enqueue, calls};
}

async function fixture(t, options = {}) {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'finance-bank-'));
  const store = new Store({runtimeDir}), mock = provider();
  const banking = new BankingService(store, {env: FAKE_ENV, fetchImpl: mock.fetchImpl, ...options});
  t.after(async () => { await banking.close(); store.close(); await rm(runtimeDir, {recursive: true, force: true}); });
  return {runtimeDir, store, banking, mock};
}
async function connect(banking) { return banking.exchange({publicToken: 'public-production-fake-test-token', institutionName: 'Untrusted client label'}); }
function rawRequest(service, route, {phone = false, method = 'GET', body} = {}) {
  const url = new URL(service.url), payload = body === undefined ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({hostname: '127.0.0.1', port: url.port, path: route, method, headers: {Host: `${phone ? '192.168.50.20' : '127.0.0.1'}:${url.port}`, ...(payload ? {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload)} : {})}}, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => { const value = Buffer.concat(chunks).toString('utf8'); let data; try { data = JSON.parse(value); } catch { data = value; } resolve({status: response.statusCode, headers: response.headers, data}); });
    }); req.on('error', reject); req.end(payload);
  });
}

test('no credentials yields honest unconfigured readiness and sends no provider requests', async t => {
  const {banking, mock, runtimeDir} = await fixture(t, {env: {}});
  const status = banking.status(); assert.equal(status.configured, false); assert.equal(status.items.length, 0);
  assert.deepEqual(status.missing, ['PLAID_CLIENT_ID', 'PLAID_SECRET']);
  await assert.rejects(banking.createLinkToken(), error => error.status === 503);
  assert.equal(mock.calls.length, 0); assert.equal(existsSync(path.join(runtimeDir, 'plaid.key')), false);
});

test('encrypted configuration and item tokens never enter exported app state or status', async t => {
  const {banking, store, runtimeDir, mock} = await fixture(t);
  const vault = new PlaidVault(runtimeDir); vault.saveConfig({clientId: FAKE_ENV.PLAID_CLIENT_ID, secret: FAKE_ENV.PLAID_SECRET, environment: 'production'});
  const encryptedConfig = await readFile(vault.configPath, 'utf8'); assert.equal(encryptedConfig.includes(FAKE_ENV.PLAID_SECRET), false);
  assert.equal(plaidConfiguration(vault, {}).configured, true);
  assert.equal(plaidConfiguration(vault, {PLAID_CLIENT_ID: 'test', PLAID_SECRET: 'test', PLAID_ENV: 'sandbox'}).configured, false);
  const state = store.getState(); state.plan.balance = 1100; state.plan.accounts[0].balance = 1100; store.setState(state);
  const linked = await connect(banking); assert.equal(linked.item.institutionName, 'Test institution'); assert.equal(linked.item.status, 'connected');
  const record = banking.item(linked.item.id); assert.equal(record.token.includes(ACCESS), false); assert.equal(vault.decrypt(record.token, `finance-plaid-item:${record.id}`), ACCESS);
  assert.equal(store.getState().plan.balance, 1100); assert.equal(store.getState().plan.accounts.length, 1);
  assert.equal(linked.item.accounts.find(account => account.type === 'credit').available, 5000);
  const exposed = JSON.stringify({state: store.getState(), status: banking.status()});
  for (const secret of [ACCESS, FAKE_ENV.PLAID_SECRET, FAKE_ENV.PLAID_CLIENT_ID]) assert.equal(exposed.includes(secret), false);
  const dbBytes = await readFile(path.join(runtimeDir, 'finance.sqlite')); assert.equal(dbBytes.includes(Buffer.from(ACCESS)), false);
  assert.equal(mock.calls.find(call => call.endpoint === '/item/public_token/exchange').payload.public_token, 'public-production-fake-test-token');
});

test('sync reconciles pending to posted, modifications, category overrides, removals and merchant refunds', async t => {
  const {banking, store, mock} = await fixture(t);
  mock.enqueue('/transactions/sync', page({added: [transaction('pending', {pending: true}), transaction('posted')]}));
  const linked = await connect(banking), id = linked.item.id;
  assert.equal(store.getState().transactions.length, 1); assert.equal(linked.item.pendingCount, 1);
  const edited = store.getState(); edited.transactions[0].category = 'Health'; store.setState(edited);
  mock.enqueue('/transactions/sync', page({next_cursor: 'cursor-next', added: [transaction('settled', {amount: 29, pending_transaction_id: 'pending'}), transaction('refund', {amount: -10})], modified: [transaction('posted', {amount: 30, personal_finance_category: {primary: 'GENERAL_MERCHANDISE'}})], removed: [{transaction_id: 'pending'}]}));
  const updated = await banking.sync(id);
  assert.equal(updated.added, 2); assert.equal(updated.modified, 1); assert.equal(updated.item.pendingCount, 0);
  const rows = store.getState().transactions;
  assert.equal(rows.find(row => row.bankTransactionId === 'posted').category, 'Health');
  assert.equal(rows.find(row => row.bankTransactionId === 'posted').amount, -30);
  assert.equal(rows.find(row => row.bankTransactionId === 'refund').category, 'Refund');
  assert.equal(rows.find(row => row.bankTransactionId === 'refund').amount, 10);
  assert.equal(rows.some(row => row.pending), false);
  assert.equal(rows.some(row => row.bankTransactionId === 'pending'), false);
  mock.enqueue('/transactions/sync', page({next_cursor: 'cursor-remove', removed: [{transaction_id: 'posted'}]}));
  const removed = await banking.sync(id); assert.equal(removed.removed, 1); assert.equal(store.getState().transactions.length, 2);
  const revision = store.getState().revision;
  mock.enqueue('/transactions/sync', page({next_cursor: 'cursor-remove'})); await banking.sync(id);
  assert.equal(store.getState().revision, revision); assert.equal(new Set(store.getState().transactions.map(row => row.id)).size, 2);
});

test('failed later page preserves complete history and original cursor; mutation retries from that original cursor', async t => {
  const {banking, store, mock} = await fixture(t); const id = (await connect(banking)).item.id;
  const saved = JSON.stringify(store.getState());
  mock.enqueue('/transactions/sync', page({added: [transaction('do-not-save')], next_cursor: 'partial', has_more: true}), {error_code: 'INSTITUTION_DOWN'});
  await assert.rejects(banking.sync(id)); assert.equal(JSON.stringify(store.getState()), saved); assert.equal(banking.item(id).cursor, 'cursor-initial');
  mock.enqueue('/transactions/sync', page({added: [transaction('discard-on-retry')], next_cursor: 'retry-partial', has_more: true}), {error_code: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION'}, page({added: [transaction('save-after-retry')], next_cursor: 'cursor-complete'}));
  await banking.sync(id);
  assert.deepEqual(mock.calls.filter(call => call.endpoint === '/transactions/sync').slice(-3).map(call => call.payload.cursor), ['cursor-initial', 'retry-partial', 'cursor-initial']);
  assert.deepEqual(store.getState().transactions.map(row => row.bankTransactionId), ['save-after-retry']);
});

test('currency filtering is explicit, cursor commit is atomic with validated app state', async t => {
  const {banking, store, mock} = await fixture(t); const id = (await connect(banking)).item.id;
  mock.enqueue('/transactions/sync', page({added: [transaction('eur', {iso_currency_code: 'EUR'})], next_cursor: 'cursor-eur'}));
  const result = await banking.sync(id); assert.equal(result.excludedCurrency, 1); assert.match(result.item.lastError, /non-USD/); assert.equal(store.getState().transactions.length, 0);
  const previous = store.setState.bind(store); store.setState = () => { throw new Error('mock local persistence failure'); };
  mock.enqueue('/transactions/sync', page({added: [transaction('rollback')], next_cursor: 'must-not-save'}));
  await assert.rejects(banking.sync(id)); store.setState = previous;
  assert.equal(banking.item(id).cursor, 'cursor-eur'); assert.equal(store.getState().transactions.length, 0);
  assert.equal(banking.db.prepare('SELECT COUNT(*) AS count FROM bank_transactions WHERE transaction_id = ?').get('rollback').count, 0);
});

test('login recovery uses update mode and preserves item, cursor and manually edited category', async t => {
  const {banking, store, mock} = await fixture(t);
  mock.enqueue('/transactions/sync', page({added: [transaction('original')]})); const id = (await connect(banking)).item.id;
  const edited = store.getState(); edited.transactions[0].category = 'Shopping'; store.setState(edited);
  mock.enqueue('/transactions/sync', {error_code: 'ITEM_LOGIN_REQUIRED'}); await assert.rejects(banking.sync(id));
  assert.equal(banking.status().items[0].requiresReauth, true);
  const link = await banking.createLinkToken({itemId: id}); assert.equal(link.updateMode, true); assert.equal(link.itemId, id);
  const request = mock.calls.filter(call => call.endpoint === '/link/token/create').at(-1).payload;
  assert.equal(request.access_token, ACCESS); assert.equal('products' in request, false);
  mock.enqueue('/transactions/sync', page({modified: [transaction('original', {amount: 28})], next_cursor: 'recovered'}));
  const synced = await banking.sync(id); assert.equal(synced.item.id, id); assert.equal(synced.item.requiresReauth, false);
  assert.equal(store.getState().transactions[0].category, 'Shopping'); assert.equal(banking.item(id).cursor, 'recovered');
  assert.equal(mock.calls.filter(call => call.endpoint === '/item/public_token/exchange').length, 1);
});

test('duplicate institution grant is removed instead of creating another history namespace', async t => {
  const {banking, mock} = await fixture(t); const first = (await connect(banking)).item.id;
  mock.enqueue('/item/public_token/exchange', {access_token: 'access-production-second-test', item_id: 'provider-item-second'});
  mock.enqueue('/item/get', {item: {item_id: 'provider-item-second', institution_id: 'ins-test', institution_name: 'Test institution'}});
  await assert.rejects(connect(banking), error => error.status === 409 && /already has a saved connection/.test(error.message));
  assert.equal(banking.status().items.length, 1); assert.equal(banking.status().items[0].id, first);
  assert.equal(mock.calls.filter(call => call.endpoint === '/item/remove').at(-1).payload.access_token, 'access-production-second-test');
});

test('post-exchange local failure compensates remote grant; failed compensation is reported explicitly', async t => {
  const {banking, mock} = await fixture(t);
  banking.vault.encrypt = () => { throw new Error(`failure mentioning ${ACCESS} and ${FAKE_ENV.PLAID_SECRET}`); };
  await assert.rejects(connect(banking), error => /authorization was removed/.test(error.message) && !error.message.includes(ACCESS) && !error.message.includes(FAKE_ENV.PLAID_SECRET));
  assert.equal(banking.status().items.length, 0);
  mock.enqueue('/item/remove', {error_code: 'INSTITUTION_DOWN'});
  await assert.rejects(connect(banking), error => /authorization may still be active/.test(error.message) && /Revoke this app/.test(error.message));
  assert.equal(banking.status().items.length, 0);
});

test('disconnect only succeeds after provider revoke, deletes token, and preserves posted history', async t => {
  const {banking, store, mock} = await fixture(t);
  mock.enqueue('/transactions/sync', page({added: [transaction('keep-history')]})); const id = (await connect(banking)).item.id;
  mock.enqueue('/item/remove', {error_code: 'INSTITUTION_DOWN'}); await assert.rejects(banking.disconnect(id));
  assert.equal(banking.status().items.length, 1); assert.ok(banking.item(id).token);
  const result = await banking.disconnect(id); assert.equal(result.disconnected, true); assert.equal(result.historyPreserved, true);
  assert.equal(banking.status().items.length, 0); assert.equal(store.getState().transactions.length, 1);
  assert.equal(banking.db.prepare('SELECT COUNT(*) AS count FROM bank_transactions').get().count, 0);
});

test('example plans block live linking/sync and provider failures do not leak raw response details', async t => {
  const {banking, store, mock} = await fixture(t);
  const sample = store.getState(); sample.mode = 'example'; store.setState(sample);
  await assert.rejects(banking.createLinkToken(), error => error.status === 409);
  await assert.rejects(connect(banking), error => error.status === 409);
  assert.equal(mock.calls.length, 0);
  const personal = store.getState(); personal.mode = 'personal'; store.setState(personal);
  mock.enqueue('/link/token/create', {error_code: 'INVALID_API_KEYS', error_message: `Never expose ${FAKE_ENV.PLAID_SECRET}`});
  await assert.rejects(banking.createLinkToken(), error => error instanceof PlaidError && !error.message.includes(FAKE_ENV.PLAID_SECRET));
});

test('banking HTTP routes are desktop-only and CSP permits Plaid only when desktop configuration exists', async t => {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'finance-bank-api-')); const mock = provider();
  const service = await startServer({port: 0, lan: true, lanAddresses: ['192.168.50.20'], runtimeDir, autoCollect: false, autoBankSync: false, bankOptions: {env: FAKE_ENV, fetchImpl: mock.fetchImpl}});
  t.after(async () => { await service.close(); await rm(runtimeDir, {recursive: true, force: true}); });
  assert.equal((await rawRequest(service, '/api/banking/status')).data.configured, true);
  assert.equal((await rawRequest(service, '/api/banking/status', {phone: true})).status, 403);
  assert.equal((await rawRequest(service, '/api/banking/link-token', {method: 'POST', body: {}})).status, 200);
  const local = await rawRequest(service, '/'); assert.match(local.headers['content-security-policy'], /https:\/\/cdn\.plaid\.com\/link\/v2\/stable\/link-initialize\.js/); assert.match(local.data, /plaid-csp-nonce/);
  const phone = await rawRequest(service, '/', {phone: true}); assert.equal(phone.headers['content-security-policy'].includes('plaid.com'), false); assert.equal(phone.data.includes('plaid-csp-nonce'), false);
  assert.equal(JSON.stringify((await rawRequest(service, '/api/banking/status')).data).includes(FAKE_ENV.PLAID_SECRET), false);
});
