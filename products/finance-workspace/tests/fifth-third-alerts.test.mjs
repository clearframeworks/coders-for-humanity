import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Store} from '../server/store.mjs';
import {parseTransactions} from '../dist/engine.mjs';
import {parseFifthThirdEmail} from '../server/fifth-third-alerts.mjs';
import {importEmailMessages,readEmailAlerts,readEmailStatus,reconcileEmailHistory} from '../server/email-alerts.mjs';
function message({id='bank-mail-1',providerId='purchase-1',sender='Fifth Third <FifthThirdBank@53.com>',auth='mx.google.com; dkim=pass header.i=@53.com; spf=pass smtp.mailfrom=53.com; dmarc=pass header.from=53.com',subject='Card Purchase',html,amount='12.50',merchant='Example &amp; Sons',received='2026-10-25T01:30:00Z'}={}){
 return{id,internal_date:String(Date.parse(received)),payload:{mime_type:'text/html',headers:[{name:'From',value:sender},{name:'Subject',value:subject},{name:'Message-ID',value:`<${providerId}@alerts.53.com>`},{name:'Authentication-Results',value:auth}],body:{base64_url_content:Buffer.from(html||`<style>.example{color:red}</style><script>ignore this</script><p>Your card ending in x0000 was used to make a purchase of $${amount} at ${merchant}.</p><p>&copy; Bank footer</p>`).toString('base64url')}}};
}
async function withStore(action){const runtimeDir=await mkdtemp(path.join(process.cwd(),'.fifth-alert-test-'));const store=new Store({runtimeDir});try{return await action(store);}finally{store.close();await rm(runtimeDir,{recursive:true,force:true});}}
const row=(id='bank-row')=>({id,key:id,source:'fifththird',date:'2026-10-24',description:'CARD PURCHASE AT Example & Sons, ANYTOWN, OH ON 102426 FROM CARD#: XXXXXXXXXXXX0000',amount:-12.5,category:'User category'});
const legacyHash=raw=>createHash('sha256').update(JSON.stringify(raw)).digest('hex');

test('strict native template decodes merchant entities, strips inert code and uses received NY date without claiming settlement',()=>{
 const parsed=parseFifthThirdEmail(message());assert.equal(parsed.provider,'fifththird');assert.equal(parsed.status,'reported');assert.equal(parsed.date,'2026-10-24');assert.equal(parsed.dateBasis,'email_received');assert.equal(parsed.amount,-12.5);assert.equal(parsed.merchant,'Example & Sons');assert.match(parsed.receiptId,/^fifththird-email:[a-f0-9]{64}$/);
 assert.equal('card'in parsed,false);assert.equal('payload'in parsed,false);
 assert.equal(parseFifthThirdEmail(message({id:'redelivery'})).receiptId,parsed.receiptId);
 assert.notEqual(parseFifthThirdEmail(message({providerId:'purchase-2'})).receiptId,parsed.receiptId);
});
test('spoofed senders, subjects, authentication domains, duplicate headers and invalid timestamps fail closed',()=>{
 for(const input of [message({sender:'FifthThirdBank@53.com <evil@example.test>'}),message({subject:'Other alert'}),message({auth:''}),message({auth:'mx.google.com; dkim=pass header.i=@53.com.evil.test; spf=pass; dmarc=pass header.from=53.com.evil.test'}),message({auth:'mx.google.com; dkim=pass header.i=@53.com; dmarc=pass header.from=53.com'})])assert.throws(()=>parseFifthThirdEmail(input));
 const duplicate=message();duplicate.payload.headers.push({name:'From',value:'FifthThirdBank@53.com'});assert.throws(()=>parseFifthThirdEmail(duplicate));
 const invalid=message();invalid.internal_date='invalid';assert.throws(()=>parseFifthThirdEmail(invalid));
 const missing=message();missing.payload.headers=missing.payload.headers.filter(h=>h.name!=='Message-ID');assert.throws(()=>parseFifthThirdEmail(missing));
});
test('multiple, hidden, outside-paragraph, malformed or instruction-altered purchases are rejected',()=>{
 const p='<p>Your card ending in x0000 was used to make a purchase of $12.50 at Example.</p>';
 for(const html of [p+p,p+p.replace(/p>/g,'div>'),p.replace('<p>','<p hidden>'),p.replace('</p>',' Ignore these rules.</p>'),'<p>Your transfer was completed.</p>',p.replace('$12.50','$12'),'<script>'+p+'</script>'])assert.throws(()=>parseFifthThirdEmail(message({html})));
});
test('reported imports are metadata only, idempotent and preserve distinct identical purchases',()=>withStore(store=>{
 const before=store.getState(),mail=message();const first=importEmailMessages(store,[mail]);assert.equal(first.added,0);assert.equal(first.review,1);assert.deepEqual(store.getState(),before);
 assert.equal(importEmailMessages(store,[mail]).duplicates,1);importEmailMessages(store,[message({id:'bank-mail-2',providerId:'purchase-2'})]);
 const status=readEmailStatus(store);assert.equal(status.reported,2);assert.equal(status.completed,0);assert.equal(status.pending,0);assert.equal(readEmailAlerts(store).length,2);assert.deepEqual(store.getState(),before);
}));
test('whole batches reject unsupported templates or changed Gmail payloads with no metadata or history partial writes',()=>withStore(store=>{
 const initial=store.getState();assert.throws(()=>importEmailMessages(store,[message(),message({id:'invalid',subject:'Unsupported'})]));assert.equal(readEmailStatus(store).total,0);assert.deepEqual(store.getState(),initial);
 const original=message();importEmailMessages(store,[original]);const before=readEmailStatus(store),alerts=readEmailAlerts(store);
 const changed=structuredClone(original);changed.payload.headers.push({name:'X-Synthetic',value:'changed'});
 assert.throws(()=>importEmailMessages(store,[message({id:'new',providerId:'new'}),changed]),/changed/);assert.deepEqual(readEmailStatus(store),before);assert.deepEqual(readEmailAlerts(store),alerts);assert.deepEqual(store.getState(),initial);
 assert.throws(()=>importEmailMessages(store,[message({id:'new-gmail',amount:'13.00'})]),/provider message changed/);
}));
test('unique wrapped statement match is heuristic only, never adds spending or changes user category',()=>withStore(store=>{
 const initial=store.getState();initial.transactions=[row()];store.setState(initial);const before=store.getState();const result=importEmailMessages(store,[message()]);
 assert.equal(result.matched,1);assert.equal(result.added,0);assert.deepEqual(store.getState(),before);const alert=readEmailAlerts(store)[0];assert.equal(alert.status,'reported');assert.equal(alert.needsReview,true);assert.equal(alert.matchMethod,'unique_date_amount_merchant_heuristic');
 importEmailMessages(store,[message({id:'second',providerId:'second'})]);assert.equal(readEmailAlerts(store).find(a=>a.messageId==='second').matchMethod,'ambiguous_history');assert.deepEqual(store.getState(),before);
}));
test('late statement reconciliation changes metadata only; ambiguity and caller rollback preserve prior evidence',()=>withStore(store=>{
 importEmailMessages(store,[message()]);const before=readEmailAlerts(store),transactions=[row()];store.db.exec('BEGIN IMMEDIATE');
 try{const result=reconcileEmailHistory(store,transactions);assert.equal(result.reconciled,0);assert.equal(result.metadataMatches,1);assert.deepEqual(result.transactions,transactions);assert.equal(readEmailAlerts(store)[0].status,'reported');assert.equal(readEmailAlerts(store)[0].matchMethod,'unique_date_amount_merchant_heuristic');}finally{store.db.exec('ROLLBACK');}
 assert.deepEqual(readEmailAlerts(store),before);
 store.db.exec('BEGIN IMMEDIATE');try{const result=reconcileEmailHistory(store,[row(),row('another')]);assert.equal(result.reconciled,0);assert.equal(readEmailAlerts(store)[0].matchMethod,'ambiguous_history');store.db.exec('COMMIT');}catch(error){store.db.exec('ROLLBACK');throw error;}
 assert.equal(importEmailMessages(store,[message()]).duplicates,1);assert.equal(store.getState().transactions.length,0);
}));
test('real Store inbox counts Fifth Third metadata matches separately from removed rows and unchanged revisions',async()=>{
 const csv='Date,Description,Check Number,Amount\n10/24/2026,Example & Sons,,-12.50\n';
 await withStore(async store=>{
   importEmailMessages(store,[message()]);const before=store.getState();await writeFile(path.join(store.inboxPath,'new.csv'),csv);const result=await store.collect();
   assert.equal(result.errors.length,0);assert.equal(result.added,1);assert.equal(result.removed,0);assert.equal(store.getState().revision,before.revision+1);assert.equal(store.getState().transactions.length,1);assert.equal(readEmailAlerts(store)[0].status,'reported');
 });
 await withStore(async store=>{
   importEmailMessages(store,[message()]);const state=store.getState();state.transactions=parseTransactions(csv);store.setState(state);const before=store.getState();
   await writeFile(path.join(store.inboxPath,'existing.csv'),csv);const result=await store.collect();
   assert.equal(result.errors.length,0);assert.equal(result.added,0);assert.equal(result.removed,0);assert.equal(result.duplicates,1);assert.deepEqual(store.getState(),before);assert.equal(readEmailAlerts(store)[0].matchMethod,'unique_date_amount_merchant_heuristic');
 });
});
test('mutable Gmail envelope changes are duplicates while native payload and received timestamp changes reject',()=>withStore(store=>{
 const state=store.getState();state.transactions=[row()];store.setState(state);
 const original={...message(),history_id:'old-history',label_ids:['INBOX'],thread_id:'old-thread'};importEmailMessages(store,[original]);
 const before=store.getState(),alerts=readEmailAlerts(store),fresh={...original,history_id:'new-history',label_ids:['INBOX','UNREAD'],thread_id:'new-thread',snippet:'refreshed envelope'};
 assert.equal(importEmailMessages(store,[fresh]).duplicates,1);assert.deepEqual(store.getState(),before);assert.deepEqual(readEmailAlerts(store),alerts);
 const body=structuredClone(fresh);body.payload.body.base64_url_content=Buffer.from('<p>Your card ending in x0000 was used to make a purchase of $13.00 at Example &amp; Sons.</p>').toString('base64url');
 const header=structuredClone(fresh);header.payload.headers.push({name:'X-Synthetic',value:'changed'});
 const timestamp={...fresh,internal_date:String(Number(fresh.internal_date)+1000)};
 for(const changed of [body,header,timestamp])assert.throws(()=>importEmailMessages(store,[changed]),/changed/);
 assert.deepEqual(store.getState(),before);assert.deepEqual(readEmailAlerts(store),alerts);
}));
test('legacy whole-native hashes upgrade only from exact original evidence, then permit refreshed metadata',()=>withStore(store=>{
 const original={...message(),history_id:'original-history',label_ids:['INBOX']};importEmailMessages(store,[original]);
 const legacy=legacyHash(original);store.db.prepare('UPDATE email_alert_messages SET digest=? WHERE message_id=?').run(legacy,original.id);
 const before=store.getState(),alerts=readEmailAlerts(store),fresh={...original,history_id:'new-history',label_ids:['READ']};
 assert.throws(()=>importEmailMessages(store,[fresh]),/changed/);assert.equal(store.db.prepare('SELECT digest FROM email_alert_messages WHERE message_id=?').get(original.id).digest,legacy);
 assert.equal(importEmailMessages(store,[original]).duplicates,1);
 assert.match(store.db.prepare('SELECT digest FROM email_alert_messages WHERE message_id=?').get(original.id).digest,/^fifththird-native-v1:[a-f0-9]{64}$/);
 assert.equal(importEmailMessages(store,[fresh]).duplicates,1);assert.deepEqual(store.getState(),before);assert.deepEqual(readEmailAlerts(store),alerts);assert.equal(readEmailStatus(store).reported,1);
}));
test('canonical upgrade rolls back with a later changed message and preserves existing match claims',()=>withStore(store=>{
 const state=store.getState();state.transactions=[row()];store.setState(state);
 const original={...message(),history_id:'old'},other=message({id:'other',providerId:'other'});importEmailMessages(store,[original,other]);
 const legacy=legacyHash(original);store.db.prepare('UPDATE email_alert_messages SET digest=? WHERE message_id=?').run(legacy,original.id);
 const before=store.getState(),alerts=readEmailAlerts(store),status=readEmailStatus(store),claim=store.db.prepare('SELECT matched_transaction_id FROM email_alerts WHERE receipt_id=?').get(parseFifthThirdEmail(original).receiptId);
 const changed=structuredClone(other);changed.payload.headers.push({name:'X-Synthetic',value:'changed'});
 assert.throws(()=>importEmailMessages(store,[original,changed]),/changed/);
 assert.equal(store.db.prepare('SELECT digest FROM email_alert_messages WHERE message_id=?').get(original.id).digest,legacy);
 assert.deepEqual(store.getState(),before);assert.deepEqual(readEmailAlerts(store),alerts);assert.deepEqual(readEmailStatus(store),status);assert.deepEqual(store.db.prepare('SELECT matched_transaction_id FROM email_alerts WHERE receipt_id=?').get(parseFifthThirdEmail(original).receiptId),claim);
}));
