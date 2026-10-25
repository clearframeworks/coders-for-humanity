import {forecast} from './engine.mjs';
import {estimateSpending} from './spending-plan.mjs';
export function currentLedgerDate(){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export function projectForecast(state,scenario=null,{dailyReduction=0,ledgerAsOf=currentLedgerDate(),excludedRenewalKeys=[]}={}){
  if(!Number.isFinite(dailyReduction)||dailyReduction<0)throw Error('Choose a nonnegative daily spending reduction.');
  if(!Array.isArray(excludedRenewalKeys)||excludedRenewalKeys.length>1000||excludedRenewalKeys.some(k=>typeof k!=='string'||k.length>5000))throw Error('Choose valid estimated recurring charges.');
  const plan=structuredClone(state.plan);
  const analysis=estimateSpending(state.transactions,plan,{ledgerAsOf});
  const automatic=plan.forecastBasis?.spendingMethod==='routine-history'&&plan.dailySpend===plan.forecastBasis.estimatedDaily;
  if(!automatic||!analysis){
    plan.dailySpend=Math.max(0,Math.round((plan.dailySpend-dailyReduction)*100)/100);
    return forecast(plan,scenario);
  }
  plan.dailySpend=Math.max(0,Math.round((analysis.daily-dailyReduction)*100)/100);
  const confirmed=forecast(plan,scenario);
  const excluded=new Set(excludedRenewalKeys);
  const proposals=analysis.subscriptions.filter(s=>s.date&&s.repeat&&!s.reviewOnly&&!excluded.has(s.key));
  plan.bills.push(...proposals.map(s=>({id:'estimated:'+s.key,name:'Possible '+s.name,amount:s.amount,date:s.date,repeat:s.repeat})));
  const result=forecast(plan,scenario);
  return {...result,routineDaily:plan.dailySpend,confirmedBillsTotal:confirmed.bills,
    estimatedRecurringTotal:Math.round((result.bills-confirmed.bills)*100)/100,
    estimatedRecurringEvents:result.events.filter(e=>e.id.startsWith('estimated:')),
    withoutEstimatedRecurring:{ending:confirmed.ending,min:confirmed.min,minDate:confirmed.minDate},
    analysis};
}
