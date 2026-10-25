import test from 'node:test';
import assert from 'node:assert/strict';
import {forecast, parseTransactions, addDays, isValidDate, suggestCategory} from '../dist/engine.mjs';

const plan = overrides => ({startDate: '2026-10-22', balance: 1100, cushion: 100, dailySpend: 0, horizon: 14, paychecks: [], bills: [], ...overrides});
const entry = (amount, date, repeat = 'once', name = 'Bill') => ({id: name, amount, date, repeat, name});

test('a positive ending balance does not hide a pre-payday shortfall', () => {
  const result = forecast(plan({dailySpend: 20, bills: [entry(1000, '2026-10-23')], paychecks: [entry(800, '2026-10-30', 'once', 'Pay')]}));
  assert.equal(result.ending, 620);
  assert.equal(result.min, -80);
  assert.equal(result.minDate, '2026-10-30');
  assert.equal(result.shortfall, 80);
  assert.equal(result.spendingRoom, 0);
  assert.equal(result.cushionGap, 180);
});

test('same-day outflows occur before income, including daily costs', () => {
  const result = forecast(plan({balance: 100, dailySpend: 10, horizon: 1, bills: [entry(150, '2026-10-22')], paychecks: [entry(500, '2026-10-22')]}));
  assert.equal(result.min, -60);
  assert.equal(result.ending, 440);
  assert.deepEqual(result.days[0].events.map(event => event.type), ['bill', 'everyday', 'income']);
});

test('starting cash limits spending room even if first-day income raises it', () => {
  const result = forecast(plan({balance: 80, horizon: 1, paychecks: [entry(1000, '2026-10-22')]}));
  assert.equal(result.min, 80);
  assert.equal(result.spendingRoom, 0);
  assert.equal(result.cushionGap, 20);
});

test('money arithmetic remains exact to cents over recurring additions', () => {
  const result = forecast(plan({balance: 10, cushion: 0, dailySpend: 0.1, horizon: 30}));
  assert.equal(result.ending, 7);
  assert.equal(result.everyday, 3);
  assert.equal(result.days.length, 30);
  assert.equal(result.endDate, '2026-11-20');
});

test('monthly recurrence clamps February but returns to anchored month day', () => {
  const result = forecast(plan({startDate: '2027-01-31', horizon: 90, bills: [entry(1, '2027-01-31', 'monthly')]}));
  assert.deepEqual(result.events.map(event => event.date), ['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
});

test('old recurring anchors skip already covered occurrences and retain frequency', () => {
  const result = forecast(plan({horizon: 22, paychecks: [entry(10, '2026-10-01', 'biweekly')], bills: [entry(1, '2026-10-01', 'weekly')]}));
  assert.deepEqual(result.events.filter(event => event.type === 'income').map(event => event.date), ['2026-10-29', '2026-11-12']);
  assert.equal(result.bills, 4);
  assert.equal(result.income, 20);
});

test('scenario is separate, dated and leaves saved plan unchanged', () => {
  const original = plan({balance: 500});
  const saved = JSON.stringify(original);
  const result = forecast(original, {amount: 125.25, date: '2026-10-24', name: 'Repair'});
  assert.equal(result.scenarioTotal, 125.25);
  assert.equal(result.ending, 374.75);
  assert.equal(result.spendingRoom, 274.75);
  assert.equal(JSON.stringify(original), saved);
  assert.equal(forecast(original).ending, 500);
  assert.throws(() => forecast(original, {amount: 5, date: '2027-01-01'}), /inside this forecast/);
});

test('zero income, negative opening balance and invalid input are explicit', () => {
  const result = forecast(plan({balance: -10, dailySpend: 1, horizon: 7}));
  assert.equal(result.shortfall, 17);
  assert.equal(result.income, 0);
  assert.throws(() => forecast(plan({balance: NaN})), /Starting balance/);
  assert.throws(() => forecast(plan({dailySpend: -1})), /Everyday spending/);
  assert.throws(() => forecast(plan({horizon: 181})), /1 to 180/);
  assert.throws(() => forecast(plan({bills: [entry(5, '2026-02-30')]})), /valid date/);
});

test('date arithmetic is stable over DST and rejects invalid calendar dates', () => {
  assert.equal(addDays('2026-11-01', 1), '2026-11-02');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(isValidDate('2026-02-29'), false);
  assert.equal(isValidDate('2026-2-01'), false);
});

test('CSV handles BOM, CRLF, commas, escaped quotes and multiline fields', () => {
  const rows = parseTransactions('\uFEFFdate,description,amount,category\r\n2026-10-20,"Market, \"\"Downtown\"\"",-45.50,Groceries\r\n2026-10-21,"Monthly\ncheck",800.00,\r\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].description, 'Market, "Downtown"');
  assert.equal(rows[0].amount, -45.5);
  assert.equal(rows[1].category, 'Income');
  assert.equal(rows[1].description, 'Monthly\ncheck');
});

test('dedup identities remain stable across reimport and category edits', () => {
  const first = parseTransactions('date,description,amount\n2026-10-20,Coffee,-5.00\n2026-10-20,Coffee,-5.00');
  const second = parseTransactions('date,description,amount,category\n2026-10-20,Coffee,-5.00,Other\n2026-10-20,Coffee,-5.00,Other');
  assert.notEqual(first[0].key, first[1].key);
  assert.deepEqual(first.map(row => row.key), second.map(row => row.key));
});

test('CSV validates whole import instead of returning partial valid rows', () => {
  assert.throws(() => parseTransactions('date,description,amount\n2026-10-20,Good,-10\n2026-02-30,Bad,-20'), /Row 3/);
  assert.throws(() => parseTransactions('date,description,amount\n2026-10-20,Cost,$50'), /signed decimal/);
  assert.throws(() => parseTransactions('date,description,amount\n2026-10-20,"Open,-20'), /not closed/);
  assert.throws(() => parseTransactions('date,amount\n2026-10-20,-20'), /Missing description/);
  assert.throws(() => parseTransactions('date,description,amount'), /no transactions/);
  assert.throws(() => parseTransactions('date,description,amount\n2026-10-20,Cost,-5,Extra'), /fields/);
  assert.equal(suggestCategory('Credit card payment'), 'Transfers');
});
