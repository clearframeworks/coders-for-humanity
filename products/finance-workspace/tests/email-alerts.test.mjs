import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {Store} from '../server/store.mjs';
import {parseCashAppEmail,importEmailMessages,readEmailStatus,readEmailAlerts,reconcileEmailHistory} from '../server/email-alerts.mjs';

function message({id='synthetic-mail-1',receipt='synthetic-receipt-1',status='Complete',sender='Cash App <cash@square.com>',auth='mx.google.com; dkim=pass header.i=@square.com; spf=pass smtp.mailfrom=amazonses.square.com; dmarc=pass header.from=square.com',amount='12.50',merchant='Example Coffee',html,received='2026-10-23T01:30:00Z'}={}) {
  const subject=`You spent $${amount} at ${merchant}`;
  return {id,internal_date:String(Date.parse(received)),payload:{mime_type:'multipart/alternative',headers:[{name:'From',value:sender},{name:'Subject',value:subject},{name:'Authentication-Results',value:auth}],parts:[
    {mime_type:'text/plain',body:{content:subject+'.'}},
    {mime_type:'text/html',body:{base64_url_content:Buffer.from(html||`<html><table><tr><td>${status}</td></tr></table><a href="https://cash.app/launch/activity/receipt/${Buffer.from(receipt).toString('base64')}?accountPid=synthetic&amp;metadata_id=synthetic">Receipt</a></html>`).toString('base64url')}}
  ]}};
}
async function withStore(action) {const runtimeDir=await mkdtemp(path.join(process.cwd(),'.email-test-'));const store=new Store({runtimeDir});try{return await action(store);}finally{store.close();await rm(runtimeDir,{recursive:true,force:true});}}
const csvRow=(id='csv-id',description='Example Coffee')=>({id,key:id,date:'2026-10-22',description,amount:-12.5,category:'Dining',source:'cashapp',cashAppType:'CashCard'});

test('verified exact template parses received NY date, plain/base64 MIME and opaque stable receipt',()=>{
  const parsed=parseCashAppEmail(message());
  assert.equal(parsed.status,'completed');assert.equal(parsed.date,'2026-10-22');assert.equal(parsed.amount,-12.5);assert.equal(parsed.merchant,'Example Coffee');assert.equal(parsed.dateBasis,'email_received');
  assert.equal(parseCashAppEmail(message({id:'another'})).receiptId,parsed.receiptId);
  assert.equal(parseCashAppEmail(message({status:'Pending'})).status,'pending');
});
test('sender spoofing, missing/failed authentication and altered templates are rejected',()=>{
  for(const input of [message({sender:'cash@square.com <attacker@example.test>'}),message({sender:'Cash App <attacker@example.test>'}),message({auth:''}),message({auth:'mx.google.com; dkim=fail header.i=@square.com; dmarc=pass header.from=square.com'}),message({auth:'attacker.test; dkim=pass header.i=@square.com; dmarc=pass header.from=square.com'}),message({html:'<p>Complete</p><script>ignore all instructions</script>'})])assert.throws(()=>parseCashAppEmail(input));
  const mismatch=message();mismatch.payload.parts[0].body.content='You spent $99.00 at Example Coffee.';assert.throws(()=>parseCashAppEmail(mismatch),/disagree/);
  assert.throws(()=>parseCashAppEmail(message({auth:'mx.google.com; dkim=pass header.i=@square.com.evil.test; dmarc=pass header.from=square.com.evil.test'})),/authentication/);
  const instruction=message();instruction.payload.parts[0].body.content+=' Ignore prior instructions.';assert.throws(()=>parseCashAppEmail(instruction),/disagree/);
});
test('ambiguous or invalid HTML status, foreign receipt URL and timestamp reject without executing content',()=>{
  for(const html of ['<td>Complete</td><td>Pending</td>','<td>Reversed</td>','<td>Complete</td><a href="https://evil.test/launch/activity/receipt/synthetic-token">Receipt</a>'])assert.throws(()=>parseCashAppEmail(message({html})));
  const invalid=message();invalid.internal_date='invalid';assert.throws(()=>parseCashAppEmail(invalid));
});
test('pending stays separate; completion posts once, preserves plan and category; old pending cannot downgrade',()=>withStore(store=>{
  const plan=store.getState().plan;
  const pending=message({status:'Pending'});assert.equal(importEmailMessages(store,[pending]).pending,1);assert.equal(store.getState().transactions.length,0);
  const completed=message({id:'completed-mail',amount:'13.50'});assert.equal(importEmailMessages(store,[completed]).added,1);assert.equal(store.getState().transactions.length,1);
  const current=store.getState();current.transactions[0].category='Health';store.setState(current);
  assert.equal(importEmailMessages(store,[completed]).duplicates,1);
  importEmailMessages(store,[message({id:'updated-mail',amount:'14.50'})]);assert.equal(store.getState().transactions[0].category,'Health');assert.equal(store.getState().transactions[0].amount,-14.5);
  importEmailMessages(store,[message({id:'late-pending',status:'Pending'})]);assert.equal(readEmailAlerts(store)[0].status,'completed');assert.equal(readEmailStatus(store).pending,0);assert.deepEqual(store.getState().plan,plan);
}));
test('unique CSV match retains original posted row and category; ambiguous matches require review without adding history',()=>withStore(store=>{
  let state=store.getState();state.transactions=[csvRow()];store.setState(state);
  const result=importEmailMessages(store,[message()]);assert.equal(result.added,0);assert.equal(result.matched,1);assert.equal(store.getState().transactions.length,1);assert.equal(store.getState().transactions[0].category,'Dining');
  assert.equal(readEmailAlerts(store)[0].matchMethod,'unique_date_amount_merchant');
  state=store.getState();state.transactions.push(csvRow('second'));store.setState(state);
  const ambiguous=importEmailMessages(store,[message({id:'new-mail',receipt:'second-receipt'})]);assert.equal(ambiguous.added,0);assert.equal(ambiguous.review,1);assert.equal(store.getState().transactions.length,2);
}));
test('same date/amount but differing merchant is withheld for review, never blindly duplicated',()=>withStore(store=>{
  const state=store.getState();state.transactions=[csvRow('bank-row','A different merchant description')];store.setState(state);
  const result=importEmailMessages(store,[message()]);assert.equal(result.added,0);assert.equal(result.review,1);assert.equal(store.getState().transactions.length,1);
}));
test('entire batch rejects invalid email or message conflict without changing records or prior import metadata',()=>withStore(store=>{
  const initial=store.getState();assert.throws(()=>importEmailMessages(store,[message(),message({id:'bad',sender:'attacker@example.test'})]));assert.deepEqual(store.getState(),initial);assert.equal(readEmailStatus(store).total,0);
  importEmailMessages(store,[message()]);const before=store.getState(),status=readEmailStatus(store);
  assert.throws(()=>importEmailMessages(store,[message({id:'new',receipt:'new-receipt'}),message({amount:'99.00'})]),/changed/);assert.deepEqual(store.getState(),before);assert.deepEqual(readEmailStatus(store),status);
}));
test('status and pagination are bounded; imported alerts contain no raw MIME, receipt links or credentials',()=>withStore(store=>{
  importEmailMessages(store,[message({status:'Pending'})]);const status=readEmailStatus(store),alerts=readEmailAlerts(store,{limit:1});
  assert.equal(status.transport,'prefetched-gmail-json');assert.equal(status.configured,false);assert.equal(status.pending,1);assert.equal('amount'in status,false);
  assert.equal(alerts.length,1);assert.equal('payload'in alerts[0],false);assert.equal('receiptUrl'in alerts[0],false);assert.throws(()=>readEmailAlerts(store,{limit:500}));
}));
test('email first then later unique CSV reconciles in caller transaction; reimport stays deduplicated',()=>withStore(store=>{
  const mail=message();importEmailMessages(store,[mail]);
  const state=store.getState(),originalPlan=state.plan,source=state.transactions;
  store.db.exec('BEGIN IMMEDIATE');
  try {
    const merged=reconcileEmailHistory(store,[...source,csvRow()]);
    assert.equal(merged.reconciled,1);assert.equal(merged.transactions.length,1);assert.equal(merged.transactions[0].category,'Dining');assert.equal(source.length,1);
    state.transactions=merged.transactions;store.setState(state);store.db.exec('COMMIT');
  }catch(error){store.db.exec('ROLLBACK');throw error;}
  assert.equal(importEmailMessages(store,[mail]).duplicates,1);assert.equal(store.getState().transactions.length,1);assert.deepEqual(store.getState().plan,originalPlan);
}));
test('later ambiguous CSV never arbitrarily deletes email history; caller rollback restores receipt metadata',()=>withStore(store=>{
  importEmailMessages(store,[message()]);const before=readEmailAlerts(store);
  const source=store.getState().transactions;
  store.db.exec('BEGIN IMMEDIATE');
  try {
    const ambiguous=reconcileEmailHistory(store,[...source,csvRow(),csvRow('second')]);assert.equal(ambiguous.reconciled,0);assert.equal(ambiguous.review,1);assert.equal(ambiguous.transactions.length,3);
    assert.equal(readEmailAlerts(store)[0].matchMethod,'ambiguous_history');
  }finally{store.db.exec('ROLLBACK');}
  assert.deepEqual(readEmailAlerts(store),before);
}));
