import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {parseTransactions, parseCashAppReport, mergeTransactions} from '../dist/engine.mjs';
import {Store} from '../server/store.mjs';

const headers = 'Date,Transaction ID,Transaction Type,Currency,Amount,Fee,Net Amount,Asset Type,Asset Price,Asset Amount,Status,Notes,Name of sender/receiver,Account';
const row = overrides => ({Date: '2026-10-22 23:30:00 EDT', 'Transaction ID': 'synthetic-1', 'Transaction Type': 'Cash Card', Currency: 'USD', Amount: '-$10.00', Fee: '', 'Net Amount': '-$10.00', 'Asset Type': '', 'Asset Price': '', 'Asset Amount': '', Status: 'COMPLETE', Notes: 'Coffee', 'Name of sender/receiver': 'Example shop', Account: 'Cash', ...overrides});
const csv = (...rows) => [headers, ...rows.map(value => headers.split(',').map(key => `"${String(value[key]).replaceAll('"', '""')}"`).join(','))].join('\n');

test('native headers, reported local date and stable IDs preserve equal purchases', () => {
  const rows = parseTransactions(csv(row(), row({'Transaction ID': 'synthetic-2'})));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].date, '2026-10-22');
  assert.notEqual(rows[0].key, rows[1].key);
  assert.deepEqual(mergeTransactions(rows, rows), {transactions: rows, added: 0, updated: 0, duplicates: 2, removed: 0});
});

test('pending, failed and zero notifications never enter spending; completed can arrive later', () => {
  const pending = parseCashAppReport(csv(row({Status: 'WAITING_ON_RECIPIENT'}), row({Status: 'FAILED'}), row({'Transaction Type': 'Account Notifications', Amount: '$0.00', 'Net Amount': '$0.00'})));
  assert.deepEqual(pending, []);
  assert.deepEqual(pending.importSummary, {rows: 3, completed: 1, pending: 1, failed: 1, notifications: 1});
  assert.equal(mergeTransactions(pending, parseTransactions(csv(row()))).added, 1);
});

test('an explicit corrected completed row removes its obsolete fee only', () => {
  const oldRows = parseTransactions(csv(row({Fee: '-$1.00', 'Net Amount': '-$11.00'}), row({'Transaction ID': 'other', Fee: '-$2.00', 'Net Amount': '-$12.00'})));
  const corrected = parseTransactions(csv(row()));
  const merged = mergeTransactions(oldRows, corrected);
  assert.equal(merged.removed, 1);
  assert.equal(merged.transactions.length, 3);
  assert.ok(merged.transactions.some(r => r.key === 'cashapp:other:fee'));
  assert.ok(!merged.transactions.some(r => r.key === 'cashapp:synthetic-1:fee'));
});

test('transfer principal and separate fees reconcile to net; refunds and P2P are explicit', () => {
  const rows = parseTransactions(csv(row({'Transaction Type': 'Withdrawal', Fee: '-$1.25', 'Net Amount': '-$11.25'}), row({'Transaction ID': 'refund', Amount: '$5.00', 'Net Amount': '$5.00'}), row({'Transaction ID': 'peer', 'Transaction Type': 'P2P', Amount: '$20.00', 'Net Amount': '$20.00'})));
  assert.deepEqual(rows.map(r => r.category), ['Transfers', 'Fees', 'Refunds', 'Income']);
  assert.equal(rows[0].amount + rows[1].amount, -11.25);
  assert.equal(rows[3].needsReview, true);
});

test('missing ID and unknown type retain real rows with review and occurrence identities', () => {
  const rows = parseTransactions(csv(row({'Transaction ID': '', 'Transaction Type': ''}), row({'Transaction ID': '', 'Transaction Type': ''})));
  assert.equal(rows.length, 2);
  assert.ok(rows.every(r => r.needsReview && r.category === 'Other'));
  assert.notEqual(rows[0].key, rows[1].key);
});

test('invalid currency, assets, dates, status and money reject the entire report', () => {
  for (const override of [{Currency: 'EUR'}, {'Asset Type': 'BTC'}, {Date: '2026-02-30 10:00:00 EST'}, {Status: 'UNKNOWN'}, {Amount: '$1,2.00'}, {'Net Amount': '-$9.00'}]) assert.throws(() => parseTransactions(csv(row(), row({'Transaction ID': 'bad', ...override}))));
  assert.throws(() => parseTransactions(csv(row(), row())), /duplicate Cash App/);
});

test('provider corrections refresh amounts while preserving manual categories and generic imports', () => {
  const initial = parseTransactions(csv(row()));
  const modified = parseTransactions(csv(row({Amount: '-$12.00', 'Net Amount': '-$12.00'})));
  const merged = mergeTransactions([{...initial[0], category: 'Dining'}], modified);
  assert.equal(merged.updated, 1);
  assert.equal(merged.transactions[0].amount, -12);
  assert.equal(merged.transactions[0].category, 'Dining');
  const generic = parseTransactions('date,description,amount\n2026-10-22,Coffee,-10');
  assert.equal(mergeTransactions(generic, generic).duplicates, 1);
  assert.equal(mergeTransactions(generic, modified).transactions.length, 2);
});

test('inbox atomically imports, repeats, updates and isolates invalid native reports', async () => {
  const runtimeDir = await mkdtemp(path.join(process.cwd(), '.cashapp-test-'));
  const store = new Store({runtimeDir});
  try {
    const originalPlan = store.getState().plan;
    await writeFile(path.join(store.inboxPath, 'first.csv'), csv(row()));
    assert.equal((await store.collect()).added, 1);
    await writeFile(path.join(store.inboxPath, 'again.csv'), csv(row()));
    assert.equal((await store.collect()).duplicates, 1);
    await writeFile(path.join(store.inboxPath, 'update.csv'), csv(row({Amount: '-$12.00', 'Net Amount': '-$12.00'})));
    assert.equal((await store.collect()).updated, 1);
    const before = store.getState();
    assert.deepEqual(before.plan, originalPlan);
    await writeFile(path.join(store.inboxPath, 'invalid.csv'), csv(row({'Transaction ID': 'new'}), row({'Transaction ID': 'bad', Currency: 'EUR'})));
    assert.equal((await store.collect()).errors.length, 1);
    assert.deepEqual(store.getState(), before);
  } finally { store.close(); await rm(runtimeDir, {recursive: true, force: true}); }
});
