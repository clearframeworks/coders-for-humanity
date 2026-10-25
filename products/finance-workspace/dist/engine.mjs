// Pure cash-flow calculations. All arithmetic uses integer cents; public values
// are dollars. A horizon includes its starting day and does not advance with time.
const DAY = 86400000;

export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dayNumber(value) {
  if (!isValidDate(value)) throw new Error('Use a valid date in YYYY-MM-DD format.');
  return new Date(`${value}T00:00:00Z`).getTime() / DAY;
}

function dateString(day) { return new Date(day * DAY).toISOString().slice(0, 10); }
export function addDays(date, count) {
  if (!Number.isInteger(count)) throw new Error('Days must be a whole number.');
  return dateString(dayNumber(date) + count);
}

function cents(value, label, negative = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1000000000 || (!negative && value < 0)) {
    throw new Error(`${label} must be a finite ${negative ? '' : 'nonnegative '}amount of no more than 1 billion.`);
  }
  return Math.round((value + Math.sign(value) * Number.EPSILON) * 100);
}
const dollars = value => value / 100;

function monthlyDate(anchor, monthOffset) {
  const [year, month, day] = anchor.split('-').map(Number);
  const monthStart = new Date(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01T00:00:00Z`);
  monthStart.setUTCMonth(monthStart.getUTCMonth() + monthOffset);
  const last = new Date(monthStart);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  monthStart.setUTCDate(Math.min(day, last.getUTCDate()));
  return monthStart.toISOString().slice(0, 10);
}

function occurrences(item, start, end) {
  const anchor = dayNumber(item.date);
  const repeat = item.repeat || 'once';
  if (!['once', 'weekly', 'biweekly', 'monthly'].includes(repeat)) throw new Error('Choose once, weekly, biweekly or monthly.');
  if (anchor > end) return [];
  if (repeat === 'once') return anchor >= start ? [item.date] : [];
  const dates = [];
  if (repeat === 'monthly') {
    const first = dateString(start);
    const monthDifference = (Number(first.slice(0, 4)) - Number(item.date.slice(0, 4))) * 12 + Number(first.slice(5, 7)) - Number(item.date.slice(5, 7));
    for (let offset = Math.max(0, monthDifference); ; offset++) {
      const date = monthlyDate(item.date, offset);
      const day = dayNumber(date);
      if (day > end) break;
      if (day >= start) dates.push(date);
    }
  } else {
    const step = repeat === 'weekly' ? 7 : 14;
    for (let day = anchor + Math.max(0, Math.ceil((start - anchor) / step)) * step; day <= end; day += step) dates.push(dateString(day));
  }
  return dates;
}

/**
 * Bills, a scenario and everyday spending leave before same-day pay arrives.
 * The minimum includes these intraday troughs and the starting balance. A lower
 * end-of-day chart alone must not be used to replace this conservative minimum.
 */
export function forecast(plan, scenario = null) {
  if (!plan || typeof plan !== 'object') throw new Error('Add a plan to build a forecast.');
  const start = dayNumber(plan.startDate);
  if (!Number.isInteger(plan.horizon) || plan.horizon < 1 || plan.horizon > 180) throw new Error('Choose a forecast of 1 to 180 days.');
  const end = start + plan.horizon - 1;
  const cushion = cents(plan.cushion, 'Cushion');
  const daily = cents(plan.dailySpend, 'Everyday spending');
  let balance = cents(plan.balance, 'Starting balance', true);
  let minimum = balance;
  let minDate = plan.startDate;
  let totalIncome = 0, totalBills = 0, totalEveryday = 0, scenarioTotal = 0;
  const byDate = new Map();
  function schedule(date, event) {
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(event);
  }
  for (const [field, type] of [['bills', 'bill'], ['paychecks', 'income']]) {
    if (!Array.isArray(plan[field])) throw new Error(`${field} must be a list.`);
    for (const item of plan[field]) {
      if (!item || typeof item !== 'object') throw new Error(`Each ${type} needs a date and amount.`);
      const amount = cents(item.amount, type === 'bill' ? 'Bill' : 'Paycheck');
      const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : type === 'bill' ? 'Bill' : 'Paycheck';
      for (const date of occurrences(item, start, end)) schedule(date, {id: String(item.id ?? `${type}-${name}`), name, type, amount});
    }
  }
  if (scenario) {
    const date = dayNumber(scenario.date);
    if (date < start || date > end) throw new Error('Choose an expense date inside this forecast.');
    const amount = cents(scenario.amount, 'Extra expense');
    schedule(scenario.date, {id: 'scenario', name: scenario.name?.trim() || 'Extra expense', type: 'scenario', amount});
  }
  const days = [], allEvents = [];
  for (let day = start; day <= end; day++) {
    const date = dateString(day), startBalance = balance;
    const events = [...(byDate.get(date) || [])];
    if (daily) events.push({id: `everyday-${date}`, name: 'Everyday spending', type: 'everyday', amount: daily});
    events.sort((a, b) => Number(a.type === 'income') - Number(b.type === 'income'));
    let low = balance, income = 0, bills = 0, everyday = 0, expenses = 0;
    const outputEvents = [];
    for (const event of events) {
      const signedAmount = event.type === 'income' ? event.amount : -event.amount;
      balance += signedAmount;
      if (!Number.isSafeInteger(balance)) throw new Error('Forecast amounts are too large.');
      low = Math.min(low, balance);
      if (balance < minimum) { minimum = balance; minDate = date; }
      if (event.type === 'income') { income += event.amount; totalIncome += event.amount; }
      else {
        expenses += event.amount;
        if (event.type === 'bill') { bills += event.amount; totalBills += event.amount; }
        if (event.type === 'everyday') { everyday += event.amount; totalEveryday += event.amount; }
        if (event.type === 'scenario') scenarioTotal += event.amount;
      }
      const output = {...event, date, amount: dollars(event.amount), signedAmount: dollars(signedAmount), balance: dollars(balance)};
      outputEvents.push(output); allEvents.push(output);
    }
    days.push({date, startBalance: dollars(startBalance), income: dollars(income), bills: dollars(bills), everyday: dollars(everyday), expenses: dollars(expenses), balance: dollars(balance), lowBalance: dollars(low), events: outputEvents});
  }
  return {days, events: allEvents, startDate: plan.startDate, endDate: dateString(end), min: dollars(minimum), minDate, ending: dollars(balance), income: dollars(totalIncome), bills: dollars(totalBills), everyday: dollars(totalEveryday), scenarioTotal: dollars(scenarioTotal), spendingRoom: dollars(Math.max(0, minimum - cushion)), cushionGap: dollars(Math.max(0, cushion - minimum)), shortfall: dollars(Math.max(0, -minimum))};
}

export function suggestCategory(description) {
  const value = String(description).toLowerCase();
  const rules = [
    ['Transfers', /\btransfer\b|credit card payment/],
    ['Groceries', /grocery|groceries|supermarket|whole foods|trader joe|aldi|kroger|publix/],
    ['Transport', /fuel|gas station|shell|exxon|chevron|uber|lyft|transit|parking/],
    ['Dining', /restaurant|coffee|cafe|pizza|doordash|ubereats|starbucks|mcdonald/],
    ['Housing', /\brent\b|mortgage/],
    ['Utilities', /electric|water bill|utility|utilities|internet|broadband|phone bill/],
    ['Subscriptions', /netflix|spotify|hulu|subscription|disney|adobe/],
    ['Health', /pharmacy|doctor|hospital|dental|medical|cvs|walgreens/],
    ['Shopping', /amazon|target|walmart|store|shopping/],
  ];
  return rules.find(([, pattern]) => pattern.test(value))?.[0] || 'Other';
}

function csvCells(text) {
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { cell += '"'; index++; }
        else { quoted = false; closed = true; }
      } else cell += char;
    } else if (char === '"') {
      if (cell || closed) throw new Error('A CSV quote must begin a field.');
      quoted = true;
    } else if (char === ',' || char === '\n' || char === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (char !== ',') {
        if (char === '\r' && text[index + 1] === '\n') index++;
        if (row.some(value => value.trim() !== '')) rows.push(row);
        row = [];
      }
    } else {
      if (closed && char.trim()) throw new Error('Unexpected text after a quoted CSV field.');
      if (!closed) cell += char;
    }
  }
  if (quoted) throw new Error('A quoted CSV field was not closed.');
  row.push(cell);
  if (row.some(value => value.trim() !== '')) rows.push(row);
  return rows;
}

/** Signed decimal amounts: negative spending, positive money in. No currency symbols. */
export function parseTransactions(text) {
  if (typeof text !== 'string' || text.length > 5000000) throw new Error('Choose a CSV file smaller than 5 MB.');
  const rows = csvCells(text.replace(/^\uFEFF/, ''));
  if (!rows.length) throw new Error('The CSV is empty. Include date, description and amount headers.');
  const headers = rows.shift().map(value => value.trim().toLowerCase());
  if (headers.includes('transaction id') && headers.includes('net amount')) return parseCashAppReport(text);
  if (headers.length === 4 && headers.join('|') === 'date|description|check number|amount') return parseFifthThirdReport(text);
  if (new Set(headers).size !== headers.length) throw new Error('CSV column names must be unique.');
  for (const required of ['date', 'description', 'amount']) if (!headers.includes(required)) throw new Error(`Missing ${required} column. Use date, description, amount and optional category.`);
  if (!rows.length) throw new Error('The CSV has headers but no transactions.');
  if (rows.length > 20000) throw new Error('Import no more than 20,000 transactions at a time.');
  const duplicates = new Map();
  return rows.map((cells, index) => {
    const line = index + 2;
    if (cells.length !== headers.length) throw new Error(`Row ${line} has ${cells.length} fields; expected ${headers.length}.`);
    const get = key => cells[headers.indexOf(key)]?.trim() || '';
    const date = get('date'), description = get('description'), amountText = get('amount');
    if (!isValidDate(date)) throw new Error(`Row ${line}: use a valid date in YYYY-MM-DD format.`);
    if (!description || description.length > 500) throw new Error(`Row ${line}: include a description of 1 to 500 characters.`);
    if (!/^[+-]?\d+(\.\d{1,2})?$/.test(amountText)) throw new Error(`Row ${line}: use a signed decimal amount, such as -45.50; omit currency symbols.`);
    const amountCents = cents(Number(amountText), `Row ${line} amount`, true);
    const amount = dollars(amountCents);
    const category = get('category') || (amount > 0 ? 'Income' : suggestCategory(description));
    if (category.length > 100) throw new Error(`Row ${line}: keep categories under 100 characters.`);
    const identity = JSON.stringify([date, description.toLowerCase(), amountCents]);
    const occurrence = (duplicates.get(identity) || 0) + 1;
    duplicates.set(identity, occurrence);
    // Preserve the full identity rather than a short hash: a collision must not
    // cause a valid financial transaction to disappear during deduplication.
    const key = `${encodeURIComponent(identity)}-${occurrence}`;
    return {id: `csv-${key}`, key, date, description, amount, category};
  });
}

const CASH_APP_HEADERS = ['date', 'transaction id', 'transaction type', 'currency', 'amount', 'fee', 'net amount', 'asset type', 'asset price', 'asset amount', 'status', 'notes', 'name of sender/receiver', 'account'];

/** One selected checking account: this export contains neither account IDs nor status. */
export function parseFifthThirdReport(text) {
  if (typeof text !== 'string' || text.length > 5000000) throw new Error('Choose a CSV file smaller than 5 MB.');
  const rows = csvCells(text.replace(/^\uFEFF/, ''));
  const headers = (rows.shift() || []).map(value => value.trim().toLowerCase());
  if (headers.join('|') !== 'date|description|check number|amount') throw new Error('Fifth Third export columns have changed. Use the checking transaction CSV.');
  if (!rows.length || rows.length > 20000) throw new Error('Fifth Third export must contain 1 to 20,000 rows.');
  const occurrences = new Map();
  const result = rows.map((cells, index) => {
    const label = `Fifth Third row ${index + 2}`;
    if (cells.length !== 4) throw new Error(`${label}: incorrect number of fields.`);
    const [reportedDate, description, checkNumber, amountText] = cells.map(value => value.trim());
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(reportedDate);
    const date = match ? `${match[3]}-${match[1]}-${match[2]}` : '';
    if (!isValidDate(date)) throw new Error(`${label}: use a valid MM/DD/YYYY date.`);
    if (!description || description.length > 500 || checkNumber.length > 100) throw new Error(`${label}: invalid description or check number.`);
    if (!/^[+-]?\d+(\.\d{1,2})?$/.test(amountText)) throw new Error(`${label}: use signed decimal amounts without currency symbols.`);
    const amountCents = cents(Number(amountText), `${label} amount`, true);
    const cashApp = /\bcash\s*app\b/i.test(description);
    const explicitTransfer = /\btransfer\b|credit card payment/i.test(description) || (cashApp && /\bach\b|\badd\s*cash\b|\bcash\s*out\b|\bweb initiated payment at\s+cash\s*app\b|\bdeposit\b.*\bcash\s*app\b/i.test(description));
    const fee = /\b(?:overdraft|service|maintenance|atm|bank)\s+(?:charge|fee)\b|\bfee\b/i.test(description);
    const needsReview = cashApp || explicitTransfer;
    const category = fee ? 'Fees' : explicitTransfer ? 'Transfers' : needsReview ? 'Other' : amountCents > 0 ? 'Income' : suggestCategory(description);
    const fingerprint = JSON.stringify([date, description, checkNumber, amountCents]);
    const occurrence = (occurrences.get(fingerprint) || 0) + 1;
    occurrences.set(fingerprint, occurrence);
    const key = `fifththird:selected-checking:${encodeURIComponent(fingerprint)}:${occurrence}`;
    if (key.length > 4996) throw new Error(`${label}: transaction identity exceeds the import limit.`);
    return {id: key, key, date, description, amount: dollars(amountCents), category, source: 'fifththird', checkNumber, needsReview};
  });
  Object.defineProperty(result, 'importSummary', {value: {provider: 'Fifth Third', rows: rows.length, completed: rows.length, pending: null, failed: null, notifications: 0}});
  return result;
}

/** Official Cash App USD report. Keep reported local dates; never infer a balance. */
export function parseCashAppReport(text) {
  if (typeof text !== 'string' || text.length > 5000000) throw new Error('Choose a CSV file smaller than 5 MB.');
  const rows = csvCells(text.replace(/^\uFEFF/, ''));
  const headers = (rows.shift() || []).map(value => value.trim().toLowerCase());
  if (headers.length !== CASH_APP_HEADERS.length || headers.some((value, index) => value !== CASH_APP_HEADERS[index])) throw new Error('Cash App report columns have changed. Use the official transaction CSV report.');
  if (!rows.length || rows.length > 20000) throw new Error('Cash App report must contain 1 to 20,000 rows.');
  const output = [], occurrences = new Map(), ids = new Set();
  const summary = {rows: rows.length, completed: 0, pending: 0, failed: 0, notifications: 0};
  for (const [index, cells] of rows.entries()) {
    const label = `Cash App row ${index + 2}`;
    if (cells.length !== headers.length) throw new Error(`${label}: incorrect number of fields.`);
    const get = name => cells[headers.indexOf(name)].trim();
    if (get('currency') !== 'USD' || get('asset type') || get('asset price') || get('asset amount')) throw new Error(`${label}: only USD cash transactions are supported; asset transactions need separate review.`);
    const money = name => {
      const value = get(name);
      if (name === 'fee' && value === '') return 0;
      if (!/^[+-]?\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value)) throw new Error(`${label}: invalid ${name}.`);
      return cents(Number(value.replace(/[$,]/g, '')), `${label} ${name}`, true);
    };
    const amount = money('amount'), fee = money('fee'), net = money('net amount');
    if (amount + fee !== net) throw new Error(`${label}: amount plus fee does not equal net amount.`);
    const status = get('status');
    if (!['COMPLETE', 'FAILED', 'WAITING_ON_RECIPIENT'].includes(status)) throw new Error(`${label}: unsupported transaction status.`);
    if (status !== 'COMPLETE') { summary[status === 'FAILED' ? 'failed' : 'pending']++; continue; }
    summary.completed++;
    const stamp = get('date');
    if (!/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d (?:EDT|EST)$/.test(stamp) || !isValidDate(stamp.slice(0, 10))) throw new Error(`${label}: invalid reported local date.`);
    const date = stamp.slice(0, 10), type = get('transaction type').replace(/\s+/g, '');
    if (type === 'AccountNotifications' && amount === 0 && fee === 0) { summary.notifications++; continue; }
    const providerId = get('transaction id');
    if (providerId && ids.has(providerId)) throw new Error(`${label}: duplicate Cash App transaction ID.`);
    if (providerId) ids.add(providerId);
    const fingerprint = JSON.stringify([stamp, type, amount, fee, get('notes'), get('name of sender/receiver'), get('account')]);
    const occurrence = (occurrences.get(fingerprint) || 0) + 1;
    occurrences.set(fingerprint, occurrence);
    const key = providerId ? `cashapp:${encodeURIComponent(providerId)}` : `cashapp:unidentified:${encodeURIComponent(fingerprint)}:${occurrence}`;
    const transfer = ['Deposits', 'Withdrawal', 'PaperMoneyDeposit'].includes(type);
    const known = transfer || ['CashCard', 'P2P'].includes(type);
    const description = get('notes') || get('name of sender/receiver') || type || 'Cash App transaction';
    if (description.length > 500 || key.length > 4996) throw new Error(`${label}: transaction text exceeds the import limit.`);
    const category = transfer ? 'Transfers' : type === 'CashCard' ? amount > 0 ? 'Refunds' : suggestCategory(description) : type === 'P2P' && amount > 0 ? 'Income' : 'Other';
    const common = {date, source: 'cashapp', cashAppTransactionId: providerId || null, cashAppType: type, needsReview: !providerId || !known || type === 'P2P'};
    output.push({...common, id: key, key, description, amount: dollars(amount), category, sourceCategory: category});
    if (fee) output.push({...common, id: `${key}:fee`, key: `${key}:fee`, description: `Cash App fee: ${description}`.slice(0, 500), amount: dollars(fee), category: 'Fees', sourceCategory: 'Fees'});
  }
  Object.defineProperty(output, 'importSummary', {value: summary});
  return output;
}

/** Shared browser/inbox reconciliation. Only provider-owned fields are refreshed. */
export function mergeTransactions(existing, incoming) {
  const incomingKeys = new Set(incoming.map(row => row.key));
  const refreshedPrincipals = new Set(incoming.filter(row => row.source === 'cashapp' && !row.key.endsWith(':fee')).map(row => row.key));
  let removed = 0;
  const transactions = existing.filter(row => {
    if (row.source === 'cashapp' && row.key.endsWith(':fee') && refreshedPrincipals.has(row.key.slice(0, -4)) && !incomingKeys.has(row.key)) { removed++; return false; }
    return true;
  }).map(row => ({...row}));
  const positions = new Map(transactions.map((row, index) => [row.key, index]));
  let added = 0, updated = 0, duplicates = 0;
  for (const row of incoming) {
    const position = positions.get(row.key);
    if (position === undefined) {
      positions.set(row.key, transactions.length); transactions.push({...row}); added++; continue;
    }
    const previous = transactions[position];
    if (row.source !== 'cashapp' || previous.source !== 'cashapp') { duplicates++; continue; }
    const next = {...previous, ...row, category: previous.category !== previous.sourceCategory ? previous.category : row.category};
    if (JSON.stringify(next) === JSON.stringify(previous)) duplicates++;
    else { transactions[position] = next; updated++; }
  }
  return {transactions, added, updated, duplicates, removed};
}
