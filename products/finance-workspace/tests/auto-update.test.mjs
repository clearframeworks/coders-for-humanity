import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutoUpdater} from '../dist/auto-update.mjs';

function timers(){let next=0;const active=new Map(),cleared=[];return{active,cleared,setTimer:(callback,ms)=>{const id=next++;active.set(id,{callback,ms});return id;},clearTimer:id=>{active.delete(id);cleared.push(id);},tick:()=>{for(const value of active.values())value.callback();}};}
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};

test('starts one minute scheduling without an immediate check; repeated enable never adds another timer',async()=>{
 const clock=timers();let calls=0;const updater=createAutoUpdater({...clock,check:async()=>{calls++;return{revision:1};}});
 assert.equal(updater.getState().enabled,true);assert.equal(calls,0);assert.equal(clock.active.size,1);assert.equal([...clock.active.values()][0].ms,60000);
 updater.enable();updater.enable();assert.equal(clock.active.size,1);
 clock.tick();await updater.checkNow();assert.equal(calls,1);assert.deepEqual(updater.getState().result,{revision:1});updater.dispose();assert.equal(clock.active.size,0);
});

test('manual requests and timer ticks coalesce, with no delayed extra check queued',async()=>{
 const clock=timers(),gate=deferred();let calls=0;const updater=createAutoUpdater({...clock,check:()=>{calls++;return gate.promise;}});
 const first=updater.checkNow(),second=updater.checkNow();assert.equal(first,second);clock.tick();clock.tick();await Promise.resolve();assert.equal(calls,1);assert.equal(updater.getState().checking,true);
 gate.resolve({revision:2});await first;await Promise.resolve();assert.equal(calls,1);assert.equal(updater.getState().checking,false);assert.equal(updater.getState().result.revision,2);updater.dispose();
});

test('failure preserves previous successful data and timestamp, and later success clears error',async()=>{
 const clock=timers();let mode='good',stamp='2026-10-24T12:00:00Z';const updater=createAutoUpdater({...clock,now:()=>stamp,check:()=>{if(mode==='bad')throw Error('Local service unavailable.');return{revision:mode==='recovered'?3:1};}});
 await updater.checkNow();const success=updater.getState();mode='bad';stamp='2026-10-24T12:01:00Z';await updater.checkNow();
 assert.equal(updater.getState().lastSuccess,success.lastSuccess);assert.deepEqual(updater.getState().result,success.result);assert.equal(updater.getState().lastError,'Local service unavailable.');assert.equal(updater.getState().checking,false);
 mode='recovered';await updater.checkNow();assert.equal(updater.getState().lastError,null);assert.equal(updater.getState().lastSuccess,stamp);assert.equal(updater.getState().result.revision,3);updater.dispose();
});

test('editing skips do not claim freshness, erase previous errors or replace good data',async()=>{
 const clock=timers();let mode='good',time='2026-10-24T12:00:00Z';const updater=createAutoUpdater({...clock,now:()=>time,check:()=>mode==='skip'?{skipped:true,reason:'Finish editing before updating.'}:mode==='bad'?Promise.reject(Error('Offline')):{revision:1}});
 await updater.checkNow();const before=updater.getState();mode='bad';await updater.checkNow();mode='skip';time='2026-10-24T12:02:00Z';await updater.checkNow();
 assert.equal(updater.getState().lastSuccess,before.lastSuccess);assert.deepEqual(updater.getState().result,before.result);assert.equal(updater.getState().lastError,'Offline');assert.equal(updater.getState().deferredReason,'Finish editing before updating.');updater.dispose();
});

test('pause removes even timer zero, lets active check finish and allows an explicit manual check',async()=>{
 const clock=timers(),gate=deferred();let calls=0;const updater=createAutoUpdater({...clock,check:()=>{calls++;return calls===1?gate.promise:{revision:2};}});
 const task=updater.checkNow();await Promise.resolve();updater.pause();assert.deepEqual(clock.cleared,[0]);assert.equal(clock.active.size,0);assert.equal(updater.getState().enabled,false);
 gate.resolve({revision:1});await task;clock.tick();assert.equal(calls,1);assert.equal(updater.getState().enabled,false);assert.equal(updater.getState().result.revision,1);
 await updater.checkNow();assert.equal(calls,2);assert.equal(updater.getState().result.revision,2);assert.equal(updater.getState().enabled,false);updater.dispose();
});

test('dispose prevents late responses from publishing into a removed view; snapshots cannot mutate controller data',async()=>{
 const clock=timers(),gate=deferred(),events=[];const updater=createAutoUpdater({...clock,onState:s=>events.push(s),check:()=>gate.promise});
 const task=updater.checkNow();await Promise.resolve();const before=events.length;updater.dispose();gate.resolve({revision:1});await task;assert.equal(events.length,before);assert.equal(updater.getState().lastSuccess,null);assert.equal(updater.getState().enabled,false);assert.equal(clock.active.size,0);assert.throws(()=>updater.enable(),/disposed/);
 const second=createAutoUpdater({...clock,check:()=>({nested:{revision:1}})});await second.checkNow();const snapshot=second.getState();snapshot.result.nested.revision=99;assert.equal(second.getState().result.nested.revision,1);second.dispose();
});

test('invalid success timestamp cannot leave checking stuck or label an unverified result fresh',async()=>{
 const clock=timers();const updater=createAutoUpdater({...clock,now:()=> 'invalid',check:()=>({revision:1})});await updater.checkNow();assert.equal(updater.getState().checking,false);assert.equal(updater.getState().lastSuccess,null);assert.equal(updater.getState().result,null);assert.match(updater.getState().lastError,/time/);updater.dispose();
});
