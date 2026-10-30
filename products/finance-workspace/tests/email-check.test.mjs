import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import http from 'node:http';
import {Store} from '../server/store.mjs';
import {startServer} from '../server/index.mjs';
import {recordEmailCheck,readEmailStatus,requestEmailCheck,readEmailCheckRequest} from '../server/email-alerts.mjs';

async function fixture(t){
  const runtimeDir=await mkdtemp(path.join(tmpdir(),'finance-mail-check-'));
  const store=new Store({runtimeDir});
  t.after(async()=>{store.close();await rm(runtimeDir,{recursive:true,force:true});});
  return {store,runtimeDir};
}
const time=minute=>`2026-10-29T14:${String(minute).padStart(2,'0')}:00.000Z`;

test('mailbox checks and duplicate-only success are distinct from import time and financial state',async t=>{
  const {store}=await fixture(t),before=store.getState();
  assert.equal(readEmailStatus(store).configured,false);
  recordEmailCheck(store,{state:'running',checkedAt:time(0)});
  assert.equal(readEmailStatus(store).collection.state,'running');
  assert.equal(readEmailStatus(store).lastMailboxCheck,null);
  recordEmailCheck(store,{state:'success',checkedAt:time(1),processed:12,added:0,updated:0,held:2});
  const result=readEmailStatus(store);
  assert.equal(result.configured,true);assert.equal(result.lastMailboxCheck,time(1));assert.equal(result.lastImport,null);
  assert.equal(result.collection.lastResult.added,0);assert.equal(result.collection.lastResult.processed,12);
  assert.equal(result.planBalance.verifiedByReceipts,false);assert.deepEqual(store.getState(),before);
});

test('failed checks preserve successful freshness and reject invalid or stale metadata atomically',async t=>{
  const {store}=await fixture(t);
  recordEmailCheck(store,{state:'success',checkedAt:time(1)});
  recordEmailCheck(store,{state:'error',checkedAt:time(2),error:'The Gmail connection needs attention.'});
  const before=readEmailStatus(store).collection;
  assert.equal(before.lastSuccess,time(1));assert.equal(before.lastMailboxCheck,time(2));
  for(const payload of [
    {state:'success',checkedAt:'not-a-date'},
    {state:'success',checkedAt:time(3),processed:-1},
    {state:'success',checkedAt:time(3),added:1.5},
    {state:'success',checkedAt:time(3),receiptBody:'not allowed'},
    {state:'success',checkedAt:time(3),error:'unexpected'},
    {state:'success',checkedAt:time(0)},
  ])assert.throws(()=>recordEmailCheck(store,payload));
  assert.deepEqual(readEmailStatus(store).collection,before);
});

test('mailbox requests coalesce and a real subsequent check acknowledges the request',async t=>{
  const {store}=await fixture(t);
  assert.throws(()=>requestEmailCheck(store,{now:time(0)}),/separate email checker/);
  recordEmailCheck(store,{state:'success',checkedAt:time(0)});
  const first=requestEmailCheck(store,{now:time(0)});
  assert.deepEqual(requestEmailCheck(store,{now:time(1)}),first);
  recordEmailCheck(store,{state:'running',checkedAt:time(2)});
  assert.equal(readEmailCheckRequest(store).state,'running');
  recordEmailCheck(store,{state:'success',checkedAt:time(3),processed:0});
  assert.equal(readEmailCheckRequest(store).state,'completed');
  assert.equal(requestEmailCheck(store,{now:time(4)}).state,'pending');
});

test('status CLI writes only metadata to the explicitly selected existing database',async t=>{
  const {store,runtimeDir}=await fixture(t),before=store.getState();
  const input=path.join(runtimeDir,'check-status.json');
  await writeFile(input,JSON.stringify({state:'success',checkedAt:time(1),processed:3,held:1}));
  const cli=fileURLToPath(new URL('../scripts/record-email-check.mjs',import.meta.url));
  const run=promisify(execFile);
  const {stdout}=await run(process.execPath,[cli,input],{windowsHide:true,env:{...process.env,FINANCE_RUNTIME_DIR:runtimeDir}});
  assert.deepEqual(Object.keys(JSON.parse(stdout)),['collection']);
  assert.equal(readEmailStatus(store).collection.lastResult.held,1);assert.deepEqual(store.getState(),before);
  await assert.rejects(run(process.execPath,[cli,input],{windowsHide:true,env:{...process.env,FINANCE_RUNTIME_DIR:path.join(runtimeDir,'missing')}}));
});

test('email request API is local-only and acknowledges queuing instead of claiming a mailbox read',async t=>{
  const runtimeDir=await mkdtemp(path.join(tmpdir(),'finance-mail-api-'));
  const service=await startServer({port:0,lan:true,lanAddresses:['192.168.50.20'],runtimeDir,autoCollect:false,autoBankSync:false});
  t.after(async()=>{await service.close();await rm(runtimeDir,{recursive:true,force:true});});
  const request=(phone=false)=>new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port:service.server.address().port,path:'/api/email-check/request',method:'POST',headers:{Host:`${phone?'192.168.50.20':'127.0.0.1'}:${service.server.address().port}`}},res=>{
      let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(body)}));
    });req.on('error',reject);req.end();
  });
  assert.equal((await request()).status,503);
  recordEmailCheck(service.store,{state:'success',checkedAt:time(0)});
  const local=await request();assert.equal(local.status,202);assert.equal(local.body.request.state,'pending');
  assert.match(local.body.message,/does not mean/);assert.equal(service.store.getState().revision,1);
  assert.ok([401,403].includes((await request(true)).status));
});
