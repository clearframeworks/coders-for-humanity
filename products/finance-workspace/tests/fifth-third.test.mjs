import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {parseTransactions, parseFifthThirdReport, mergeTransactions} from '../dist/engine.mjs';
import {Store} from '../server/store.mjs';

const header = 'Date,Description,"Check Number",Amount\r\n';
test('official schema parses local US dates, decimal signs, quoted multiline and escaped quotes', () => {
  const rows = parseTransactions('\uFEFF' + header + '10/22/2026,"Example, ""Shop""\nFood",,-10.25\r\n10/23/2026,Deposit,,+20.00');
  assert.equal(rows[0].date, '2026-10-22');
  assert.equal(rows[0].description, 'Example, "Shop"\nFood');
  assert.equal(rows[0].amount, -10.25);
  assert.equal(rows[1].amount, 20);
  assert.equal(rows[0].source, 'fifththird');
  assert.deepEqual(rows.importSummary, {provider:'Fifth Third', rows:2, completed:2, pending:null, failed:null, notifications:0});
});
test('fingerprints retain equal legitimate rows, distinguish checks and preserve edited categories', () => {
  const report = header + '10/22/2026,Example,, -10.00\n10/22/2026,Example,,-10.00\n10/22/2026,Example,123,-10.00';
  const rows = parseTransactions(report);
  assert.equal(new Set(rows.map(row => row.key)).size, 3);
  const existing = rows.map(row => ({...row, category:'Dining'}));
  const merged = mergeTransactions(existing, parseTransactions(report));
  assert.equal(merged.added, 0);
  assert.equal(merged.duplicates, 3);
  assert.ok(merged.transactions.every(row => row.category === 'Dining'));
});
test('explicit transfers and fees separate from ambiguous Cash App purchases', () => {
  const rows = parseTransactions(header + '10/22/2026,ACH CASH APP,,-20\n10/22/2026,TRANSFER TO SAVINGS,,-10\n10/22/2026,MONTHLY SERVICE FEE,,-5\n10/22/2026,CASH APP*EXAMPLE,,-3\n10/22/2026,Web Initiated Payment At Cash App,,-20\n10/22/2026,Deposit From Cash App,,20\n10/22/2026,Cash App Transfer Fee,,-1');
  assert.deepEqual(rows.map(row => row.category), ['Transfers','Transfers','Fees','Other','Transfers','Transfers','Fees']);
  assert.equal(rows[3].needsReview, true);
  assert.ok(rows.filter(row => row.category === 'Transfers').every(row => row.needsReview));
});
test('strict date, amount, schema and row checks reject entire reports', () => {
  for (const bad of ['02/30/2026,Example,,-1', '2/03/2026,Example,,-1', '10/22/2026,Example,,$1', '10/22/2026,Example,,1.001', '10/22/2026,Example,,1,extra']) assert.throws(() => parseTransactions(header + '10/22/2026,Valid,,-1\n' + bad));
  assert.throws(() => parseFifthThirdReport('Date,Description,Amount\n10/22/2026,Example,-1'));
});
test('inbox preserves existing history and plan, deduplicates and rolls back malformed reports', async () => {
  const runtimeDir = await mkdtemp(path.join(process.cwd(), '.fifththird-test-'));
  const store = new Store({runtimeDir});
  try {
    const state = store.getState();
    state.transactions = parseTransactions('date,description,amount\n2026-10-20,Existing,-1');
    store.setState(state);
    const original = store.getState();
    const report = header + '10/22/2026,Example,,-10';
    await writeFile(path.join(store.inboxPath, 'bank.csv'), report);
    assert.equal((await store.collect()).added, 1);
    assert.deepEqual(store.getState().plan, original.plan);
    assert.deepEqual(store.getState().transactions[0], original.transactions[0]);
    await writeFile(path.join(store.inboxPath, 'again.csv'), report);
    assert.equal((await store.collect()).duplicates, 1);
    const before = store.getState();
    await writeFile(path.join(store.inboxPath, 'bad.csv'), report + '\n02/30/2026,Bad,,-1');
    assert.equal((await store.collect()).errors.length, 1);
    assert.deepEqual(store.getState(), before);
  } finally {store.close(); await rm(runtimeDir, {recursive:true, force:true});}
});
