import {addDays, forecast, isValidDate} from './engine.mjs';

const DAY_MS = 86400000;
const toCents = amount => Math.round(amount * 100);
const moneySum = events => events.reduce((total, event) => total + toCents(event.amount), 0) / 100;
const dayNumber = date => new Date(`${date}T00:00:00Z`).getTime() / DAY_MS;

function checkModel(plan, model) {
  if (!plan || !model || !Array.isArray(model.events) || !Array.isArray(model.days) || model.startDate !== plan.startDate) {
    throw new Error('Use a forecast matching this plan and its starting date.');
  }
}

/**
 * Read one checkpoint from the existing forecast, rather than expanding schedules
 * or subtracting its selected bill a second time. The selected day includes all
 * outflows; same-day income cannot fund bills that leave before it arrives.
 */
export function getCheckpoint(plan, model, billId) {
  checkModel(plan, model);
  const upcoming = model.events.filter(event => event.type === 'bill' && event.date >= plan.startDate);
  const bill = billId === undefined || billId === null ? upcoming[0] : upcoming.find(event => event.id === String(billId));
  if (!bill) return null;
  const through = model.events.filter(event => event.date >= plan.startDate && event.date <= bill.date);
  const paychecks = through.filter(event => event.type === 'income' && event.date < bill.date);
  const days = model.days.filter(day => day.date >= plan.startDate && day.date <= bill.date);
  let lowest = toCents(plan.balance), lowestDate = plan.startDate;
  for (const day of days) {
    const low = toCents(day.lowBalance);
    if (low < lowest) { lowest = low; lowestDate = day.date; }
  }
  const billsThrough = moneySum(through.filter(event => event.type === 'bill'));
  const everydayThrough = moneySum(through.filter(event => event.type === 'everyday'));
  const scenarioThrough = moneySum(through.filter(event => event.type === 'scenario'));
  const cushion = toCents(plan.cushion);
  return {
    id: bill.id, name: bill.name, amount: bill.amount, date: bill.date,
    daysUntil: dayNumber(bill.date) - dayNumber(plan.startDate),
    paychecksBefore: paychecks.length, incomeBefore: moneySum(paychecks),
    billsThrough, everydayThrough, scenarioThrough,
    costsThrough: (toCents(billsThrough) + toCents(everydayThrough) + toCents(scenarioThrough)) / 100,
    lowestThrough: lowest / 100, lowestThroughDate: lowestDate,
    spendingRoomThrough: Math.max(0, lowest - cushion) / 100,
    cushionGapThrough: Math.max(0, cushion - lowest) / 100,
    shortfallThrough: Math.max(0, -lowest) / 100,
    paycheckEventsBefore: paychecks.map(event => ({...event})),
  };
}

/** A null nextDate means no occurrence within the supplied forecast horizon. */
export function listSchedules(plan, model) {
  checkModel(plan, model);
  return [['bills', 'bill'], ['paychecks', 'income']].flatMap(([field, kind]) => plan[field].map(item => {
    const next = model.events.find(event => event.type === kind && event.id === String(item.id) && event.date >= plan.startDate);
    return {kind, id: item.id, name: item.name, amount: item.amount, repeat: item.repeat || 'once', nextDate: next?.date || null};
  })).sort((a, b) => (a.nextDate || '9999-12-31').localeCompare(b.nextDate || '9999-12-31') || a.name.localeCompare(b.name));
}

/** Remove explicit bank metadata while retaining ordinary merchant words. */
export function normalizeMerchant(value) {
  let name = String(value || '').normalize('NFKC')
    // Fifth Third appends this structurally delimited location/card suffix.
    // Strip the suffix as a unit before generic punctuation normalization.
    .replace(/\s*,\s*[^,]+\s*,\s*[a-z]{2}\s+ON\s+\d{6}\s+FROM\s+CARD\s*#?\s*:\s*[x*\d]+\s*$/gi, ' ')
    .replace(/\bFROM\s+CARD\s*#?\s*:\s*[x*\d]+\b/gi, ' ')
    .replace(/\bON\s+\d{6}\b/gi, ' ')
    .replace(/\brecurring\s*purchase(?:\s+(?:at|from))?\b/gi, ' ')
    .replace(/\b(?:debit\s+card\s+purchase|card\s+purchase|purchase\s+at)\b/gi, ' ')
    .replace(/\b(?:card(?:\s+(?:ending|number|no))?|visa|mastercard)\s*[:#*-]?\s*(?:x{2,}|\*{2,})?\s*\d{4,}\b/gi, ' ')
    .replace(/\b(?:ref(?:erence)?|auth(?:orization)?|trace|transaction\s+id|billing\s+id|order\s+id)\s*[:#-]?\s*[a-z0-9][a-z0-9-]{3,}\b/gi, ' ')
    .replace(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/g, ' ')
    .replace(/\b(?:san\s+francisco\s+ca|menlo\s+park\s+ca|mountain\s+view\s+ca|new\s+york\s+ny)\b/gi, ' ')
    .replace(/\b[a-z]{2,}\d[a-z0-9]{5,}\b/gi, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  // Recognized billers retain a stable name despite dynamic card descriptors.
  for (const [pattern, canonical] of [[/\b(?:facebook|facebk|meta\s+ads)\b/,'facebook ads'],[/\bname\s*cheap(?:\s+com)?\b/,'namecheap'],[/\bgoogle\s+workspace\b/,'google workspace'],[/\banthropic\b/,'anthropic claude'],[/\bamazon\s+prime\b/,'amazon prime'],[/\b(?:dd\s+)?doordashdashpa\w*\b/,'doordash dashpass'],[/\bopenai\b/,'openai'],[/\bspotify\b/,'spotify'],[/\bnetflix\b/,'netflix'],[/\bgithub\b/,'github']]) if (pattern.test(name)) return canonical;
  return name;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function cadence(intervals) {
  const mid = median(intervals);
  for (const [repeat, low, high] of [['weekly', 5, 9], ['biweekly', 11, 17], ['monthly', 28, 31]]) {
    if (mid >= low && mid <= high && intervals.every(interval => interval >= low && interval <= high)) return repeat;
  }
  return null;
}

function nextDate(rows, repeat, asOf) {
  const last = rows.at(-1).date;
  if (repeat !== 'monthly') {
    const step = repeat === 'weekly' ? 7 : 14;
    const jumps = Math.max(1, Math.ceil((dayNumber(asOf) - dayNumber(last)) / step));
    return addDays(last, jumps * step);
  }
  // Reuse the existing engine's anchored month-end handling. The largest
  // observed day preserves Jan31 -> Feb28 -> Mar31 rather than drifting to28.
  const anchor = rows.reduce((best, row) => Number(row.date.slice(8)) > Number(best.date.slice(8)) ? row : best, rows[0]);
  const projected = forecast({startDate: asOf, balance: 0, cushion: 0, dailySpend: 0, horizon: 62, paychecks: [], bills: [{id: 'candidate', name: 'Candidate', amount: 0, date: anchor.date, repeat: 'monthly'}]});
  return projected.events.find(event => event.date > last)?.date || null;
}

/**
 * Review candidates only; never edits the plan. Three consistent observations
 * support cadence. A bank recurring marker alone is a tentative monthly guess,
 * except usage-based ads and uncertain renewals, which have no guessed due date.
 */
export function detectRecurring(transactions, plan, {asOf = plan.startDate} = {}) {
  if (!isValidDate(asOf)) throw new Error('Choose a valid review date in YYYY-MM-DD format.');
  const allowed = new Map(['Subscriptions', 'Utilities', 'Housing', 'Income'].map(category => [category.toLowerCase(), category]));
  const existing = new Set([...plan.bills, ...plan.paychecks].map(item => normalizeMerchant(item.name)));
  const groups = new Map();
  for (const row of transactions) {
    if (!row || !isValidDate(row.date) || row.date > asOf || typeof row.description !== 'string' || !Number.isFinite(row.amount) || row.amount === 0) continue;
    const rawCategory = String(row.category || '').toLowerCase();
    const marked = /\brecurring\s*purchase\b/i.test(row.description) && row.amount < 0;
    if (/^(?:transfers?|refunds?|fees)$/.test(rawCategory)) continue;
    const category = allowed.get(rawCategory) || (marked ? 'Subscriptions' : null);
    if (!category || (category === 'Income' ? row.amount <= 0 : row.amount >= 0)) continue;
    const merchant = normalizeMerchant(row.description);
    if (!merchant || existing.has(merchant)) continue;
    const kind = row.amount > 0 ? 'income' : 'bill';
    const key = JSON.stringify([merchant, kind, category]);
    if (!groups.has(key)) groups.set(key, {merchant, kind, category, rows: [], marked:false});
    groups.get(key).rows.push({...row});
    groups.get(key).marked ||= marked;
  }
  const suggestions = [];
  for (const group of groups.values()) {
    const rows = group.rows.sort((a, b) => a.date.localeCompare(b.date));
    const intervals = rows.slice(1).map((row, index) => dayNumber(row.date) - dayNumber(rows[index].date));
    const observed = rows.length >= 3 ? cadence(intervals) : null;
    const amounts = rows.map(row => Math.abs(toCents(row.amount)));
    const center = median(amounts);
    const spread = (Math.max(...amounts) - Math.min(...amounts)) / center;
    if (!center) continue;
    const supported = observed && spread <= 0.15;
    const uncertain = group.merchant === 'facebook ads' || group.merchant === 'namecheap';
    if (!supported && !group.marked) continue;
    const repeat = uncertain ? null : supported ? observed : 'monthly';
    const date = repeat ? nextDate(rows, repeat, asOf) : null;
    if (repeat && !date) continue;
    const tentative = !supported || uncertain;
    suggestions.push({
      key: encodeURIComponent(JSON.stringify([group.merchant, group.kind, repeat])),
      kind: group.kind, name: group.marked ? ({openai:'OpenAI'}[group.merchant] || group.merchant.replace(/\b\p{L}/gu, letter=>letter.toUpperCase())) : rows.at(-1).description.trim(), amount: Math.round(center) / 100,
      date, repeat, category: group.category,
      confidence:tentative?'tentative':'history-supported',dateBasis:'posted_date',amountBasis:'observed_median',recurrenceBasis:supported&&!uncertain?'observed_history':group.marked?'bank_recurring_marker':'observed_history',reviewOnly:uncertain,
      caution:uncertain?(group.merchant==='facebook ads'?'Ad spending is usage based; no fixed renewal date or amount is established.':'Renewal interval is unconfirmed; verify the service or domain renewal date.') : tentative?'Monthly timing is inferred from a bank recurring marker; confirm it before adding a bill.':null,
      evidence: {count: rows.length, firstDate: rows[0].date, lastDate: rows.at(-1).date, medianIntervalDays: intervals.length?median(intervals):null, amountSpreadPercent: Math.round(spread * 1000) / 10},
    });
  }
  return suggestions.sort((a, b) => (a.date||'9999-12-31').localeCompare(b.date||'9999-12-31') || a.name.localeCompare(b.name));
}
