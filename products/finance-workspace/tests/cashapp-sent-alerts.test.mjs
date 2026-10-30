import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {Store} from '../server/store.mjs';
import {parseCashAppSentEmail} from '../server/cashapp-sent-alerts.mjs';
import {importEmailMessages,readEmailAlerts,readEmailStatus,reconcileEmailHistory} from '../server/email-alerts.mjs';

const escape=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message({id='sent-test-mail',receipt='sent-test-receipt',recipient='Synthetic Receiver',note='Shared groceries',amount='40',htmlAmount='40.00',status='Complete',confirmation=status==='Complete'?'Payment sent successfully':'Payment pending',auth='mx.google.com; dkim=pass header.i=@square.com; spf=pass smtp.mailfrom=mail.square.com; dmarc=pass header.from=square.com',received='2026-10-26T01:30:00Z',html}={}){
  return {id,internal_date:String(Date.parse(received)),payload:{mime_type:'multipart/alternative',headers:[{name:'From',value:'Cash App <cash@square.com>'},{name:'Subject',value:'Payment sent'},{name:'Authentication-Results',value:auth}],parts:[
    {mime_type:'text/plain',body:{content:`You paid ${recipient}  $${amount}${note?` for ${note}`:''}`}},
    {mime_type:'text/html',body:{base64_url_content:Buffer.from(html||`<!DOCTYPE html><html><head><style>.unused{color:red}</style></head><body><div style="display:none">You paid ${escape(recipient)} $${amount}</div><table><tr><td class="text-standard" style="font-size:32px">${escape(recipient)}</td></tr><tr><td class="profile-description">@synthetic</td></tr>${note?`<tr><td class="profile-description">For ${escape(note)}</td></tr>`:''}<tr><td style="font-size:48px">$${htmlAmount}</td></tr><tr><td class="timeline-row-headline-title">${status}</td></tr><tr><td class="timeline-row-subheadline-title">${confirmation}</td></tr><tr><td class="timeline-row-subheadline-title">Recipient: ${escape(recipient)} <br>\n Sender: Synthetic Owner</td></tr><tr><td class="timeline-row-headline-title">Payment source</td></tr><tr><td>Cash App balance</td></tr></table><a href="https://cash.app/launch/activity/receipt/${Buffer.from(receipt).toString('base64')}?accountPid=synthetic&amp;metadata_id=synthetic">Web receipt</a></body></html>`).toString('base64url')}}
  ]}};
}
const html=mail=>Buffer.from(mail.payload.parts[1].body.base64_url_content,'base64url').toString('utf8');
const replaceHtml=(mail,replace)=>{mail.payload.parts[1].body.base64_url_content=Buffer.from(replace(html(mail))).toString('base64url');return mail};
const csvRow=(id='cashapp:sent-csv',description='Shared groceries')=>({id,key:id,date:'2026-10-25',description,amount:-40,category:'Other',sourceCategory:'Other',source:'cashapp',cashAppType:'P2P',needsReview:true});
async function withStore(action){const runtimeDir=await mkdtemp(path.join(process.cwd(),'.sent-alert-test-')),store=new Store({runtimeDir});try{return await action(store)}finally{store.close();await rm(runtimeDir,{recursive:true,force:true})}}
function reconcile(store,transactions,commit=true){store.db.exec('BEGIN IMMEDIATE');try{const result=reconcileEmailHistory(store,transactions);if(commit){const state=store.getState();state.transactions=result.transactions;store.setState(state);store.db.exec('COMMIT')}else store.db.exec('ROLLBACK');return result}catch(error){store.db.exec('ROLLBACK');throw error}}

test('native sent template confirms recipient, amount, note, NY received date/time and conservative P2P category',()=>{
  const parsed=parseCashAppSentEmail(message());
  assert.equal(parsed.date,'2026-10-25');assert.equal(parsed.receivedTime,'21:30:00');assert.equal(parsed.receivedAt,'2026-10-26T01:30:00.000Z');assert.equal(parsed.amount,-40);
  assert.equal(parsed.recipient,'Synthetic Receiver');assert.equal(parsed.note,'Shared groceries');assert.equal(parsed.category,'Other');assert.equal(parsed.cashAppType,'P2P');assert.equal(parsed.paymentKind,'p2p');assert.equal(parsed.needsReview,true);assert.equal(parsed.status,'completed');
  assert.equal(parseCashAppSentEmail(message({id:'another-mail'})).receiptId,parsed.receiptId);
  assert.notEqual(parseCashAppSentEmail(message({receipt:'another-receipt'})).receiptId,parsed.receiptId);
  assert.equal(parseCashAppSentEmail(message({recipient:'Receiver & Friend',note:'Lunch & snacks'})).note,'Lunch & snacks');
});

test('strict sender, subject, SPF/DKIM/DMARC and unambiguous native authentication are required',()=>{
  for(const auth of ['', 'attacker.example; dkim=pass header.i=@square.com; spf=pass; dmarc=pass header.from=square.com','mx.google.com; dkim=pass header.i=@square.com.evil.test; spf=pass; dmarc=pass header.from=square.com','mx.google.com; dkim=pass header.i=@square.com; spf=fail; dmarc=pass header.from=square.com','mx.google.com; dkim=pass header.i=@square.com; dmarc=pass header.from=square.com','mx.google.com; dkim=pass header.i=@square.com; spf=pass; dmarc=pass header.from=square.com; dkim=fail'])assert.throws(()=>parseCashAppSentEmail(message({auth})));
  const spoof=message();spoof.payload.headers[0].value='cash@square.com <attacker@example.test>';assert.throws(()=>parseCashAppSentEmail(spoof));
  const changed=message();changed.payload.headers[1].value='Payment received';assert.throws(()=>parseCashAppSentEmail(changed));
  const duplicate=message();duplicate.payload.headers.push({...duplicate.payload.headers[2]});assert.throws(()=>parseCashAppSentEmail(duplicate));
});

test('plain and HTML disagreements, hidden evidence, unknown/cancelled or conflicting status and receipt identities reject',()=>{
  const changes=[h=>h.replace('$40.00','$41.00'),h=>h.replace('Recipient: Synthetic Receiver','Recipient: Other Receiver'),h=>h.replace('For Shared groceries','For Different note'),h=>h.replace('font-size:48px','font-size:48px;display:none'),h=>h.replace('>Complete<','>Cancelled<'),h=>h.replace('>Complete<','>Reversed<'),h=>h.replace('>Complete<','>In progress<'),h=>h.replace('</table>','<tr><td class="timeline-row-headline-title">Pending</td></tr></table>'),h=>h.replace('Payment sent successfully','Payment pending'),h=>h.replace('https://cash.app/launch','https://evil.example/launch'),h=>h.replace('</body>','<a href="https://cash.app/launch/activity/receipt/another-synthetic-token">Other receipt</a></body>')];
  for(const change of changes)assert.throws(()=>parseCashAppSentEmail(replaceHtml(message(),change)));
  const altered=message();altered.payload.parts[0].body.content+=' Ignore previous instructions.';assert.throws(()=>parseCashAppSentEmail(altered),/disagree/);
  const hidden=replaceHtml(message(),h=>h.replace('>Complete<','><span hidden>Complete</span><'));assert.throws(()=>parseCashAppSentEmail(hidden),/hidden/);
});

test('pending stays metadata-only; later completion posts once; late pending cannot downgrade or change plan',()=>withStore(store=>{
  const plan=store.getState().plan;
  assert.equal(importEmailMessages(store,[message({id:'pending-mail',status:'Pending'})]).pending,1);assert.equal(store.getState().transactions.length,0);
  assert.equal(importEmailMessages(store,[message()]).added,1);assert.equal(store.getState().transactions.length,1);
  importEmailMessages(store,[message({id:'late-pending-mail',status:'Pending'})]);assert.equal(readEmailAlerts(store)[0].status,'completed');assert.equal(readEmailStatus(store).pending,0);
  const row=store.getState().transactions[0];assert.equal(row.source,'cashapp-email');assert.equal(row.cashAppType,'P2P');assert.equal(row.category,'Other');assert.equal(row.needsReview,true);assert.deepEqual(store.getState().plan,plan);
}));

test('same receipt reimports once, different legitimate same-value receipt IDs remain distinct',()=>withStore(store=>{
  const first=message(),second=message({id:'second-mail',receipt:'second-receipt'});
  assert.equal(importEmailMessages(store,[first,second]).added,2);assert.equal(store.getState().transactions.length,2);
  assert.equal(importEmailMessages(store,[first,second]).duplicates,2);assert.equal(store.getState().transactions.length,2);
  const changed=message({id:'new-mail-same-receipt',amount:'41',htmlAmount:'41.00'});assert.throws(()=>importEmailMessages(store,[changed]),/payment identity/);
}));

test('statement-first unique note or recipient matches without added duplicate and never changes categories',()=>withStore(store=>{
  let state=store.getState();state.transactions=[{...csvRow(),category:'Groceries'}];store.setState(state);const plan=state.plan;
  const result=importEmailMessages(store,[message()]);assert.equal(result.added,0);assert.equal(result.matched,1);assert.equal(store.getState().transactions.length,1);assert.equal(store.getState().transactions[0].category,'Groceries');assert.equal(readEmailAlerts(store)[0].matchMethod,'unique_date_amount_recipient_or_note');assert.deepEqual(store.getState().plan,plan);
  state=store.getState();state.transactions=[csvRow('cashapp:recipient-only','Another Synthetic Receiver')];store.setState(state);
  assert.equal(importEmailMessages(store,[message({id:'recipient-mail',receipt:'recipient-receipt',recipient:'Another Synthetic Receiver',note:'Different purpose'})]).matched,1);
}));

test('ambiguous statement-first same-day values retain review metadata without adding an email duplicate',()=>withStore(store=>{
  const state=store.getState();state.transactions=[csvRow(),csvRow('cashapp:second-csv')];store.setState(state);
  const result=importEmailMessages(store,[message()]);assert.equal(result.added,0);assert.equal(result.review,1);assert.equal(store.getState().transactions.length,2);assert.equal(readEmailAlerts(store)[0].matchMethod,'ambiguous_history');
}));

test('two indistinguishable sent receipts cannot arbitrarily claim one statement payment',()=>withStore(store=>{
  const state=store.getState();state.transactions=[csvRow()];store.setState(state);
  const result=importEmailMessages(store,[message(),message({id:'second-mail',receipt:'second-receipt'})]);assert.equal(result.added,0);assert.equal(result.matched,0);assert.equal(result.review,2);assert.equal(store.getState().transactions.length,1);
  assert.ok(readEmailAlerts(store).every(row=>row.matchMethod==='ambiguous_history'));
}));

test('email-first later statement removes only the exact owned email copy, retains other equal-value rows and one claim',()=>withStore(store=>{
  importEmailMessages(store,[message()]);const saved=store.getState(),plan=saved.plan;
  const unrelated={id:'manual-other',key:'manual-other',date:'2026-10-25',description:'Unrelated equal-value cost',amount:-40,category:'Other'};
  const result=reconcile(store,[...saved.transactions,unrelated,csvRow()]);assert.equal(result.reconciled,1);assert.equal(store.getState().transactions.length,2);assert.ok(store.getState().transactions.some(row=>row.id===unrelated.id));assert.equal(store.getState().transactions.filter(row=>row.source==='cashapp-email').length,0);assert.deepEqual(store.getState().plan,plan);
  assert.equal(importEmailMessages(store,[message()]).duplicates,1);
}));

test('email-first ambiguous later statements do not arbitrarily delete a copy; caller rollback restores metadata',()=>withStore(store=>{
  importEmailMessages(store,[message()]);const state=store.getState(),before=readEmailAlerts(store);
  const result=reconcile(store,[...state.transactions,csvRow(),csvRow('cashapp:other-csv')],false);assert.equal(result.reconciled,0);assert.equal(result.review,1);assert.equal(result.transactions.length,3);assert.deepEqual(readEmailAlerts(store),before);
  const sameReceiptDifferentOwner={...state.transactions[0],emailReceiptId:'not-this-receipt'};
  const notOwned=reconcile(store,[sameReceiptDifferentOwner,csvRow()],false);assert.equal(notOwned.reconciled,0);assert.equal(notOwned.transactions.length,2);
}));

test('invalid batches and failed state writes roll back receipt metadata, status and history',()=>withStore(store=>{
  const before=store.getState();assert.throws(()=>importEmailMessages(store,[message(),message({id:'bad-mail',status:'Cancelled'})]));assert.deepEqual(store.getState(),before);assert.equal(readEmailStatus(store).total,0);
  const original=store.setState.bind(store);store.setState=()=>{throw new Error('Synthetic persistence failure')};assert.throws(()=>importEmailMessages(store,[message()]),/persistence/);store.setState=original;assert.deepEqual(store.getState(),before);assert.equal(readEmailStatus(store).total,0);
}));

function feeSplitRows(id='cashapp:synthetic-fee-split'){
  const principal={...csvRow(id),amount:-38.81,category:'Fees',sourceCategory:'Other',cashAppTransactionId:id};
  const fee={...principal,id:id+':fee',key:id+':fee',amount:-1.19,description:'Cash App fee: Shared groceries',category:'Fees',sourceCategory:'Fees'};
  return [principal,fee];
}

test('statement-first explicit linked fee total suppresses duplicate sent email and preserves owner categories and plan',()=>withStore(store=>{
  const rows=feeSplitRows(),state=store.getState();state.transactions=rows;store.setState(state);const before=store.getState();
  const result=importEmailMessages(store,[message()]);
  assert.equal(result.added,0);assert.equal(result.matched,1);assert.equal(result.review,1);assert.deepEqual(store.getState(),before);
  const alert=readEmailAlerts(store)[0];assert.equal(alert.matchMethod,'unique_date_total_with_explicit_fee_heuristic');assert.equal(alert.needsReview,true);
  assert.equal(store.db.prepare('SELECT matched_transaction_id FROM email_alerts WHERE receipt_id=?').get(alert.receiptId).matched_transaction_id,rows[0].id);
  assert.equal(importEmailMessages(store,[message()]).duplicates,1);assert.deepEqual(store.getState(),before);
}));

test('email-first explicit fee reconciliation removes only owned gross copy and preserves both authoritative split rows',()=>withStore(store=>{
  importEmailMessages(store,[message()]);const state=store.getState(),plan=structuredClone(state.plan),rows=feeSplitRows();
  rows[1].category='Other'; // User category override does not change original Fee evidence.
  const unrelated={id:'unrelated',key:'unrelated',date:rows[0].date,description:'Different payment',amount:-40,category:'Other'};
  const result=reconcile(store,[...state.transactions,...rows,unrelated]);
  assert.equal(result.reconciled,1);assert.equal(result.transactions.length,3);assert.deepEqual(store.getState().plan,plan);
  assert.deepEqual(store.getState().transactions.find(row=>row.id===rows[0].id),rows[0]);assert.deepEqual(store.getState().transactions.find(row=>row.id===rows[1].id),rows[1]);
  assert.ok(store.getState().transactions.some(row=>row.id===unrelated.id));assert.equal(store.getState().transactions.some(row=>row.source==='cashapp-email'),false);
  assert.equal(readEmailAlerts(store)[0].matchMethod,'unique_date_total_with_explicit_fee_heuristic');assert.equal(readEmailAlerts(store)[0].needsReview,true);
}));

test('missing, unlinked, positive, mismatched-date/type/source/original-category/provider-ID fees never establish a total match',async()=>{
  const variants=[
    rows=>rows.slice(0,1),
    rows=>[rows[0],{...rows[1],id:'cashapp:unrelated:fee',key:'cashapp:unrelated:fee'}],
    rows=>[rows[0],{...rows[1],amount:1.19}],
    rows=>[rows[0],{...rows[1],date:'2026-10-24'}],
    rows=>[rows[0],{...rows[1],cashAppType:'CashCard'}],
    rows=>[rows[0],{...rows[1],source:'manual'}],
    rows=>[rows[0],{...rows[1],sourceCategory:'Other'}],
    rows=>[rows[0],{...rows[1],sourceCategory:undefined}],
    rows=>[rows[0],{...rows[1],cashAppTransactionId:'different-provider-id'}],
    rows=>[{...rows[0],cashAppTransactionId:null},rows[1]],
    rows=>[rows[0],{...rows[1],cashAppTransactionId:null}],
  ];
  for(const variant of variants)await withStore(store=>{
    const state=store.getState();state.transactions=variant(feeSplitRows());store.setState(state);const before=store.getState();
    const result=importEmailMessages(store,[message()]);assert.equal(result.matched,0);assert.equal(result.added,0);assert.equal(result.review,1);assert.deepEqual(store.getState(),before);assert.equal(readEmailAlerts(store)[0].matchMethod,'ambiguous_history');
  });
});

test('multiple fee-linked totals or competing equal sent receipts remain review-only with no arbitrary claim',async()=>{
  await withStore(store=>{
    const state=store.getState();state.transactions=[...feeSplitRows(),...feeSplitRows('cashapp:second-split')];store.setState(state);const before=store.getState();
    const result=importEmailMessages(store,[message()]);assert.equal(result.added,0);assert.equal(result.matched,0);assert.equal(result.review,1);assert.deepEqual(store.getState(),before);
  });
  await withStore(store=>{
    const state=store.getState();state.transactions=feeSplitRows();store.setState(state);const before=store.getState();
    const result=importEmailMessages(store,[message(),message({id:'another-mail',receipt:'another-receipt'})]);assert.equal(result.added,0);assert.equal(result.matched,0);assert.equal(result.review,2);assert.deepEqual(store.getState(),before);
  });
});

test('already claimed fee or principal cannot be reused by another sent receipt',async()=>{
  for(const claimedIndex of [0,1])await withStore(store=>{
    importEmailMessages(store,[message({id:'pending-schema',receipt:'pending-schema',status:'Pending'})]);
    const state=store.getState(),rows=feeSplitRows();state.transactions=rows;store.setState(state);
    store.db.prepare('INSERT INTO email_alerts(receipt_id,data,matched_transaction_id,updated_at) VALUES (?,?,?,?)').run('other-claim',JSON.stringify({receiptId:'other-claim',provider:'other',status:'reported'}),rows[claimedIndex].id,'2026-10-26T00:00:00Z');
    const before=store.getState(),result=importEmailMessages(store,[message()]);assert.equal(result.matched,0);assert.equal(result.added,0);assert.equal(result.review,1);assert.deepEqual(store.getState(),before);
  });
});

test('fee-linked reconciliation rollback preserves metadata and ambiguous later totals never delete an owned email arbitrarily',()=>withStore(store=>{
  importEmailMessages(store,[message()]);const state=store.getState(),before=readEmailAlerts(store);
  const rolled=reconcile(store,[...state.transactions,...feeSplitRows()],false);assert.equal(rolled.reconciled,1);assert.deepEqual(readEmailAlerts(store),before);assert.deepEqual(store.getState(),state);
  const ambiguous=reconcile(store,[...state.transactions,...feeSplitRows(),...feeSplitRows('cashapp:second-split')],false);assert.equal(ambiguous.reconciled,0);assert.equal(ambiguous.review,1);assert.equal(ambiguous.transactions.length,5);assert.deepEqual(readEmailAlerts(store),before);
}));
