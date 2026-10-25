import {randomUUID} from 'node:crypto';
import {PlaidVault, plaidConfiguration} from './plaid-vault.mjs';
import {PlaidClient, PlaidError} from './plaid-client.mjs';
import {InputError} from './validation.mjs';
import {isValidDate, suggestCategory} from '../dist/engine.mjs';

const text = (value, fallback = '', max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : fallback;
const safeAmount = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1000000000 ? Math.round(value * 100) / 100 : null;
const appId = (itemId, transactionId) => `plaid:${itemId}:${encodeURIComponent(transactionId)}`;
const checkedId = value => { if (typeof value !== 'string' || !value || value.length > 200) throw new InputError('Choose a valid bank connection.'); return value; };
function providerCategory(row) {
  const primary = row.personal_finance_category?.primary || '';
  const detail = row.personal_finance_category?.detailed || '';
  if (/TRANSFER|LOAN_PAYMENTS/.test(primary)) return 'Transfer';
  if (/INCOME/.test(primary)) return 'Income';
  if (row.amount < 0) return 'Refund';
  if (/RENT/.test(detail)) return 'Housing';
  if (/UTILIT|INTERNET|TELEPHONE/.test(detail)) return 'Utilities';
  if (/GROCER/.test(detail)) return 'Groceries';
  if (/FOOD_AND_DRINK/.test(primary)) return 'Dining';
  if (/TRANSPORTATION|GAS/.test(primary + detail)) return 'Transport';
  if (/MEDICAL/.test(primary)) return 'Health';
  if (/GENERAL_MERCHANDISE/.test(primary)) return 'Shopping';
  return suggestCategory(row.merchant_name || row.name || '');
}
function normalizeTransaction(row, itemId) {
  if (!row || typeof row.transaction_id !== 'string' || row.transaction_id.length > 1000 || !row.transaction_id || !isValidDate(row.date) || safeAmount(row.amount) === null || typeof row.account_id !== 'string') throw new PlaidError('INVALID_RESPONSE');
  const currency = row.iso_currency_code || row.unofficial_currency_code || null;
  if (currency !== 'USD') return null;
  const id = appId(itemId, row.transaction_id);
  return {id, key: id, date: row.date, description: text(row.merchant_name || row.name, 'Bank transaction'), amount: -safeAmount(row.amount), category: providerCategory(row), source: 'plaid', bankItemId: itemId, bankAccountId: text(row.account_id, '', 1000), bankTransactionId: row.transaction_id, currency: 'USD', pending: row.pending === true, pendingTransactionId: typeof row.pending_transaction_id === 'string' ? row.pending_transaction_id : null};
}
function normalizeAccounts(accounts) {
  if (!Array.isArray(accounts)) throw new PlaidError('INVALID_RESPONSE');
  return accounts.map(account => ({id: text(account.account_id, '', 1000), name: text(account.name, 'Bank account', 100), mask: text(account.mask, '', 4), type: text(account.type, 'unknown', 50), subtype: text(account.subtype, '', 50), available: safeAmount(account.balances?.available), current: safeAmount(account.balances?.current), currency: text(account.balances?.iso_currency_code || account.balances?.unofficial_currency_code, '', 20) || null}));
}

export class BankingService {
  constructor(store, {env = process.env, fetchImpl, syncIntervalMs = Number(process.env.FINANCE_BANK_SYNC_INTERVAL_MS || 900000)} = {}) {
    if (!Number.isInteger(syncIntervalMs) || syncIntervalMs < 60000 || syncIntervalMs > 86400000) throw new Error('Bank sync interval must be between 1 minute and 24 hours.');
    this.store = store; this.db = store.db; this.vault = new PlaidVault(store.runtimeDir); this.syncIntervalMs = syncIntervalMs;
    this.readiness = plaidConfiguration(this.vault, env);
    this.client = this.readiness.configured ? new PlaidClient(this.readiness.config, {fetchImpl}) : null;
    this.inFlight = new Map(); this.closed = false;
    this.db.exec(`CREATE TABLE IF NOT EXISTS bank_items (id TEXT PRIMARY KEY, plaid_item_id TEXT NOT NULL UNIQUE, token TEXT NOT NULL, cursor TEXT NOT NULL DEFAULT '', institution_name TEXT NOT NULL, institution_id TEXT, accounts_json TEXT NOT NULL DEFAULT '[]', last_sync TEXT, last_error TEXT, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS bank_transactions (item_id TEXT NOT NULL, transaction_id TEXT NOT NULL, app_id TEXT NOT NULL, data TEXT NOT NULL, provider_category TEXT NOT NULL, pending INTEGER NOT NULL, PRIMARY KEY(item_id, transaction_id));`);
    this.db.prepare('INSERT OR IGNORE INTO metadata(key, value) VALUES (?, ?)').run('bank_schema_version', '1');
  }
  requireReady() { if (!this.readiness.configured) throw new InputError(this.readiness.message, 503); }
  requirePersonal() { if (this.store.getState().mode !== 'personal') throw new InputError('Switch to your own personal plan before connecting or syncing real accounts. Example data must stay separate.', 409); }
  item(id) { const row = this.db.prepare('SELECT * FROM bank_items WHERE id = ?').get(checkedId(id)); if (!row) throw new InputError('Bank connection not found.', 404); return row; }
  publicItem(row) {
    const pendingCount = this.db.prepare('SELECT COUNT(*) AS count FROM bank_transactions WHERE item_id = ? AND pending = 1').get(row.id).count;
    return {id: row.id, institutionName: row.institution_name, lastSync: row.last_sync, lastError: row.last_error, requiresReauth: row.last_error === new PlaidError('ITEM_LOGIN_REQUIRED').message, status: row.last_error ? 'attention' : 'connected', accounts: JSON.parse(row.accounts_json), pendingCount};
  }
  status() {
    const {configured, environment, missing, message} = this.readiness;
    return {provider: 'plaid', configured, environment, missing, message, syncIntervalMs: this.syncIntervalMs, items: this.db.prepare('SELECT * FROM bank_items ORDER BY created_at').all().map(row => this.publicItem(row))};
  }
  async createLinkToken({itemId} = {}) {
    this.requirePersonal(); this.requireReady();
    let user = this.db.prepare('SELECT value FROM metadata WHERE key = ?').get('plaid_client_user_id')?.value;
    if (!user) { user = randomUUID(); this.db.prepare('INSERT INTO metadata(key, value) VALUES (?, ?)').run('plaid_client_user_id', user); }
    const existing = itemId ? this.item(itemId) : null;
    const response = await this.client.request('/link/token/create', {user: {client_user_id: user}, client_name: 'Your finances', country_codes: ['US'], language: 'en', ...(existing ? {access_token: this.vault.decrypt(existing.token, `finance-plaid-item:${existing.id}`)} : {products: ['transactions'], transactions: {days_requested: 90}}), ...(this.readiness.config.redirectUri ? {redirect_uri: this.readiness.config.redirectUri} : {})});
    if (typeof response.link_token !== 'string' || typeof response.expiration !== 'string') throw new PlaidError('INVALID_RESPONSE');
    return {linkToken: response.link_token, expiration: response.expiration, environment: 'production', ...(existing ? {itemId: existing.id, updateMode: true} : {updateMode: false})};
  }
  async exchange({publicToken, institutionName, institutionId} = {}) {
    this.requirePersonal(); this.requireReady();
    if (typeof publicToken !== 'string' || !publicToken || publicToken.length > 2000) throw new InputError('Plaid Link must return a valid public token.');
    // Confirm usable local encryption before exchanging the one-use public token.
    const existing = this.db.prepare('SELECT COUNT(*) AS count FROM bank_items').get().count;
    this.vault.key(existing === 0);
    const response = await this.client.request('/item/public_token/exchange', {public_token: publicToken});
    const prior = typeof response.item_id === 'string' ? this.db.prepare('SELECT id FROM bank_items WHERE plaid_item_id = ?').get(response.item_id) : null;
    const id = prior?.id || randomUUID();
    try {
      if (typeof response.access_token !== 'string' || !response.access_token || typeof response.item_id !== 'string' || !response.item_id) throw new PlaidError('INVALID_RESPONSE');
      const details = await this.client.request('/item/get', {access_token: response.access_token});
      if (details.item?.item_id !== response.item_id) throw new PlaidError('INVALID_RESPONSE');
      const verifiedInstitutionId = text(details.item.institution_id, '', 200);
      const accounts = normalizeAccounts((await this.client.request('/accounts/get', {access_token: response.access_token})).accounts);
      for (const other of this.db.prepare('SELECT id, institution_id, accounts_json FROM bank_items WHERE id <> ?').all(id)) {
        const existingAccounts = JSON.parse(other.accounts_json);
        if ((verifiedInstitutionId && other.institution_id === verifiedInstitutionId) || accounts.some(account => existingAccounts.some(old => old.id === account.id))) {
          throw new InputError('This institution already has a saved connection. Reconnect that connection instead of creating duplicate history. Separate logins at the same institution are not supported yet.', 409);
        }
      }
      const token = this.vault.encrypt(response.access_token, `finance-plaid-item:${id}`);
      this.db.prepare(`INSERT INTO bank_items(id, plaid_item_id, token, institution_name, institution_id, accounts_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(plaid_item_id) DO UPDATE SET token = excluded.token, last_error = NULL, accounts_json = excluded.accounts_json`).run(id, response.item_id, token, text(details.item.institution_name || institutionName, 'Connected institution', 100), verifiedInstitutionId, JSON.stringify(accounts), new Date().toISOString());
    } catch (error) {
      const message = error instanceof InputError ? error.message : 'The bank connection could not be saved locally.';
      if (prior) throw new InputError(`${message} The existing local connection was preserved; reconnect that item before retrying.`, error.status || 502);
      if (typeof response.access_token === 'string' && response.access_token) {
        try { await this.client.request('/item/remove', {access_token: response.access_token}); }
        catch { throw new InputError(`${message} Plaid authorization may still be active even though no local connection was saved. Revoke this app through your bank or Plaid settings before trying again.`, 502); }
        throw new InputError(`${message} The new Plaid authorization was removed; no connection was saved.`, error.status || 502);
      }
      throw new InputError(`${message} Link completion could not be confirmed. Check your Plaid authorization before retrying.`, 502);
    }
    let sync = null, message = 'Your bank connection was saved. Cached balances do not replace your manual forecast balance.';
    try { sync = await this.sync(id); } catch (error) { message = `The connection was saved, but the first sync needs attention. ${error.message}`; }
    return {item: this.publicItem(this.item(id)), sync, message};
  }
  async sync(id) {
    this.requirePersonal(); this.requireReady(); checkedId(id);
    if (this.inFlight.has(id)) return this.inFlight.get(id);
    const work = this.runSync(id); this.inFlight.set(id, work);
    try { return await work; } finally { this.inFlight.delete(id); }
  }
  async runSync(id) {
    const item = this.item(id);
    const token = this.vault.decrypt(item.token, `finance-plaid-item:${id}`);
    try {
      let staged;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          let cursor = item.cursor, hasMore = true, pageCount = 0;
          staged = {added: [], modified: [], removed: [], cursor};
          while (hasMore) {
            if (++pageCount > 100) throw new InputError('This sync exceeded its page limit. No transaction changes or cursor were saved.', 502);
            const page = await this.client.request('/transactions/sync', {access_token: token, cursor, count: 500});
            if (!Array.isArray(page.added) || !Array.isArray(page.modified) || !Array.isArray(page.removed) || typeof page.next_cursor !== 'string' || typeof page.has_more !== 'boolean') throw new PlaidError('INVALID_RESPONSE');
            staged.added.push(...page.added); staged.modified.push(...page.modified); staged.removed.push(...page.removed);
            if (page.has_more && page.next_cursor === cursor) throw new PlaidError('INVALID_RESPONSE');
            cursor = page.next_cursor; hasMore = page.has_more;
          }
          staged.cursor = cursor; break;
        } catch (error) { if (error.providerCode !== 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' || attempt === 1) throw error; }
      }
      const accountResponse = await this.client.request('/accounts/get', {access_token: token});
      const accounts = normalizeAccounts(accountResponse.accounts);
      this.requirePersonal();
      const result = this.commitSync(id, staged, accounts);
      return {...result, item: this.publicItem(this.item(id))};
    } catch (error) {
      const message = error instanceof InputError ? error.message : 'Bank sync failed. Previous transactions and cursor were preserved.';
      this.db.prepare('UPDATE bank_items SET last_error = ? WHERE id = ?').run(message, id);
      throw error instanceof InputError ? error : new InputError(message, 502);
    }
  }
  commitSync(id, staged, accounts) {
    const changes = [...staged.added, ...staged.modified].map(row => ({raw: row, normalized: normalizeTransaction(row, id)}));
    for (const row of staged.removed) if (!row || typeof row.transaction_id !== 'string') throw new PlaidError('INVALID_RESPONSE');
    let added = 0, modified = 0, removed = 0, excludedCurrency = 0;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const state = this.store.getState();
      if (state.mode !== 'personal') throw new InputError('Bank sync paused because example data became active. Previous data and cursor were preserved.', 409);
      this.item(id); // A disconnect during the network request must not recreate it.
      const byId = new Map(state.transactions.map(row => [row.id, row]));
      const oldMeta = new Map(this.db.prepare('SELECT transaction_id, app_id, provider_category FROM bank_transactions WHERE item_id = ?').all(id).map(row => [row.transaction_id, row]));
      for (const {raw, normalized} of changes) {
        const transactionId = raw.transaction_id, key = appId(id, transactionId);
        if (!normalized) { excludedCurrency++; byId.delete(key); this.db.prepare('DELETE FROM bank_transactions WHERE item_id = ? AND transaction_id = ?').run(id, transactionId); continue; }
        const previous = byId.get(key);
        const previousMeta = oldMeta.get(transactionId);
        const pendingMeta = normalized.pendingTransactionId ? oldMeta.get(normalized.pendingTransactionId) : null;
        const oldPending = pendingMeta ? state.transactions.find(row => row.id === pendingMeta.app_id) : null;
        const defaultCategory = normalized.category;
        if (previous && previousMeta && previous.category !== previousMeta.provider_category) normalized.category = previous.category;
        else if (oldPending && oldPending.category !== pendingMeta.provider_category) normalized.category = oldPending.category;
        if (normalized.pendingTransactionId) {
          if (byId.delete(appId(id, normalized.pendingTransactionId))) removed++;
          this.db.prepare('DELETE FROM bank_transactions WHERE item_id = ? AND transaction_id = ?').run(id, normalized.pendingTransactionId);
        }
        this.db.prepare(`INSERT INTO bank_transactions(item_id, transaction_id, app_id, data, provider_category, pending) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(item_id, transaction_id) DO UPDATE SET app_id = excluded.app_id, data = excluded.data, provider_category = excluded.provider_category, pending = excluded.pending`).run(id, transactionId, key, JSON.stringify(normalized), defaultCategory, normalized.pending ? 1 : 0);
        if (normalized.pending) { byId.delete(key); continue; }
        byId.set(key, normalized); if (previous) modified++; else added++;
      }
      for (const row of staged.removed) {
        const key = appId(id, row.transaction_id);
        if (byId.delete(key)) removed++;
        this.db.prepare('DELETE FROM bank_transactions WHERE item_id = ? AND transaction_id = ?').run(id, row.transaction_id);
      }
      state.transactions = [...byId.values()];
      const changed = JSON.stringify(state.transactions) !== JSON.stringify(this.store.getState().transactions);
      const saved = changed ? this.store.setState(state) : state;
      const lastSync = new Date().toISOString();
      const warning = excludedCurrency ? `${excludedCurrency} non-USD transaction updates were excluded. This app does not convert currencies.` : null;
      this.db.prepare('UPDATE bank_items SET cursor = ?, accounts_json = ?, last_sync = ?, last_error = ? WHERE id = ?').run(staged.cursor, JSON.stringify(accounts), lastSync, warning, id);
      this.db.exec('COMMIT');
      return {added, modified, removed, excludedCurrency, revision: saved.revision, lastSync, balanceUpdated: false};
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  async disconnect(id) {
    this.requireReady(); const item = this.item(id);
    if (this.inFlight.has(id)) await this.inFlight.get(id).catch(() => {});
    await this.client.request('/item/remove', {access_token: this.vault.decrypt(item.token, `finance-plaid-item:${id}`)});
    this.db.exec('BEGIN IMMEDIATE');
    try { this.db.prepare('DELETE FROM bank_transactions WHERE item_id = ?').run(id); this.db.prepare('DELETE FROM bank_items WHERE id = ?').run(id); this.db.exec('COMMIT'); }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return {disconnected: true, historyPreserved: true};
  }
  start() {
    if (!this.client) return;
    const tick = () => {
      if (this.closed || this.store.getState().mode !== 'personal') return;
      for (const row of this.db.prepare('SELECT id FROM bank_items').all()) this.sync(row.id).catch(() => {});
    };
    this.timer = setInterval(tick, this.syncIntervalMs); this.timer.unref();
  }
  async close() { this.closed = true; clearInterval(this.timer); await Promise.allSettled([...this.inFlight.values()]); }
}
