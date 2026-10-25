import {forecast, isValidDate} from '../dist/engine.mjs';

export class InputError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError(`${label} must be an object.`);
}
function text(value, label, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new InputError(`${label} must contain 1 to ${max} characters.`);
}
function money(value, label, negative = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1000000000 || (!negative && value < 0)) throw new InputError(`${label} must be a finite ${negative ? '' : 'nonnegative '}amount.`);
  if (Math.abs(value * 100 - Math.round(value * 100)) > 0.0001) throw new InputError(`${label} must use no more than two decimal places.`);
}

export function validateState(value) {
  object(value, 'State');
  if (value.version !== 1) throw new InputError('Unsupported state version. Expected version 1.');
  if (!['personal', 'sample', 'example'].includes(value.mode)) throw new InputError('State mode must be personal, sample or example.');
  const p = value.plan;
  object(p, 'Plan');
  if (!isValidDate(p.startDate)) throw new InputError('Plan start date must be a valid YYYY-MM-DD date.');
  money(p.balance, 'Starting balance', true); money(p.cushion, 'Cushion'); money(p.dailySpend, 'Daily spending');
  if (!Number.isInteger(p.horizon) || p.horizon < 7 || p.horizon > 180) throw new InputError('Forecast horizon must be 7 to 180 whole days.');
  if (!Array.isArray(p.accounts) || p.accounts.length > 100) throw new InputError('Accounts must be a list of no more than 100 accounts.');
  const accountIds = new Set();
  let accountCents = 0;
  for (const account of p.accounts) {
    object(account, 'Account'); text(account.id, 'Account ID', 200); text(account.name, 'Account name', 100); money(account.balance, 'Account balance', true);
    if (accountIds.has(account.id)) throw new InputError('Account IDs must be unique.');
    accountIds.add(account.id); accountCents += Math.round(account.balance * 100);
  }
  if (p.accounts.length && accountCents !== Math.round(p.balance * 100)) throw new InputError('Starting balance must equal the total of available account balances.');
  for (const key of ['paychecks', 'bills']) {
    if (!Array.isArray(p[key]) || p[key].length > 1000) throw new InputError(`${key} must be a list of no more than 1,000 entries.`);
    const ids = new Set();
    for (const entry of p[key]) {
      object(entry, key); text(entry.id, 'Entry ID', 200); text(entry.name, 'Entry name', 100); money(entry.amount, 'Entry amount');
      if (ids.has(entry.id)) throw new InputError(`IDs within ${key} must be unique.`);
      ids.add(entry.id);
      if (!isValidDate(entry.date)) throw new InputError('Each entry needs a valid YYYY-MM-DD date.');
      if (!['once', 'weekly', 'biweekly', 'monthly'].includes(entry.repeat)) throw new InputError('Choose once, weekly, biweekly or monthly recurrence.');
    }
  }
  if (!Array.isArray(value.transactions) || value.transactions.length > 20000) throw new InputError('Transactions must be a list of no more than 20,000 entries.');
  const transactionKeys = new Set(), transactionIds = new Set();
  for (const row of value.transactions) {
    object(row, 'Transaction'); text(row.id, 'Transaction ID', 5000); text(row.key, 'Transaction key', 5000); text(row.description, 'Transaction description'); text(row.category, 'Transaction category', 100); money(row.amount, 'Transaction amount', true);
    if (!isValidDate(row.date)) throw new InputError('Each transaction needs a valid YYYY-MM-DD date.');
    if (transactionKeys.has(row.key) || transactionIds.has(row.id)) throw new InputError('Transaction IDs and keys must be unique.');
    transactionKeys.add(row.key); transactionIds.add(row.id);
  }
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 2 * 1024 * 1024) throw new InputError('State exceeds the 2 MB storage limit. Export and reduce transaction history first.', 413);
  try { forecast(p); } catch (error) { throw new InputError(error.message); }
  return value;
}

export function validateScenario(value, plan) {
  object(value, 'Scenario'); money(value.amount, 'Scenario amount');
  if (!isValidDate(value.date)) throw new InputError('Scenario needs a valid YYYY-MM-DD date.');
  if (value.name !== undefined && (typeof value.name !== 'string' || value.name.length > 100)) throw new InputError('Scenario name must be at most 100 characters.');
  try { return forecast(plan, value); } catch (error) { throw new InputError(error.message); }
}
