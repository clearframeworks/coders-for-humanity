import test from 'node:test';
import assert from 'node:assert/strict';
import {forecast} from '../dist/engine.mjs';
import {getCheckpoint, listSchedules, detectRecurring, normalizeMerchant} from '../dist/planning.mjs';

const plan = changes => ({startDate: '2026-10-22', balance: 1100, cushion: 100, dailySpend: 10, horizon: 30, paychecks: [], bills: [], ...changes});
const item = (id, amount, date, repeat = 'once', name = id) => ({id, name, amount, date, repeat});
const row = (date, amount = -12, category = 'Subscriptions', description = 'Video subscription') => ({date, amount, category, description});

test('checkpoint reads existing occurrences once and excludes same-day paychecks', () => {
  const p = plan({bills: [item('phone', 50, '2026-10-23'), item('rent', 1000, '2026-10-25'), item('later', 300, '2026-11-01')], paychecks: [item('early', 200, '2026-10-24'), item('same-day', 800, '2026-10-25')]});
  const model = forecast(p), before = JSON.stringify({p, model});
  const checkpoint = getCheckpoint(p, model, 'rent');
  assert.equal(checkpoint.daysUntil, 3);
  assert.equal(checkpoint.paychecksBefore, 1); assert.equal(checkpoint.incomeBefore, 200);
  assert.equal(checkpoint.billsThrough, 1050); assert.equal(checkpoint.everydayThrough, 40); assert.equal(checkpoint.costsThrough, 1090);
  assert.equal(checkpoint.lowestThrough, 210); assert.equal(checkpoint.spendingRoomThrough, 110);
  assert.equal(checkpoint.lowestThroughDate, '2026-10-25');
  assert.equal(JSON.stringify({p, model}), before);
});

test('checkpoint retains opening-cash constraint and discloses a pre-payday deficit', () => {
  const p = plan({balance: 50, dailySpend: 0, bills: [item('rent', 100, '2026-10-22')], paychecks: [item('pay', 200, '2026-10-22')]});
  const checkpoint = getCheckpoint(p, forecast(p), 'rent');
  assert.equal(checkpoint.daysUntil, 0); assert.equal(checkpoint.paychecksBefore, 0);
  assert.equal(checkpoint.lowestThrough, -50); assert.equal(checkpoint.spendingRoomThrough, 0);
  assert.equal(checkpoint.shortfallThrough, 50); assert.equal(checkpoint.cushionGapThrough, 150);
  assert.equal(getCheckpoint(p, forecast(p), 'missing'), null);
  assert.equal(getCheckpoint(plan(), forecast(plan())), null);
});

test('schedule listing uses current forecast window and preserves month-end anchoring', () => {
  const p = plan({startDate: '2027-02-01', horizon: 40, dailySpend: 0, bills: [item('monthly', 50, '2027-01-31', 'monthly'), item('past', 5, '2027-01-10'), item('future', 5, '2028-01-01')], paychecks: [item('weekly', 100, '2027-01-01', 'weekly')]});
  const listed = listSchedules(p, forecast(p));
  assert.equal(listed.find(entry => entry.id === 'monthly').nextDate, '2027-02-28');
  assert.equal(listed.find(entry => entry.id === 'weekly').nextDate, '2027-02-05');
  assert.equal(listed.find(entry => entry.id === 'past').nextDate, null);
  assert.equal(listed.find(entry => entry.id === 'future').nextDate, null);
  assert.equal(listed.find(entry => entry.id === 'weekly').kind, 'income');
});

test('monthly candidates include evidence and use anchored month ends without mutating history', () => {
  const p = plan({startDate: '2027-04-01'});
  const transactions = [row('2027-01-31'), row('2027-02-28'), row('2027-03-31')];
  const before = JSON.stringify({transactions, p});
  const suggestions = detectRecurring(transactions, p);
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].date, '2027-04-30'); assert.equal(suggestions[0].repeat, 'monthly'); assert.equal(suggestions[0].amount, 12);
  assert.deepEqual(suggestions[0].evidence, {count: 3, firstDate: '2027-01-31', lastDate: '2027-03-31', medianIntervalDays: 29.5, amountSpreadPercent: 0});
  assert.equal(JSON.stringify({transactions, p}), before);
});

test('weekly and biweekly suggestions advance arithmetically to the review date', () => {
  const p = plan({startDate: '2026-11-30'});
  const weekly = [row('2026-10-01', -20, 'Utilities', 'Weekly utility'), row('2026-10-08', -20, 'Utilities', 'Weekly utility'), row('2026-10-15', -20, 'Utilities', 'Weekly utility')];
  const income = [row('2026-10-01', 800, 'Income', 'Payroll'), row('2026-10-15', 800, 'Income', 'Payroll'), row('2026-10-29', 800, 'Income', 'Payroll')];
  const suggestions = detectRecurring([...weekly, ...income], p);
  assert.equal(suggestions.find(entry => entry.repeat === 'weekly').date, '2026-12-03');
  assert.equal(suggestions.find(entry => entry.repeat === 'biweekly').date, '2026-12-10');
  assert.equal(suggestions.find(entry => entry.repeat === 'biweekly').kind, 'income');
});

test('variable, everyday, transfer, refund and future-only records are excluded', () => {
  const p = plan({startDate: '2026-10-22'}), dates = ['2026-08-01', '2026-09-01', '2026-10-01'];
  const transactions = [
    ...dates.map((date, i) => row(date, [-10, -40, -12][i], 'Utilities', 'Variable electric')),
    ...dates.map(date => row(date, -12, 'Groceries', 'Monthly groceries')),
    ...dates.map(date => row(date, -12, 'Transfer', 'Regular transfer')),
    ...dates.map(date => row(date, 12, 'Refund', 'Recurring refund')),
    ...dates.map(date => row(date, 12, 'Subscriptions', 'Positive subscription')),
    ...['2026-11-01', '2026-12-01', '2027-01-01'].map(date => row(date, -12, 'Subscriptions', 'Future record')),
  ];
  assert.deepEqual(detectRecurring(transactions, p), []);
});

test('existing normalized schedule names suppress duplicate candidates', () => {
  const transactions = [row('2026-08-01', -12, 'Subscriptions', 'VIDEO-SUBSCRIPTION 1234'), row('2026-09-01', -12, 'Subscriptions', 'Video Subscription 4321'), row('2026-10-01', -12, 'Subscriptions', 'video subscription 9999')];
  const p = plan({bills: [item('existing', 12, '2026-11-01', 'monthly', 'Video subscription')]});
  assert.equal(normalizeMerchant(transactions[0].description), 'video subscription');
  assert.deepEqual(detectRecurring(transactions, p), []);
});

test('one irregular gap, same-day duplicates, and fewer than three records do not imply recurrence', () => {
  const p = plan();
  assert.deepEqual(detectRecurring([row('2026-09-01'), row('2026-09-08'), row('2026-10-01')], p), []);
  assert.deepEqual(detectRecurring([row('2026-09-01'), row('2026-09-01'), row('2026-10-01')], p), []);
  assert.deepEqual(detectRecurring([row('2026-09-01'), row('2026-10-01')], p), []);
  assert.throws(() => detectRecurring([], p, {asOf: '2026-02-30'}), /valid review date/);
});

test('a recorded payment on the review date is not suggested a second time that day', () => {
  const p = plan({startDate: '2026-10-22'});
  const transactions = [row('2026-10-08', -12), row('2026-10-15', -12), row('2026-10-22', -12)];
  assert.equal(detectRecurring(transactions, p)[0].date, '2026-10-29');
});

test('bank normalization removes explicit references, card/date/location noise and preserves meaningful merchant words',()=>{
  assert.equal(normalizeMerchant('RECURRING PURCHASE AT OPENAI *CHATGPT SAN FRANCISCO CA CARD ENDING 1234 REF ABC123XYZ 10/01/2026'),'openai');
  assert.equal(normalizeMerchant('Recurring Purchase at Video Subscription Billing ID ZX123ABC 2026-10-01'),'video subscription');
  assert.equal(normalizeMerchant('7 Eleven'),'7 eleven');
  assert.equal(normalizeMerchant('Studio 54'),'studio 54');
});

test('a single explicit bank recurring purchase gives only a tentative monthly review proposal',()=>{
  const p=plan(),transactions=[row('2026-10-01',-15,'Other','RECURRING PURCHASE AT OPENAI CARD 1234 REF ABC123XYZ')],before=JSON.stringify({p,transactions});
  const [candidate]=detectRecurring(transactions,p);
  assert.equal(candidate.name,'OpenAI');assert.equal(candidate.repeat,'monthly');assert.equal(candidate.date,'2026-11-01');assert.equal(candidate.category,'Subscriptions');
  assert.equal(candidate.confidence,'tentative');assert.equal(candidate.dateBasis,'posted_date');assert.equal(candidate.amountBasis,'observed_median');assert.equal(candidate.recurrenceBasis,'bank_recurring_marker');assert.equal(candidate.evidence.count,1);assert.equal(candidate.evidence.medianIntervalDays,null);assert.match(candidate.caution,/confirm/i);
  assert.equal(JSON.stringify({p,transactions}),before);
});

test('Facebook ad charges and Namecheap renewals never acquire a guessed monthly fixed bill',()=>{
  const rows=[row('2026-10-01',-8,'Other','RECURRING PURCHASE AT FACEBK *ABC12345 MENLO PARK CA'),row('2026-10-08',-24,'Other','RECURRING PURCHASE AT FACEBOOK ADS REF XYZ12345'),row('2026-10-02',-14,'Other','RECURRING PURCHASE AT NAMECHEAP REF WWW12345')];
  const candidates=detectRecurring(rows,plan());assert.equal(candidates.length,2);
  for(const item of candidates){assert.equal(item.repeat,null);assert.equal(item.date,null);assert.equal(item.reviewOnly,true);assert.equal(item.confidence,'tentative');}
  assert.match(candidates.find(c=>c.name==='Facebook Ads').caution,/usage based/);
  assert.match(candidates.find(c=>c.name==='Namecheap').caution,/unconfirmed/);
});

test('confirmed normalized merchant bill suppresses marker proposal and noisy history still supports cadence',()=>{
  const transaction=row('2026-10-01',-15,'Other','RECURRING PURCHASE AT OPENAI SAN FRANCISCO CA REF ABC123XYZ');
  assert.deepEqual(detectRecurring([transaction],plan({bills:[item('known',15,'2026-11-01','monthly','OpenAI')]})),[]);
  const supported=detectRecurring(['2026-08-01','2026-09-01','2026-10-01'].map((date,i)=>row(date,-12,'Subscriptions',`Video subscription CARD ${1234+i} REF ABC${i}12345 ${date}`)),plan());
  assert.equal(supported.length,1);assert.equal(supported[0].confidence,'history-supported');assert.equal(supported[0].repeat,'monthly');assert.equal(supported[0].recurrenceBasis,'observed_history');
});

test('a recurring marker does not turn transfers, fees, refunds or future data into subscription bills',()=>{
  const rows=[row('2026-10-01',-12,'Transfers','RECURRING PURCHASE AT Example'),row('2026-10-01',-12,'Fees','RECURRING PURCHASE AT Example'),row('2026-10-01',12,'Other','RECURRING PURCHASE AT Example'),row('2026-12-01',-12,'Other','RECURRING PURCHASE AT Example')];
  assert.deepEqual(detectRecurring(rows,plan()),[]);
});

test('observed Fifth Third comma/location/date/masked-card shapes yield stable billers and uncertain Namecheap renewal',()=>{
  const samples=[
    ['RECURRING PURCHASE AT GOOGLE WORKSPACE_C, MOUNTAIN VIEW, CA ON 100126 FROM CARD#: XXXXXXXXXXXX0000','google workspace'],
    ['RECURRING PURCHASE AT NAME-CHEAP.COM* GX, PHOENIX, AZ ON 101226 FROM CARD#: XXXXXXXXXXXX0000','namecheap'],
    ['RECURRING PURCHASE AT ANTHROPIC* CLAUDE, SAN FRANCISCO, CA ON 100326 FROM CARD#: XXXXXXXXXXXX0000','anthropic claude'],
    ['RECURRING PURCHASE AT AMAZON PRIME*I8604, SEATTLE, WA ON 100626 FROM CARD#: XXXXXXXXXXXX0000','amazon prime'],
    ['RECURRING PURCHASE AT DD *DOORDASHDASHPA, SAN FRANCISCO, CA ON 101200 FROM CARD#: XXXXXXXXXXXX0000','doordash dashpass']
  ];
  for(const [description,expected] of samples)assert.equal(normalizeMerchant(description),expected);
  const proposals=detectRecurring(samples.map(([description])=>row('2026-10-12',-15,'Other',description)),plan());
  assert.equal(proposals.length,5);
  const renewal=proposals.find(p=>p.name==='Namecheap');assert.ok(renewal);assert.equal(renewal.repeat,null);assert.equal(renewal.date,null);assert.equal(renewal.reviewOnly,true);
  assert.ok(proposals.every(p=>!p.name.includes('Card')&&!p.name.includes('Seattle')&&!p.name.includes('Phoenix')));
});
