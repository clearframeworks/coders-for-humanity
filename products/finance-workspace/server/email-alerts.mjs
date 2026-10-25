import {categoryForHistory} from '../dist/spending-plan.mjs';
import {createHash} from 'node:crypto';
import {InputError} from './validation.mjs';
import {suggestCategory} from '../dist/engine.mjs';

const fail = message => {throw new InputError(message);};
const hash = value => createHash('sha256').update(value).digest('hex');
const normalizedMerchant = value => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function headers(raw, name) {
  return (raw?.payload?.headers || []).filter(item => typeof item?.name === 'string' && item.name.toLowerCase() === name.toLowerCase()).map(item => item.value);
}
function header(raw, name) {
  const values = headers(raw, name);
  if (values.length !== 1 || typeof values[0] !== 'string') fail(`Cash App email needs one ${name} header.`);
  return values[0].trim();
}
function textParts(payload, result = {plain: [], html: []}, depth = 0) {
  if (!payload || depth > 12) fail('Cash App email MIME structure is unsupported.');
  if (['text/plain', 'text/html'].includes(payload.mime_type)) {
    const body = payload.body || {};
    const value = typeof body.content === 'string' ? body.content : typeof body.base64_url_content === 'string' ? Buffer.from(body.base64_url_content, 'base64url').toString('utf8') : '';
    if (value) result[payload.mime_type === 'text/plain' ? 'plain' : 'html'].push(value);
  }
  for (const child of payload.parts || []) textParts(child, result, depth + 1);
  return result;
}
function purchase(value) {
  const match = /^You spent (\$(?:\d+|\d{1,3}(?:,\d{3})+)\.\d{2}) at (.{1,500})$/u.exec(value.trim());
  if (!match) fail('Cash App email is not the supported purchase alert template.');
  const amountCents = Math.round(Number(match[1].replace(/[$,]/g, '')) * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 100000000000) fail('Cash App purchase amount is invalid.');
  const merchant = match[2].replace(/\.$/, '').trim();
  if (!merchant || merchant.length > 500) fail('Cash App purchase merchant is invalid.');
  return {amount: -amountCents / 100, merchant};
}

/** Accept trusted Gmail-native messages; provider authentication is Gmail's verdict,
 * not a locally performed cryptographic verification of arbitrary supplied JSON. */
export function parseCashAppEmail(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Buffer.byteLength(JSON.stringify(raw)) > 5000000) fail('Choose a Gmail-native Cash App email smaller than 5 MB.');
  if (typeof raw.id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(raw.id)) fail('Cash App email needs its stable Gmail message ID.');
  const sender = header(raw, 'From');
  if (!/^(?:cash@square\.com|[^<>\r\n]*<cash@square\.com>)$/i.test(sender)) fail('Cash App email sender is not cash@square.com.');
  const auth = headers(raw, 'Authentication-Results').find(value => typeof value === 'string' && /^mx\.google\.com\s*;/i.test(value.trim()));
  if (!auth || !/\bdkim=pass\b[^;]*\bheader\.(?:i|d)=(?:@|[^\s;@]+@)?square\.com(?=[;\s]|$)/i.test(auth) || !/\bdmarc=pass\b[^;]*\bheader\.from=square\.com(?=[;\s]|$)/i.test(auth) || (/\bspf=/i.test(auth) && !/\bspf=pass\b/i.test(auth))) fail('Cash App email lacks passing aligned Gmail authentication results; review it before importing.');
  const subject = purchase(header(raw, 'Subject'));
  const parts = textParts(raw.payload);
  if (parts.plain.length !== 1 || parts.html.length !== 1) fail('Cash App purchase email needs one plain text and one HTML receipt.');
  const body = purchase(parts.plain[0].trim());
  if (subject.amount !== body.amount || normalizedMerchant(subject.merchant) !== normalizedMerchant(body.merchant)) fail('Cash App email subject and purchase body disagree.');
  const html = parts.html[0];
  const statuses = new Set([...html.matchAll(/<(?:td|span|p|div)\b[^>]*>\s*(Complete|Pending)\s*<\//gi)].map(match => match[1].toLowerCase()));
  if (statuses.size !== 1) fail('Cash App receipt status is missing or ambiguous.');
  const receipts = new Set();
  for (const match of html.matchAll(/\bhref\s*=\s*(["'])(.*?)\1/gi)) {
    try {
      const url = new URL(match[2].replace(/&amp;/g, '&'));
      const token = /^\/launch\/activity\/receipt\/([A-Za-z0-9_+=\/-]{8,4096})$/.exec(url.pathname)?.[1];
      if (url.origin === 'https://cash.app' && !url.username && !url.password && [...url.searchParams.keys()].every(key => ['accountPid','metadata_id'].includes(key)) && !url.hash && token) receipts.add(token);
    } catch {}
  }
  if (receipts.size !== 1) fail('Cash App email needs one unambiguous official receipt identity.');
  if (typeof raw.internal_date !== 'string' || !/^\d{13}$/.test(raw.internal_date)) fail('Cash App email needs its Gmail received timestamp.');
  const received = new Date(Number(raw.internal_date));
  if (!Number.isFinite(received.getTime()) || received.getUTCFullYear() < 2000 || received.getUTCFullYear() > 2200) fail('Cash App email received date is invalid.');
  const date = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York', year:'numeric', month:'2-digit', day:'2-digit'}).format(received);
  const receiptId = hash([...receipts][0]);
  return {provider:'cashapp', messageId:raw.id, receiptId, status:[...statuses][0] === 'complete' ? 'completed' : 'pending', date, amount:subject.amount, merchant:subject.merchant, category:suggestCategory(subject.merchant), dateBasis:'email_received', authentication:'gmail-aligned-pass'};
}

function schema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS email_alerts (receipt_id TEXT PRIMARY KEY, data TEXT NOT NULL, matched_transaction_id TEXT, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS email_alert_messages (message_id TEXT PRIMARY KEY, receipt_id TEXT NOT NULL, digest TEXT NOT NULL);
  `);
}
function hasSchema(db) {return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='email_alerts'").get();}
function semanticCandidates(transactions, alert) {
  return transactions.filter(row => row.source === 'cashapp' && row.cashAppType === 'CashCard' && row.date === alert.date && Math.round(row.amount * 100) === Math.round(alert.amount * 100) && normalizedMerchant(row.description) === normalizedMerchant(alert.merchant));
}

/** Import a pre-fetched Gmail batch atomically; this module has no mail/network client. */
export function importEmailMessages(store, messages, {now = new Date().toISOString()} = {}) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 1000) fail('Import 1 to 1,000 Cash App emails at a time.');
  const alerts = messages.map(parseCashAppEmail);
  const timestamp = typeof now === 'function' ? now() : now;
  if (typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp))) fail('Email import time is invalid.');
  const result = {processed:messages.length, added:0, updated:0, pending:0, duplicates:0, matched:0, review:0};
  const db = store.db;
  db.exec('BEGIN IMMEDIATE');
  try {
    schema(db);
    const state = store.getState();
    if (state.mode !== 'personal') fail('Switch to your own plan before importing real email alerts.');
    const original = JSON.stringify(state.transactions);
    for (const alert of alerts) {
      const digest = hash(JSON.stringify(alert));
      const knownMessage = db.prepare('SELECT receipt_id, digest FROM email_alert_messages WHERE message_id = ?').get(alert.messageId);
      if (knownMessage) {
        if (knownMessage.receipt_id !== alert.receiptId || knownMessage.digest !== digest) fail('A previously imported Gmail message changed. Review the source before retrying.');
        result.duplicates++; continue;
      }
      const record = db.prepare('SELECT data, matched_transaction_id FROM email_alerts WHERE receipt_id = ?').get(alert.receiptId);
      const previous = record ? JSON.parse(record.data) : null;
      let saved = {...alert, needsReview:false, matchMethod:null}, matchedId = record?.matched_transaction_id || null;
      // A later delivery of an older pending alert must not reverse completion.
      if (previous?.status === 'completed' && alert.status === 'pending') {
        result.duplicates++;
      } else {
        const key = 'cashapp-email:' + alert.receiptId;
        const existing = state.transactions.find(row => row.key === key && row.source === 'cashapp-email');
        if (alert.status === 'pending') result.pending++;
        else {
          const candidates = semanticCandidates(state.transactions, alert);
          const possibleDuplicates = state.transactions.filter(row => row.source === 'cashapp' && row.cashAppType === 'CashCard' && row.date === alert.date && Math.round(row.amount * 100) === Math.round(alert.amount * 100));
          const claimed = new Set(db.prepare('SELECT matched_transaction_id FROM email_alerts WHERE receipt_id != ? AND matched_transaction_id IS NOT NULL').all(alert.receiptId).map(row => row.matched_transaction_id));
          if (candidates.length === 1 && !claimed.has(candidates[0].id)) {
            matchedId = candidates[0].id; saved.matchMethod = 'unique_date_amount_merchant'; result.matched++;
            // Preserve CSV as authority; a previously unmatched email copy can
            // be reconciled when this same receipt is delivered again later.
            if (existing) {state.transactions = state.transactions.filter(row => row !== existing);result.updated++;}
          } else if (candidates.length || possibleDuplicates.length) {
            saved.needsReview = true; saved.matchMethod = 'ambiguous_history'; matchedId = null; result.review++;
          } else {
            const transaction = {id:key,key,date:alert.date,description:alert.merchant,amount:alert.amount,category:existing?.category || alert.category,source:'cashapp-email',emailReceiptId:alert.receiptId,needsReview:true,dateBasis:'email_received'};
            saved.needsReview = true; saved.matchMethod = 'email_only'; matchedId = key; result.review++;
            if (existing) {
              if (JSON.stringify(existing) !== JSON.stringify(transaction)) {Object.assign(existing,transaction);result.updated++;}
              else result.duplicates++;
            } else {if(state.plan.forecastBasis?.ownerPurposeRules)transaction.category=categoryForHistory(transaction);state.transactions.push(transaction);result.added++;}
          }
        }
        db.prepare('INSERT INTO email_alerts(receipt_id,data,matched_transaction_id,updated_at) VALUES (?,?,?,?) ON CONFLICT(receipt_id) DO UPDATE SET data=excluded.data,matched_transaction_id=excluded.matched_transaction_id,updated_at=excluded.updated_at').run(alert.receiptId,JSON.stringify(saved),matchedId,timestamp);
      }
      db.prepare('INSERT INTO email_alert_messages(message_id,receipt_id,digest) VALUES (?,?,?)').run(alert.messageId,alert.receiptId,digest);
    }
    if (JSON.stringify(state.transactions) !== original) store.setState(state);
    db.prepare('INSERT INTO metadata(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('email_import_status',JSON.stringify({lastImport:timestamp,...result}));
    db.exec('COMMIT'); return result;
  } catch (error) {db.exec('ROLLBACK');throw error;}
}

export function readEmailStatus(store) {
  const saved = store.db.prepare('SELECT value FROM metadata WHERE key=?').get('email_import_status');
  const data = hasSchema(store.db) ? store.db.prepare('SELECT data FROM email_alerts').all().map(row => JSON.parse(row.data)) : [];
  return {configured:false,transport:'prefetched-gmail-json',lastImport:saved ? JSON.parse(saved.value).lastImport : null,total:data.length,pending:data.filter(row => row.status==='pending').length,completed:data.filter(row => row.status==='completed').length,review:data.filter(row=>row.needsReview).length,lastResult:saved ? JSON.parse(saved.value) : null};
}
export function readEmailAlerts(store, {offset=0,limit=50} = {}) {
  if (!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>200) fail('Choose a valid email alert page.');
  if (!hasSchema(store.db)) return [];
  return store.db.prepare('SELECT data FROM email_alerts ORDER BY updated_at DESC,receipt_id LIMIT ? OFFSET ?').all(limit,offset).map(row=>JSON.parse(row.data));
}

/** Caller owns BEGIN/COMMIT and setState. Refresh receipt matches after a CSV
 * merge; remove only the exact email-owned copy with one unclaimed CSV match. */
export function reconcileEmailHistory(store, incomingTransactions) {
  if (!Array.isArray(incomingTransactions) || incomingTransactions.length > 20000) fail('Email reconciliation needs a bounded transaction list.');
  let transactions = incomingTransactions.map(row => ({...row}));
  let reconciled = 0, review = 0;
  if (!hasSchema(store.db)) return {transactions,reconciled,review};
  const records = store.db.prepare('SELECT receipt_id,data,matched_transaction_id FROM email_alerts ORDER BY receipt_id').all();
  if (records.length > 20000) fail('Email alert history exceeds the reconciliation limit.');
  const claims = new Map();
  for (const record of records) if (record.matched_transaction_id) {
    if (!claims.has(record.matched_transaction_id)) claims.set(record.matched_transaction_id,new Set());
    claims.get(record.matched_transaction_id).add(record.receipt_id);
  }
  for (const record of records) {
    const alert = JSON.parse(record.data);
    if (alert.status !== 'completed') continue;
    const candidates = semanticCandidates(transactions,alert);
    const available = candidates.length === 1 && [...(claims.get(candidates[0].id)||[])].every(id=>id===record.receipt_id);
    let saved = alert, matchedId = record.matched_transaction_id;
    if (available) {
      const key = 'cashapp-email:' + record.receipt_id;
      const count = transactions.length;
      transactions = transactions.filter(row => !(row.source === 'cashapp-email' && row.key === key && row.emailReceiptId === record.receipt_id));
      if (transactions.length < count) reconciled++;
      if (matchedId && claims.has(matchedId)) claims.get(matchedId).delete(record.receipt_id);
      matchedId = candidates[0].id;
      if (!claims.has(matchedId)) claims.set(matchedId,new Set());
      claims.get(matchedId).add(record.receipt_id);
      saved = {...alert,needsReview:false,matchMethod:'unique_date_amount_merchant'};
    } else if (candidates.length) {
      saved = {...alert,needsReview:true,matchMethod:'ambiguous_history'};review++;
    }
    if (JSON.stringify(saved)!==record.data || matchedId!==record.matched_transaction_id) store.db.prepare('UPDATE email_alerts SET data=?,matched_transaction_id=? WHERE receipt_id=?').run(JSON.stringify(saved),matchedId,record.receipt_id);
  }
  return {transactions,reconciled,review};
}
