import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateAccountBalances} from '../dist/account-balances.mjs';

const asOf='2026-10-29';
const state=()=>({plan:{startDate:'2026-10-26',balance:300,accounts:[{id:'cash',name:'Cash App',balance:100,balanceAsOf:'2026-10-26'},{id:'bank',name:'Fifth Third checking',balance:200,balanceAsOf:'2026-10-23'}]},transactions:[]});
const transaction=(id,amount,extra={})=>({id,key:id,date:'2026-10-27',source:'cashapp',amount,...extra});
const receipt=(receiptId,amount,extra={})=>({receiptId,provider:'cashapp',date:'2026-10-28',amount,status:'completed',...extra});
const calculate=(input,receipts=[])=>calculateAccountBalances(input,{receipts,asOf});

test('new charges and pending/reported alerts reduce only the mapped account without changing baselines',()=>{
  const input=state();input.transactions=[transaction('posted',-10)];const before=structuredClone(input);
  const result=calculate(input,[receipt('hold',-5,{status:'pending'}),receipt('reported',-7,{provider:'fifththird',status:'reported'})]);
  assert.equal(result.balance,278);assert.equal(result.accounts[0].balance,85);assert.equal(result.accounts[0].charges,15);assert.equal(result.accounts[0].pendingCharges,5);
  assert.equal(result.accounts[1].balance,193);assert.equal(result.accounts[1].pendingCharges,7);assert.deepEqual(input,before);
});

test('matched statement, email copy and receipt represent one charge; explicit fee stays once',()=>{
  const input=state();input.transactions=[transaction('principal',-40),transaction('principal:fee',-5),transaction('cashapp-email:sent',-45,{source:'cashapp-email',emailReceiptId:'sent'})];
  const result=calculate(input,[receipt('sent',-45,{matchedTransactionId:'principal'})]);
  assert.equal(result.accounts[0].balance,55);assert.equal(result.accounts[0].charges,45);assert.equal(result.accounts[0].chargeCount,2);
});

test('two genuine equal-valued payments remain distinct; matched receipt never adds a third',()=>{
  const input=state();input.transactions=[transaction('one',-10),transaction('two',-10)];
  const result=calculate(input,[receipt('mail',-10,{matchedTransactionId:'one'})]);
  assert.equal(result.accounts[0].balance,80);assert.equal(result.accounts[0].chargeCount,2);
});

test('pending-to-completed receipt updates count once and stop being pending',()=>{
  const result=calculate(state(),[receipt('same',-12,{status:'pending'}),receipt('same',-12)]);
  assert.equal(result.accounts[0].balance,88);assert.equal(result.accounts[0].chargeCount,1);assert.equal(result.accounts[0].pendingCharges,0);
});

test('legacy snapshots exclude older activity and hold same-day activity without time evidence',()=>{
  const result=calculate(state(),[receipt('old',-30,{date:'2026-10-25'}),receipt('same-day',-20,{date:'2026-10-26'}),receipt('future',-50,{date:'2026-10-30'})]);
  assert.equal(result.accounts[0].balance,100);assert.equal(result.heldSameDay,1);assert.equal(result.accounts[0].chargeCount,0);
});

test('same-day charge needs a received timestamp later than the captured balance',()=>{
  const input=state();input.plan.accounts[0].balanceCapturedAt='2026-10-26T12:00:00Z';
  const result=calculate(input,[receipt('before',-8,{date:'2026-10-26',receivedAt:'2026-10-26T11:00:00Z'}),receipt('after',-9,{date:'2026-10-26',receivedAt:'2026-10-26T13:00:00Z'})]);
  assert.equal(result.accounts[0].balance,91);assert.equal(result.heldSameDay,1);
});

test('a matched statement can use native receipt time for a same-day cutoff',()=>{
  const input=state();input.plan.accounts[0].balanceCapturedAt='2026-10-26T12:00:00Z';
  input.transactions=[transaction('same-day-statement',-9,{date:'2026-10-26'})];
  const result=calculate(input,[receipt('after',-9,{date:'2026-10-26',receivedAt:'2026-10-26T13:00:00Z',matchedTransactionId:'same-day-statement'})]);
  assert.equal(result.accounts[0].balance,91);assert.equal(result.accounts[0].chargeCount,1);
});

test('explicit provider choice wins; none opts out; ambiguous names never debit two accounts',()=>{
  const explicit=state();explicit.plan.accounts[0].name='My wallet';explicit.plan.accounts[0].chargeSource='cashapp';
  assert.equal(calculate(explicit,[receipt('one',-5)]).accounts[0].balance,95);
  explicit.plan.accounts[0].chargeSource='none';assert.equal(calculate(explicit,[receipt('one',-5)]).accounts[0].balance,100);
  const ambiguous=state();ambiguous.plan.accounts.push({id:'second',name:'Cash App savings',balance:50,balanceAsOf:'2026-10-26'});
  const result=calculate(ambiguous,[receipt('one',-5)]);assert.equal(result.balance,350);assert.equal(result.unmapped,1);
});

test('known credits increase the account; pending positive amounts do not invent income',()=>{
  const input=state();input.transactions=[transaction('deposit',25)];
  const result=calculate(input,[receipt('pending-credit',10,{status:'pending'}),receipt('refund',3)]);
  assert.equal(result.accounts[0].balance,128);assert.equal(result.accounts[0].credits,28);assert.equal(result.heldCredits,1);
});

test('ambiguous history receipts and contradictory duplicate identities are held rather than guessed',()=>{
  const result=calculate(state(),[receipt('ambiguous',-10,{matchMethod:'ambiguous_history'}),receipt('conflict',-5),receipt('conflict',-7)]);
  assert.equal(result.accounts[0].balance,100);assert.equal(result.heldAmbiguous,2);
});

test('a new snapshot checkpoint absorbs pending completion and later statement representations',()=>{
  const input=state();input.plan.accounts[0].balanceCheckpoint=['receipt:reserved'];
  input.transactions=[transaction('posted-later',-20)];
  const result=calculate(input,[receipt('reserved',-20,{matchedTransactionId:'posted-later'}),receipt('new',-7,{status:'pending'})]);
  assert.equal(result.accounts[0].balance,93);assert.equal(result.accounts[0].charges,7);
  input.plan.accounts[0].balanceCheckpoint=['transaction:posted-later'];
  assert.equal(calculate(input,[receipt('reserved',-20,{matchedTransactionId:'posted-later'})]).accounts[0].balance,100);
});

test('unmatched pending/reported overlaps are held; known different merchants stay distinct',()=>{
  const input=state();input.transactions=[transaction('posted',-10,{description:'Example Coffee'})];
  const result=calculate(input,[receipt('possible-duplicate',-10,{date:'2026-10-27',status:'pending',merchant:'EXAMPLE COFFEE'}),receipt('distinct',-10,{date:'2026-10-27',status:'pending',merchant:'Different Shop'})]);
  assert.equal(result.accounts[0].balance,80);assert.equal(result.accounts[0].chargeCount,2);assert.equal(result.heldAmbiguous,1);
  const unknown=calculate(input,[receipt('unknown',-10,{date:'2026-10-27',status:'reported'})]);
  assert.equal(unknown.accounts[0].balance,90);assert.equal(unknown.heldAmbiguous,1);
});

test('a checkpoint covering a full sent payment also absorbs its exact linked statement fee',()=>{
  const input=state();input.plan.accounts[0].balanceCheckpoint=['receipt:sent'];
  input.transactions=[transaction('principal',-40,{cashAppType:'P2P',cashAppTransactionId:'native-sent'}),transaction('principal:fee',-5,{cashAppType:'P2P',sourceCategory:'Fees',cashAppTransactionId:'native-sent'})];
  const sent=receipt('sent',-45,{matchedTransactionId:'principal',paymentKind:'p2p',matchMethod:'unique_date_total_with_explicit_fee_heuristic'});
  assert.equal(calculate(input,[sent]).accounts[0].balance,100);
  input.plan.accounts[0].balanceCheckpoint=[];
  const uncheckpointed=calculate(input,[sent]);assert.equal(uncheckpointed.accounts[0].balance,55);assert.equal(uncheckpointed.accounts[0].charges,45);
  input.plan.accounts[0].balanceCheckpoint=['receipt:sent'];input.transactions[1].cashAppTransactionId='different-payment';
  assert.equal(calculate(input,[sent]).accounts[0].balance,95);
});
