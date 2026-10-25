import test from 'node:test';
import assert from 'node:assert/strict';
import {projectForecast} from '../dist/projection.mjs';
import {forecast} from '../dist/engine.mjs';
import {startServer} from '../server/index.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
test('manual plans preserve engine behavior without derived obligations',()=>{
 const state={plan:{startDate:'2026-10-24',horizon:30,balance:500,cushion:0,dailySpend:20,bills:[],paychecks:[]},transactions:[]};
 assert.deepEqual(projectForecast(state),forecast(state.plan));
});
test('automatic routine profile separates proposed subscriptions from confirmed bills without saving them',()=>{
 const state={plan:{startDate:'2026-10-24',horizon:30,balance:500,cushion:0,dailySpend:10,bills:[],paychecks:[{id:'pay',name:'Pay',amount:800,date:'2026-10-30',repeat:'weekly'}],forecastBasis:{spendingMethod:'routine-history',estimatedDaily:10}},transactions:[
 {id:'a',source:'fifththird',date:'2026-10-01',description:'RECURRING PURCHASE AT NETFLIX',amount:-20,category:'Other'},
 {id:'b',source:'fifththird',date:'2026-10-02',description:'Kroger',amount:-10,category:'Groceries'}]};
 const original=structuredClone(state),m=projectForecast(state);
 assert.equal(m.income,3200);assert.equal(m.confirmedBillsTotal,0);assert.equal(m.estimatedRecurringTotal,20);
 assert.equal(m.estimatedRecurringEvents.length,1);assert.equal(m.estimatedRecurringEvents[0].date,'2026-11-01');
 assert.equal(Math.round((m.withoutEstimatedRecurring.ending-m.ending)*100),2000);assert.deepEqual(state,original);
 const overridden=structuredClone(state);overridden.plan.dailySpend=7;
 assert.equal(projectForecast(overridden).estimatedRecurringEvents,undefined);
 assert.equal(projectForecast(overridden,null,{dailyReduction:1}).ending-projectForecast(overridden).ending,30);
});
test('savings scenario keeps inferred renewals and cannot mutate the plan',()=>{
 const state={plan:{startDate:'2026-10-24',horizon:30,balance:500,cushion:0,dailySpend:10,bills:[],paychecks:[],forecastBasis:{spendingMethod:'routine-history',estimatedDaily:10}},transactions:[{date:'2026-10-01',source:'fifththird',description:'RECURRING PURCHASE AT NETFLIX',amount:-20,category:'Other'},{date:'2026-10-02',source:'fifththird',description:'Kroger',amount:-10,category:'Groceries'}]};
 const before=structuredClone(state),base=projectForecast(state),reduced=projectForecast(state,null,{dailyReduction:1});
 assert.equal(reduced.ending-base.ending,30);assert.equal(reduced.estimatedRecurringTotal,base.estimatedRecurringTotal);assert.deepEqual(state,before);
});
test('HTTP forecast and extra-expense scenarios share the derived model; purpose mapping preserves edits',async t=>{
 const runtimeDir=await mkdtemp(path.join(process.cwd(),'.projection-api-test-'));
 const service=await startServer({port:0,runtimeDir,autoCollect:false,autoBankSync:false});
 t.after(async()=>{await service.close();await rm(runtimeDir,{recursive:true,force:true});});
 let state=service.store.getState();Object.assign(state.plan,{startDate:'2026-10-24',horizon:30,dailySpend:10,forecastBasis:{spendingMethod:'routine-history',estimatedDaily:10,ownerPurposeRules:true}});
 state.transactions=[{id:'one',key:'one',date:'2026-10-01',source:'fifththird',description:'RECURRING PURCHASE AT NETFLIX',amount:-20,category:'Other'},{id:'two',key:'two',date:'2026-10-02',source:'fifththird',description:'Kroger',amount:-10,category:'Groceries'}];service.store.setState(state);state=service.store.getState();
 const actual=await fetch(service.url+'/api/forecast').then(r=>r.json());assert.deepEqual(actual,projectForecast(state));
 const expense={amount:25,date:'2026-10-28',name:'Example extra purchase'};
 const simulated=await fetch(service.url+'/api/scenario',{method:'POST',headers:{'Content-Type':'application/json',Origin:service.url},body:JSON.stringify(expense)}).then(r=>r.json());
 assert.deepEqual(simulated,projectForecast(state,expense));assert.deepEqual(service.store.getState(),state);
 state.transactions.push({id:'three',key:'three',date:'2026-10-24',description:'Example workplace meal',amount:-10,category:'Other'});
 let response=await fetch(service.url+'/api/state',{method:'PUT',headers:{'Content-Type':'application/json',Origin:service.url},body:JSON.stringify(state)});assert.equal(response.status,200);state=await response.json();assert.equal(state.transactions[2].category,'Other');
 state.transactions[2].category='Owner edit';response=await fetch(service.url+'/api/state',{method:'PUT',headers:{'Content-Type':'application/json',Origin:service.url},body:JSON.stringify(state)});assert.equal(response.status,200);assert.equal((await response.json()).transactions[2].category,'Owner edit');
});
