import {InputError} from './validation.mjs';

const MESSAGES = {
  ITEM_LOGIN_REQUIRED: 'Your bank requires you to reconnect through Plaid Link.',
  INVALID_API_KEYS: 'Plaid rejected the configured production app credentials. Check your production credentials and access in the Plaid dashboard.',
  INVALID_ACCESS_TOKEN: 'Plaid rejected this saved connection. Review or disconnect it before linking again.',
  INSTITUTION_NOT_RESPONDING: 'Your bank is not responding to Plaid. Try syncing again later.',
  INSTITUTION_DOWN: 'Your bank is temporarily unavailable through Plaid. Try again later.',
  PRODUCT_NOT_READY: 'Plaid is still preparing transaction history. The next scheduled sync can try again.',
  RATE_LIMIT_EXCEEDED: 'Plaid has limited requests. Wait before trying again.',
  TRANSACTIONS_SYNC_ITEM_LIMIT_EXCEEDED: 'Plaid cannot start sync for this large history. Existing data and cursor were preserved; contact Plaid support for the appropriate history path.',
};
export class PlaidError extends InputError {
  constructor(code = 'PROVIDER_UNAVAILABLE') { super(MESSAGES[code] || 'Plaid could not complete this request. Existing data was preserved. Review the bank connection or try again later.', 502); this.providerCode = /^[A-Z_]{1,100}$/.test(code) ? code : 'PROVIDER_UNAVAILABLE'; }
}

export class PlaidClient {
  constructor(config, {fetchImpl = globalThis.fetch} = {}) { this.config = config; this.fetchImpl = fetchImpl; }
  async request(endpoint, payload = {}) {
    let response, body;
    try {
      response = await this.fetchImpl(`https://production.plaid.com${endpoint}`, {method: 'POST', headers: {'Content-Type': 'application/json', 'Plaid-Version': '2020-09-14'}, body: JSON.stringify({...payload, client_id: this.config.clientId, secret: this.config.secret}), signal: AbortSignal.timeout(20000)});
      body = await response.json();
    } catch { throw new PlaidError('PROVIDER_UNAVAILABLE'); }
    if (!body || typeof body !== 'object') throw new PlaidError('INVALID_RESPONSE');
    if (!response.ok || body.error_code) throw new PlaidError(body.error_code);
    return body;
  }
}
