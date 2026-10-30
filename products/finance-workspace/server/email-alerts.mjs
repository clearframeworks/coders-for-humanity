import {createHash} from 'node:crypto';
import {InputError} from './validation.mjs';
import {suggestCategory} from '../dist/engine.mjs';
import {normalizeMerchant} from '../dist/planning.mjs';
import {parseFifthThirdEmail} from './fifth-third-alerts.mjs';
import {parseCashAppSentEmail} from './cashapp-sent-alerts.mjs';

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
function p2pIdentity(row,alert){
  return [alert.recipient,alert.note].filter(value=>typeof value==='string'&&value.trim()).map(normalizedMerchant).includes(normalizedMerchant(String(row.description||'')));
}
function linkedP2PFee(transactions,principal,alert){
  if(!(principal.amount<0)||principal.date!==alert.date)return null;
  const fees=transactions.filter(row=>row.source==='cashapp'&&row.cashAppType==='P2P'&&row.key===principal.key+':fee');
  if(fees.length!==1)return null;
  const fee=fees[0];
  const originalFee=fee.sourceCategory==='Fees';
  const sameProviderId=!(principal.cashAppTransactionId||fee.cashAppTransactionId)||(typeof principal.cashAppTransactionId==='string'&&!!principal.cashAppTransactionId&&principal.cashAppTransactionId===fee.cashAppTransactionId);
  return originalFee&&sameProviderId&&fee.date===principal.date&&Number.isFinite(fee.amount)&&fee.amount<0&&Math.round(principal.amount*100)+Math.round(fee.amount*100)===Math.round(alert.amount*100)?fee:null;
}
function candidateClaimIds(transactions,candidate,alert){
  const fee=alert.cashAppType==='P2P'&&Math.round(candidate.amount*100)!==Math.round(alert.amount*100)?linkedP2PFee(transactions,candidate,alert):null;
  return [candidate.id,...(fee?[fee.id]:[])];
}
function cashAppMatchMethod(transactions,candidate,alert){
  if(alert.cashAppType!=='P2P')return 'unique_date_amount_merchant';
  return Math.round(candidate.amount*100)!==Math.round(alert.amount*100)&&linkedP2PFee(transactions,candidate,alert)?'unique_date_total_with_explicit_fee_heuristic':'unique_date_amount_recipient_or_note';
}
function possibleCashAppDuplicates(transactions,alert){
  return transactions.filter(row=>row.source==='cashapp'&&row.cashAppType===(alert.cashAppType==='P2P'?'P2P':'CashCard')&&(alert.cashAppType!=='P2P'||!row.key?.endsWith(':fee'))&&row.date===alert.date&&(Math.round(row.amount*100)===Math.round(alert.amount*100)||(alert.cashAppType==='P2P'&&p2pIdentity(row,alert))));
}
function semanticCandidates(transactions, alert) {
  if(alert.provider==='fifththird'){
    const merchant=value=>normalizeMerchant(String(value).replace(/^(?:debit\s+card\s+purchase|card\s+purchase|purchase)\s+(?:at\s+)?/i,''));
    return transactions.filter(row=>row.source==='fifththird'&&row.date===alert.date&&Math.round(row.amount*100)===Math.round(alert.amount*100)&&merchant(row.description)===merchant(alert.merchant));
  }
  if(alert.cashAppType==='P2P'){
    return transactions.filter(row=>row.source==='cashapp'&&row.cashAppType==='P2P'&&!row.key?.endsWith(':fee')&&row.date===alert.date&&p2pIdentity(row,alert)&&(Math.round(row.amount*100)===Math.round(alert.amount*100)||linkedP2PFee(transactions,row,alert)));
  }
  return transactions.filter(row => row.source === 'cashapp' && row.cashAppType === 'CashCard' && row.date === alert.date && Math.round(row.amount * 100) === Math.round(alert.amount * 100) && normalizedMerchant(row.description) === normalizedMerchant(alert.merchant));
}
function p2pCompetes(alert,candidate,alerts,transactions){
  return alert.cashAppType==='P2P'&&alerts.some(other=>other.receiptId!==alert.receiptId&&other.cashAppType==='P2P'&&other.status==='completed'&&semanticCandidates(transactions,other).some(row=>row.id===candidate.id));
}
function parseEmail(raw){
  const senders=headers(raw,'From');
  if(senders.length===1&&typeof senders[0]==='string'&&/^(?:FifthThirdBank@53\.com|[^<>\r\n]*<FifthThirdBank@53\.com>)$/i.test(senders[0].trim()))return parseFifthThirdEmail(raw);
  return headers(raw,'Subject').length===1&&headers(raw,'Subject')[0]==='Payment sent'?parseCashAppSentEmail(raw):parseCashAppEmail(raw);
}
function fifthThirdDigest(raw){
  // Gmail history, labels and thread metadata can change after delivery. Only
  // the native identity, received timestamp and MIME evidence define this copy.
  return 'fifththird-native-v1:'+hash(JSON.stringify({id:raw.id,internal_date:raw.internal_date,payload:raw.payload}));
}

/** Import a pre-fetched Gmail batch atomically; this module has no mail/network client. */
export function importEmailMessages(store, messages, {now = new Date().toISOString()} = {}) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 1000) fail('Import 1 to 1,000 supported purchase emails at a time.');
  const alerts = messages.map(parseEmail);
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
    const competingAlerts=[...db.prepare('SELECT data FROM email_alerts').all().map(row=>JSON.parse(row.data)),...alerts];
    for (const [index,alert] of alerts.entries()) {
      const digest = alert.provider==='fifththird'?fifthThirdDigest(messages[index]):hash(JSON.stringify(alert));
      const knownMessage = db.prepare('SELECT receipt_id, digest FROM email_alert_messages WHERE message_id = ?').get(alert.messageId);
      if (knownMessage) {
        if (knownMessage.receipt_id !== alert.receiptId) fail('A previously imported Gmail message changed. Review the source before retrying.');
        if(knownMessage.digest!==digest){
          const exactLegacy=alert.provider==='fifththird'&&/^[a-f0-9]{64}$/.test(knownMessage.digest)&&knownMessage.digest===hash(JSON.stringify(messages[index]));
          if(!exactLegacy)fail('A previously imported Gmail message changed. Review the source before retrying.');
          // Upgrade only when the caller supplies the exact old native JSON.
          // A refreshed envelope cannot establish what the legacy hash covered.
          db.prepare('UPDATE email_alert_messages SET digest=? WHERE message_id=? AND digest=?').run(digest,alert.messageId,knownMessage.digest);
        }
        result.duplicates++; continue;
      }
      const record = db.prepare('SELECT data, matched_transaction_id FROM email_alerts WHERE receipt_id = ?').get(alert.receiptId);
      const previous = record ? JSON.parse(record.data) : null;
      if(alert.cashAppType==='P2P'&&previous&&['provider','paymentKind','cashAppType','amount','recipient','note'].some(field=>previous[field]!==alert[field]))fail('A Cash App sent receipt changed its payment identity. Review the source before retrying.');
      if(alert.provider==='fifththird'){
        if(previous&&['provider','date','amount','merchant','status'].some(field=>previous[field]!==alert[field]))fail('A Fifth Third provider message changed. Review the source before retrying.');
        const candidates=semanticCandidates(state.transactions,alert);
        const claimed=new Set(db.prepare('SELECT matched_transaction_id FROM email_alerts WHERE receipt_id != ? AND matched_transaction_id IS NOT NULL').all(alert.receiptId).map(row=>row.matched_transaction_id));
        const unique=candidates.length===1&&!claimed.has(candidates[0].id);
        const saved={...alert,needsReview:true,matchMethod:unique?'unique_date_amount_merchant_heuristic':candidates.length?'ambiguous_history':'reported_only'};
        db.prepare('INSERT INTO email_alerts(receipt_id,data,matched_transaction_id,updated_at) VALUES (?,?,?,?) ON CONFLICT(receipt_id) DO UPDATE SET data=excluded.data,matched_transaction_id=excluded.matched_transaction_id,updated_at=excluded.updated_at').run(alert.receiptId,JSON.stringify(saved),unique?candidates[0].id:null,timestamp);
        db.prepare('INSERT INTO email_alert_messages(message_id,receipt_id,digest) VALUES (?,?,?)').run(alert.messageId,alert.receiptId,digest);
        if(unique)result.matched++;result.review++;continue;
      }
      let saved = {...alert, needsReview:false, matchMethod:null}, matchedId = record?.matched_transaction_id || null;
      // A later delivery of an older pending alert must not reverse completion.
      if (previous?.status === 'completed' && alert.status === 'pending') {
        result.duplicates++;
      } else {
        const key = 'cashapp-email:' + alert.receiptId;
        const existing = state.transactions.find(row => row.key === key && row.source === 'cashapp-email' && (alert.cashAppType!=='P2P'||row.emailReceiptId===alert.receiptId));
        if (alert.status === 'pending') result.pending++;
        else {
          const candidates = semanticCandidates(state.transactions, alert);
          const possibleDuplicates = possibleCashAppDuplicates(state.transactions,alert);
          const claimed = new Set(db.prepare('SELECT matched_transaction_id FROM email_alerts WHERE receipt_id != ? AND matched_transaction_id IS NOT NULL').all(alert.receiptId).map(row => row.matched_transaction_id));
          if (candidates.length === 1 && candidateClaimIds(state.transactions,candidates[0],alert).every(id=>!claimed.has(id)) && !p2pCompetes(alert,candidates[0],competingAlerts,state.transactions)) {
            matchedId = candidates[0].id; saved.matchMethod = cashAppMatchMethod(state.transactions,candidates[0],alert); result.matched++;
            if(alert.cashAppType==='P2P'){saved.needsReview=true;result.review++;}
            // Preserve CSV as authority; a previously unmatched email copy can
            // be reconciled when this same receipt is delivered again later.
            if (existing) {state.transactions = state.transactions.filter(row => row !== existing);result.updated++;}
          } else if (candidates.length || possibleDuplicates.length) {
            saved.needsReview = true; saved.matchMethod = 'ambiguous_history'; matchedId = null; result.review++;
          } else {
            const transaction = {id:key,key,date:alert.date,description:alert.merchant,amount:alert.amount,category:existing?.category || alert.category,source:'cashapp-email',emailReceiptId:alert.receiptId,needsReview:true,dateBasis:'email_received'};
            if(alert.cashAppType==='P2P')Object.assign(transaction,{cashAppType:'P2P',paymentKind:'p2p',recipient:alert.recipient,note:alert.note,receivedAt:alert.receivedAt,receivedTime:alert.receivedTime});
            saved.needsReview = true; saved.matchMethod = 'email_only'; matchedId = key; result.review++;
            if (existing) {
              if (JSON.stringify(existing) !== JSON.stringify(transaction)) {Object.assign(existing,transaction);result.updated++;}
              else result.duplicates++;
            } else {state.transactions.push(transaction);result.added++;}
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
  const saved=store.db.prepare('SELECT value FROM metadata WHERE key=?').get('email_import_status');
  const data=hasSchema(store.db)?store.db.prepare('SELECT data FROM email_alerts').all().map(row=>JSON.parse(row.data)):[];
  const collection=emailMetadata(store,'email_collection_status');
  const plan=store.getState().plan;
  return {configured:!!collection,transport:'prefetched-gmail-json',collection,lastMailboxCheck:collection?.lastMailboxCheck||null,lastImport:saved?JSON.parse(saved.value).lastImport:null,total:data.length,pending:data.filter(row=>row.status==='pending').length,completed:data.filter(row=>row.status==='completed').length,reported:data.filter(row=>row.status==='reported').length,review:data.filter(row=>row.needsReview).length,lastResult:saved?JSON.parse(saved.value):null,request:readEmailCheckRequest(store),planBalance:{snapshotDate:plan.startDate,accountDates:[...new Set((plan.accounts||[]).map(account=>account.balanceAsOf||plan.startDate))],verifiedByReceipts:false}};
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
  let reconciled = 0, metadataMatches = 0, review = 0;
  if (!hasSchema(store.db)) return {transactions,reconciled,metadataMatches,review};
  const records = store.db.prepare('SELECT receipt_id,data,matched_transaction_id FROM email_alerts ORDER BY receipt_id').all();
  if (records.length > 20000) fail('Email alert history exceeds the reconciliation limit.');
  const claims = new Map();
  const competingAlerts=records.map(record=>JSON.parse(record.data));
  for (const record of records) if (record.matched_transaction_id) {
    if (!claims.has(record.matched_transaction_id)) claims.set(record.matched_transaction_id,new Set());
    claims.get(record.matched_transaction_id).add(record.receipt_id);
  }
  for (const record of records) {
    const alert = JSON.parse(record.data);
    if(alert.provider==='fifththird'&&alert.status==='reported'){
      const candidates=semanticCandidates(transactions,alert);
      const unique=candidates.length===1&&[...(claims.get(candidates[0].id)||[])].every(id=>id===record.receipt_id);
      const matchedId=unique?candidates[0].id:null;
      const saved={...alert,needsReview:true,matchMethod:unique?'unique_date_amount_merchant_heuristic':candidates.length?'ambiguous_history':'reported_only'};
      if(record.matched_transaction_id&&claims.has(record.matched_transaction_id))claims.get(record.matched_transaction_id).delete(record.receipt_id);
      if(matchedId){if(!claims.has(matchedId))claims.set(matchedId,new Set());claims.get(matchedId).add(record.receipt_id);}
      if(matchedId!==record.matched_transaction_id&&matchedId)metadataMatches++;
      review++;
      if(JSON.stringify(saved)!==record.data||matchedId!==record.matched_transaction_id)store.db.prepare('UPDATE email_alerts SET data=?,matched_transaction_id=? WHERE receipt_id=?').run(JSON.stringify(saved),matchedId,record.receipt_id);
      continue;
    }
    if (alert.status !== 'completed') continue;
    const candidates = semanticCandidates(transactions,alert);
    const available = candidates.length === 1 && candidateClaimIds(transactions,candidates[0],alert).every(id=>[...(claims.get(id)||[])].every(owner=>owner===record.receipt_id)) && !p2pCompetes(alert,candidates[0],competingAlerts,transactions);
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
      saved = {...alert,needsReview:alert.cashAppType==='P2P',matchMethod:cashAppMatchMethod(transactions,candidates[0],alert)};
      if(alert.cashAppType==='P2P')review++;
    } else if (candidates.length||(alert.cashAppType==='P2P'&&possibleCashAppDuplicates(transactions,alert).length)) {
      saved = {...alert,needsReview:true,matchMethod:'ambiguous_history'};review++;
    }
    if (JSON.stringify(saved)!==record.data || matchedId!==record.matched_transaction_id) store.db.prepare('UPDATE email_alerts SET data=?,matched_transaction_id=? WHERE receipt_id=?').run(JSON.stringify(saved),matchedId,record.receipt_id);
  }
  return {transactions,reconciled,metadataMatches,review};
}

function emailMetadata(store,key){
  const record=store.db.prepare('SELECT value FROM metadata WHERE key=?').get(key);
  if(!record)return null;
  try{return JSON.parse(record.value)}catch{return null}
}
function checkedEmailTime(value){
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT/.test(value)||!Number.isFinite(Date.parse(value)))fail('Email check needs a valid ISO timestamp.');
  const normalized=new Date(value).toISOString();
  if(normalized<'2000'||normalized>'2200')fail('Email check timestamp is outside the supported range.');
  return normalized;
}
/** Collection metadata only. Native messages still go through the strict importer. */
export function recordEmailCheck(store,input){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Email check status must be an object.');
  const allowed=new Set(['state','checkedAt','error','processed','added','updated','held']);
  if(Object.keys(input).some(key=>!allowed.has(key)))fail('Email check metadata may contain only status, time, error and counts.');
  if(!['running','success','error'].includes(input.state))fail('Email check state must be running, success or error.');
  const checkedAt=checkedEmailTime(input.checkedAt),counts={};
  for(const key of ['processed','added','updated','held']){
    const value=input[key]??0;
    if(!Number.isSafeInteger(value)||value<0||value>1000000)fail('Email check counts must be nonnegative whole numbers up to 1,000,000.');
    counts[key]=value;
  }
  if(input.error!==undefined&&(input.state!=='error'||typeof input.error!=='string'||!input.error.trim()||input.error.length>400||/[\r\n<>]/.test(input.error)))fail('Use a short plain-text error only for a failed email check.');
  const db=store.db;db.exec('BEGIN IMMEDIATE');
  try{
    const previous=emailMetadata(store,'email_collection_status');
    if(previous?.lastAttempt&&checkedAt<previous.lastAttempt)throw new InputError('A newer email check is already recorded.',409);
    const collection={state:input.state,lastAttempt:checkedAt,lastMailboxCheck:input.state==='running'?previous?.lastMailboxCheck||null:checkedAt,lastSuccess:input.state==='success'?checkedAt:previous?.lastSuccess||null,lastError:input.state==='error'?(input.error?.trim()||'The mailbox check could not finish.'):null,lastResult:input.state==='running'?previous?.lastResult||null:counts};
    db.prepare('INSERT INTO metadata(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('email_collection_status',JSON.stringify(collection));
    const request=emailMetadata(store,'email_check_request');
    if(request&&checkedAt>=request.requestedAt&&['pending','running'].includes(request.state)){
      request.state=input.state==='success'?'completed':input.state==='error'?'error':'running';request.updatedAt=checkedAt;
      db.prepare('UPDATE metadata SET value=? WHERE key=?').run(JSON.stringify(request),'email_check_request');
    }
    db.exec('COMMIT');return collection;
  }catch(error){db.exec('ROLLBACK');throw error}
}
export function requestEmailCheck(store,{now=new Date().toISOString()}={}){
  if(!emailMetadata(store,'email_collection_status'))throw new InputError('Connect a separate email checker before requesting a mailbox check. This app does not contain a Gmail reader.',503);
  const requestedAt=checkedEmailTime(now),db=store.db;db.exec('BEGIN IMMEDIATE');
  try{
    const current=emailMetadata(store,'email_check_request');
    if(current&&['pending','running'].includes(current.state)){db.exec('COMMIT');return current;}
    const request={state:'pending',requestedAt,updatedAt:requestedAt};
    db.prepare('INSERT INTO metadata(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('email_check_request',JSON.stringify(request));
    db.exec('COMMIT');return request;
  }catch(error){db.exec('ROLLBACK');throw error}
}
export function readEmailCheckRequest(store){return emailMetadata(store,'email_check_request');}
