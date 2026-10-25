import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,utimes,rm} from 'node:fs/promises';
import path from 'node:path';
import {Store} from '../server/store.mjs';
import {BrowserDownloads} from '../server/browser-downloads.mjs';
import {startServer} from '../server/index.mjs';
const report='Date,Description,"Check Number",Amount\n10/22/2026,Example store,,-10\n';
async function fixture(run){
  const base=await mkdtemp(path.join(process.cwd(),'.browser-download-test-'));
  const downloads=path.join(base,'downloads');await mkdir(downloads);
  const store=new Store({runtimeDir:path.join(base,'runtime')});
  const watcher=new BrowserDownloads(store);
  async function enable(){await writeFile(path.join(store.runtimeDir,'browser-collector.json'),JSON.stringify({enabled:true,downloadsDir:downloads,enabledAt:new Date(Date.now()-10000).toISOString()}));}
  async function put(name,content=report,age=3000){const file=path.join(downloads,name);await writeFile(file,content);const d=new Date(Date.now()-age);await utimes(file,d,d);return file;}
  try{await run({store,watcher,downloads,enable,put});}finally{store.close();await rm(base,{recursive:true,force:true});}
}
test('downloads are opt-in; stable native files import with plan and original preserved',()=>fixture(async({store,watcher,enable,put})=>{
  const file=await put('EXPORT.CSV');await watcher.scan();assert.equal((await readdir(store.inboxPath)).length,0);
  await enable();const before=store.getState();await watcher.scan();assert.equal(watcher.status.queued,1);
  assert.equal((await store.collect()).added,1);assert.deepEqual(store.getState().plan,before.plan);assert.equal(await readFile(file,'utf8'),report);
  await watcher.scan();assert.equal(watcher.status.queued,0);
  const restarted=new BrowserDownloads(store);await restarted.scan();assert.equal(restarted.status.queued,0);
  await put('EXPORT (1).CSV');await restarted.scan();assert.equal(restarted.status.queued,0);
}));
test('partial, unrelated, old and still-settling exports never enter inbox',()=>fixture(async({store,watcher,enable,put})=>{
  await enable();await put('EXPORT.CSV.crdownload');await put('unrelated.csv');await put('EXPORT (1).CSV',report,15000);await put('EXPORT (2).CSV',report,0);
  await watcher.scan();assert.equal((await readdir(store.inboxPath)).length,0);
}));
test('mismatched and malformed native files are rejected whole without changing state',()=>fixture(async({store,watcher,enable,put})=>{
  await enable();const before=store.getState();await put('cash_app_report_123.csv',report);await put('EXPORT.CSV',report+'bad,row');
  await watcher.scan();assert.equal(watcher.status.errors.length,2);assert.equal((await readdir(store.inboxPath)).length,0);assert.deepEqual(store.getState(),before);
}));
test('example mode pauses collection and concurrent scans share one operation',()=>fixture(async({store,watcher,enable,put})=>{
  await enable();await put('EXPORT.CSV');const state=store.getState();state.mode='example';store.setState(state);await watcher.scan();assert.equal((await readdir(store.inboxPath)).length,0);
  state.mode='personal';state.revision=store.getState().revision;store.setState(state);await Promise.all([watcher.scan(),watcher.scan()]);assert.equal(watcher.status.queued,1);assert.equal((await store.collect()).added,1);
}));
test('broken download configuration reports a pause without blocking ordinary inbox imports',()=>fixture(async({store})=>{
  await writeFile(path.join(store.runtimeDir,'browser-collector.json'),JSON.stringify({enabled:true,downloadsDir:path.join(store.runtimeDir,'missing'),enabledAt:new Date().toISOString()}));
  await writeFile(path.join(store.inboxPath,'ordinary.csv'),'date,description,amount\n2026-10-22,Example,-1');
  const server=await startServer({port:0,runtimeDir:store.runtimeDir,autoBankSync:false});
  try{assert.equal(server.store.getState().transactions.length,1);const status=await(await fetch(server.url+'/api/automation')).json();assert.match(status.browserCollection.errors[0].message,/paused/);}
  finally{await server.close();}
}));
