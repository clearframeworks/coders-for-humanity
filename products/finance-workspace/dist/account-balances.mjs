import {isValidDate} from './engine.mjs';
import {currentLedgerDate} from './projection.mjs';
import {normalizeMerchant} from './planning.mjs';

const providers=new Set(['cashapp','fifththird']);
const cents=value=>Number.isFinite(value)?Math.round(value*100):null;
const money=value=>value/100;
const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
function namedProvider(name){
  const label=String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,' ');
  const matches=[/\bcash\s*app\b/.test(label)?'cashapp':null,/\bfifth\s*third\b/.test(label)?'fifththird':null].filter(Boolean);
  return matches.length===1?matches[0]:null;
}
function sourceProvider(row){return row.source==='cashapp-email'?'cashapp':providers.has(row.source)?row.source:null;}
function explicitFee(principal,receipt,transactions){
  if(receipt.provider!=='cashapp'||!(receipt.paymentKind==='p2p'||receipt.matchMethod==='unique_date_total_with_explicit_fee_heuristic')||principal.source!=='cashapp'||principal.cashAppType!=='P2P'||!(principal.amount<0))return null;
  const fees=transactions.filter(row=>row.source==='cashapp'&&row.cashAppType==='P2P'&&row.key===principal.key+':fee');
  if(fees.length!==1)return null;
  const fee=fees[0];
  const sameProviderId=!(principal.cashAppTransactionId||fee.cashAppTransactionId)||(!!principal.cashAppTransactionId&&principal.cashAppTransactionId===fee.cashAppTransactionId);
  return fee.sourceCategory==='Fees'&&sameProviderId&&fee.date===principal.date&&fee.amount<0&&cents(principal.amount)+cents(fee.amount)===cents(receipt.amount)?fee:null;
}
function potentialPostedOverlap(receipt,transactions){
  const merchant=normalizeMerchant(receipt.merchant||'');
  return transactions.some(row=>{
    if(row.source==='cashapp-email'||sourceProvider(row)!==receipt.provider||row.date!==receipt.date||row.pending===true||/^(?:pending|failed|cancelled|canceled|removed)$/i.test(row.status||''))return false;
    const recordedMerchant=normalizeMerchant(row.description||'');
    if(merchant&&recordedMerchant&&merchant!==recordedMerchant)return false;
    return cents(row.amount)===cents(receipt.amount)||!!explicitFee(row,receipt,transactions);
  });
}

/** Roll forward each saved snapshot using observed activity. This never writes
 * baselines, creates income, spends credit limits, or re-anchors a cash forecast.
 * Signed amounts are retained: charges negative, known credits positive. */
export function calculateAccountBalances(state,{receipts=[],asOf=currentLedgerDate()}={}){
  if(!state?.plan||!Array.isArray(state.plan.accounts)||!Array.isArray(state.transactions)||!Array.isArray(receipts)||!isValidDate(asOf))throw Error('Account balances need a saved plan, activity and a valid analysis date.');
  const accounts=state.plan.accounts.map(account=>{
    if(cents(account.balance)===null)throw Error('A saved account balance must be a finite amount.');
    const explicit=Object.hasOwn(account,'chargeSource');
    return {id:account.id,name:account.name,snapshotBalance:account.balance,snapshotDate:account.balanceAsOf||state.plan.startDate,balanceCapturedAt:account.balanceCapturedAt||null,balance:account.balance,provider:explicit?(providers.has(account.chargeSource)?account.chargeSource:null):namedProvider(account.name),mapping:explicit?'explicit':'name',optedOut:account.chargeSource==='none',charges:0,pendingCharges:0,credits:0,chargeCount:0,creditCount:0,activityCount:0,heldSameDay:0,heldAmbiguous:0,estimated:true,_adjustment:0,_charges:0,_pending:0,_credits:0};
  });
  const checkpoints=new Map(state.plan.accounts.map(account=>[account.id,new Set(Array.isArray(account.balanceCheckpoint)?account.balanceCheckpoint.filter(token=>typeof token==='string'):[])]));
  const destinations=new Map();
  for(const provider of providers){
    const explicit=accounts.filter(account=>account.provider===provider&&account.mapping==='explicit');
    const possible=explicit.length?explicit:accounts.filter(account=>account.provider===provider&&!account.optedOut);
    if(possible.length===1)destinations.set(provider,possible[0]);
  }
  const earliest=accounts.map(account=>account.snapshotDate).filter(isValidDate).sort()[0]||asOf;
  const events=[];
  const coveredFees=new Map();
  for(const receipt of receipts){
    const matched=receipt.matchedTransactionId||receipt.matched_transaction_id;
    const principal=state.transactions.find(row=>(row.id||row.key)===matched);
    const fee=principal&&explicitFee(principal,receipt,state.transactions);
    if(fee&&typeof receipt.receiptId==='string'){
      const id=fee.id||fee.key;if(!coveredFees.has(id))coveredFees.set(id,[]);
      coveredFees.get(id).push('receipt:'+receipt.receiptId,'transaction:cashapp-email:'+receipt.receiptId);
    }
  }
  let heldAmbiguous=0,heldSameDay=0,unmapped=0,heldCredits=0;
  for(const row of state.transactions){
    const amount=cents(row.amount);
    if(amount===null||amount===0||!isValidDate(row.date)||row.date>asOf||/^(?:failed|cancelled|canceled|removed)$/i.test(row.status||''))continue;
    const id=row.id||row.key;if(typeof id!=='string'||!id)continue;
    const receiptId=row.emailReceiptId||(id.startsWith('cashapp-email:')?id.slice('cashapp-email:'.length):null);
    const pending=row.pending===true||row.status==='pending';
    events.push({provider:sourceProvider(row),date:row.date,receivedAt:row.receivedAt,amount,pending,priority:row.source==='cashapp-email'?3:pending?1:4,checkpointKeys:coveredFees.get(id)||[],keys:['transaction:'+id,...(receiptId?['receipt:'+receiptId]:[])]});
  }
  for(const receipt of receipts){
    const amount=cents(receipt.amount);
    if(amount===null||amount===0||!isValidDate(receipt.date)||receipt.date>asOf||typeof receipt.receiptId!=='string'||!receipt.receiptId||!['completed','pending','reported'].includes(receipt.status))continue;
    const matched=receipt.matchedTransactionId||receipt.matched_transaction_id;
    const canonical=state.transactions.some(row=>row.emailReceiptId===receipt.receiptId||(row.id||row.key)==='cashapp-email:'+receipt.receiptId);
    if(receipt.matchMethod==='ambiguous_history'||(receipt.status!=='completed'&&!matched&&!canonical&&potentialPostedOverlap(receipt,state.transactions))){
      const account=destinations.get(receipt.provider);
      if(account&&receipt.date>=account.snapshotDate){account.heldAmbiguous++;heldAmbiguous++;}
      continue;
    }
    events.push({provider:providers.has(receipt.provider)?receipt.provider:null,date:receipt.date,receivedAt:receipt.receivedAt,amount,pending:receipt.status!=='completed',priority:receipt.status==='completed'?2:1,keys:['receipt:'+receipt.receiptId,...(typeof matched==='string'&&matched?['transaction:'+matched]:[])]});
  }

  // Identity joins preserve provider IDs. Merchant/amount guesses are never used
  // to merge two distinct payments. CSV principal and fee rows remain distinct.
  const parents=new Map();
  const find=key=>{if(!parents.has(key))parents.set(key,key);let parent=parents.get(key);if(parent!==key){parent=find(parent);parents.set(key,parent);}return parent;};
  for(const event of events)for(const key of event.keys.slice(1))parents.set(find(key),find(event.keys[0]));
  const grouped=new Map();
  for(const event of events){const key=find(event.keys[0]);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(event);}
  for(const group of grouped.values()){
    const strongest=Math.max(...group.map(event=>event.priority));
    const candidates=group.filter(event=>event.priority===strongest);
    const event=candidates.reduce((first,next)=>next.date<first.date?next:first);
    const account=destinations.get(event.provider);
    if(!account){
      const optedOut=accounts.some(item=>item.optedOut&&namedProvider(item.name)===event.provider);
      if(!optedOut&&event.date>=earliest)unmapped++;
      continue;
    }
    if(group.some(item=>[...item.keys,...(item.checkpointKeys||[])].some(key=>checkpoints.get(account.id)?.has(key))))continue;
    if(new Set(group.map(item=>item.provider)).size>1||candidates.some(item=>item.amount!==event.amount)){
      if(event.date>=account.snapshotDate){account.heldAmbiguous++;heldAmbiguous++;}continue;
    }
    if(!isValidDate(account.snapshotDate)||account.snapshotDate>asOf||event.date<account.snapshotDate)continue;
    if(event.date===account.snapshotDate){
      const times=group.filter(item=>item.date===event.date).map(item=>stamp(item.receivedAt)).filter(value=>value!==null);
      const captured=stamp(account.balanceCapturedAt),received=times.length?Math.min(...times):null;
      if(captured===null||received===null||received<=captured){account.heldSameDay++;heldSameDay++;continue;}
    }
    if(event.amount>0&&event.pending){heldCredits++;continue;}
    account._adjustment+=event.amount;account.activityCount++;
    if(event.amount<0){account._charges-=event.amount;account.chargeCount++;if(event.pending)account._pending-=event.amount;}
    else{account._credits+=event.amount;account.creditCount++;}
  }
  for(const account of accounts){
    account.balance=money(cents(account.snapshotBalance)+account._adjustment);
    account.charges=money(account._charges);account.pendingCharges=money(account._pending);account.credits=money(account._credits);
    delete account._adjustment;delete account._charges;delete account._pending;delete account._credits;
  }
  return {balance:money(accounts.reduce((total,account)=>total+cents(account.balance),0)),accounts,unmapped,heldSameDay,heldAmbiguous,heldCredits,asOf,estimated:true};
}
