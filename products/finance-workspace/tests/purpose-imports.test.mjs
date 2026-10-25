import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {Store,defaultState} from '../server/store.mjs';
import {importEmailMessages} from '../server/email-alerts.mjs';

async function fixture(t){const dir=await mkdtemp(path.join(process.cwd(),'.purpose-test-'));const initialState=defaultState();initialState.plan.forecastBasis={ownerPurposeRules:true};const store=new Store({runtimeDir:dir,initialState});t.after(async()=>{store.close();await rm(dir,{recursive:true,force:true});});return store;}
test('unattended inbox retains neutral categories while retaining amounts and category overrides',async t=>{
 const store=await fixture(t),csv='date,description,amount\n2026-10-24,Example workplace meal,-12.50\n2026-10-24,Example shop,-9.00\n2026-10-24,Kroger,-20\n2026-10-24,Lyft,-15\n';
 await writeFile(path.join(store.inboxPath,'purchases.csv'),csv);await store.collect();
 let state=store.getState();assert.equal(state.transactions[0].category,'Other');assert.equal(state.transactions[1].category,'Other');assert.equal(state.transactions[2].category,'Groceries');assert.equal(state.transactions[3].category,'Transport');
 assert.equal(state.transactions.reduce((s,r)=>s+r.amount,0),-56.5);
 state.transactions[0].category='Personal override';store.setState(state);
 await writeFile(path.join(store.inboxPath,'again.csv'),csv);await store.collect();assert.equal(store.getState().transactions[0].category,'Personal override');assert.equal(store.getState().transactions.length,4);
});
test('new completed purchase emails preserve neutral categorization but reimports preserve manual overrides',async t=>{
 const store=await fixture(t),subject='You spent $12.50 at Example workplace meal';
 const message={id:'synthetic-purpose-mail',internal_date:String(Date.parse('2026-10-24T12:00:00Z')),payload:{mime_type:'multipart/alternative',headers:[{name:'From',value:'Cash App <cash@square.com>'},{name:'Subject',value:subject},{name:'Authentication-Results',value:'mx.google.com; dkim=pass header.i=@square.com; dmarc=pass header.from=square.com'}],parts:[{mime_type:'text/plain',body:{content:subject+'.'}},{mime_type:'text/html',body:{content:'<table><tr><td>Complete</td></tr></table><a href="https://cash.app/launch/activity/receipt/c3ludGhldGljLXB1cnBvc2U=">Receipt</a>'}}]}};
 const result=importEmailMessages(store,[message]);assert.equal(result.added,1);let state=store.getState();assert.equal(state.transactions[0].category,'Other');assert.equal(state.transactions[0].amount,-12.5);
 state.transactions[0].category='Personal override';store.setState(state);assert.equal(importEmailMessages(store,[message]).added,0);assert.equal(store.getState().transactions[0].category,'Personal override');
});
