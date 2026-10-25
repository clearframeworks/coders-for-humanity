import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {startServer} from '../server/index.mjs';
import {Store} from '../server/store.mjs';
import {importEmailMessages,readEmailAlerts,readEmailStatus} from '../server/email-alerts.mjs';

function email({id='integration-mail',receipt='integration-receipt',status='Complete'}={}) {
  const text='You spent $12.50 at Example Coffee';
  return {id,internal_date:String(Date.parse('2026-10-23T01:30:00Z')),payload:{mime_type:'multipart/alternative',headers:[
    {name:'From',value:'Cash App <cash@square.com>'},
    {name:'Subject',value:text},
    {name:'Authentication-Results',value:'mx.google.com; dkim=pass header.i=@square.com; spf=pass smtp.mailfrom=amazonses.square.com; dmarc=pass header.from=square.com'}
  ],parts:[{mime_type:'text/plain',body:{content:text+'.'}},{mime_type:'text/html',body:{content:`<td>${status}</td><a href="https://cash.app/launch/activity/receipt/${Buffer.from(receipt).toString('base64')}">Receipt</a>`}}]}};
}
const nativeRow=()=>({id:'cashapp:integration-csv',key:'cashapp:integration-csv',date:'2026-10-22',description:'Example Coffee',amount:-12.5,category:'Transport',sourceCategory:'Dining',source:'cashapp',cashAppType:'CashCard',cashAppTransactionId:'integration-csv'});
const request=(base,method='GET',body,headers={})=>fetch(base,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
async function serviceFixture(t) {
  const runtimeDir=await mkdtemp(path.join(process.cwd(),'.email-http-test-'));
  const service=await startServer({port:0,runtimeDir,autoCollect:false,autoBankSync:false});
  t.after(async()=>{await service.close();await rm(runtimeDir,{recursive:true,force:true});});
  return service;
}

test('actual HTTP PUT reconciles late CSV with email history, preserving plan and CSV category',async t=>{
  const service=await serviceFixture(t);
  importEmailMessages(service.store,[email()]);
  const state=await (await request(service.url+'/api/state')).json(),originalPlan=structuredClone(state.plan);
  state.transactions[0].category='Health';state.transactions.push(nativeRow());
  const response=await request(service.url+'/api/state','PUT',state);
  assert.equal(response.status,200);
  const saved=await response.json();assert.equal(saved.transactions.length,1);assert.equal(saved.transactions[0].source,'cashapp');assert.equal(saved.transactions[0].category,'Transport');assert.deepEqual(saved.plan,originalPlan);
  assert.equal(readEmailAlerts(service.store)[0].matchMethod,'unique_date_amount_merchant');
  assert.equal(importEmailMessages(service.store,[email()]).duplicates,1);
  const current=await (await request(service.url+'/api/state')).json();assert.equal(current.transactions.length,1);
});

test('actual stale HTTP PUT rolls back reconciliation metadata and leaves the newer state intact',async t=>{
  const service=await serviceFixture(t);
  importEmailMessages(service.store,[email()]);
  const stale=await (await request(service.url+'/api/state')).json();stale.transactions.push(nativeRow());
  const changed=service.store.getState();changed.plan.cushion=25;service.store.setState(changed);
  const before=service.store.getState(),beforeAlerts=readEmailAlerts(service.store),beforeStatus=readEmailStatus(service.store);
  assert.equal((await request(service.url+'/api/state','PUT',stale)).status,409);
  assert.deepEqual(service.store.getState(),before);assert.deepEqual(readEmailAlerts(service.store),beforeAlerts);assert.deepEqual(readEmailStatus(service.store),beforeStatus);
  assert.equal(readEmailAlerts(service.store)[0].matchMethod,'email_only');
});

test('actual automation API exposes only selected alert fields and rejects a foreign origin',async t=>{
  const service=await serviceFixture(t);
  importEmailMessages(service.store,[email(),email({id:'integration-pending',receipt:'pending-receipt',status:'Pending'})]);
  const response=await request(service.url+'/api/automation');assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.email.pending,1);assert.equal(data.email.alerts.length,2);
  for(const alert of data.email.alerts)assert.deepEqual(Object.keys(alert).sort(),['amount','date','dateBasis','matchMethod','merchant','needsReview','status'].sort());
  const serialized=JSON.stringify(data.email);
  for(const excluded of ['integration-mail','integration-pending','receiptId','messageId','payload','Authentication-Results','cash.app/launch'])assert.equal(serialized.includes(excluded),false);
  const unauthorized=await request(service.url+'/api/automation','GET',undefined,{Origin:'https://foreign.example'});assert.equal(unauthorized.status,403);
});

test('real Store inbox late native CSV removes only reconciled email copy and archives exactly once',async t=>{
  const runtimeDir=await mkdtemp(path.join(process.cwd(),'.email-inbox-test-')),store=new Store({runtimeDir});
  t.after(async()=>{store.close();await rm(runtimeDir,{recursive:true,force:true});});
  const original=store.getState();original.transactions.push({id:'unrelated',key:'unrelated',date:'2026-10-20',description:'Existing grocery',amount:-2,category:'Groceries'});store.setState(original);
  importEmailMessages(store,[email()]);const plan=store.getState().plan;
  const csv='Date,Transaction ID,Transaction Type,Currency,Amount,Fee,Net Amount,Asset Type,Asset Price,Asset Amount,Status,Notes,Name of sender/receiver,Account\n2026-10-22 21:30:00 EDT,integration-csv,Cash Card,USD,-$12.50,,-$12.50,,,,COMPLETE,Example Coffee,Synthetic Shop,Cash';
  await writeFile(path.join(store.inboxPath,'native.csv'),csv);
  const result=await store.collect();assert.equal(result.errors.length,0);assert.equal(result.added,1);assert.equal(result.removed,1);
  const saved=store.getState();assert.equal(saved.transactions.length,2);assert.equal(saved.transactions.filter(row=>row.source==='cashapp-email').length,0);assert.equal(saved.transactions[0].id,'unrelated');assert.deepEqual(saved.plan,plan);
  assert.equal(readEmailAlerts(store)[0].matchMethod,'unique_date_amount_merchant');assert.equal((await readdir(store.archivePath)).length,1);
  assert.equal(importEmailMessages(store,[email()]).duplicates,1);assert.equal(store.getState().transactions.length,2);
  await writeFile(path.join(store.inboxPath,'native-again.csv'),csv);const repeated=await store.collect();assert.equal(repeated.added,0);assert.equal(repeated.duplicates,1);assert.equal(store.getState().transactions.length,2);
});
