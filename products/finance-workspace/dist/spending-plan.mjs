import {addDays,isValidDate} from './engine.mjs';
import {normalizeMerchant,detectRecurring} from './planning.mjs';

const GROUPS=['Groceries','At work','Dining','Transport','Cannabis/THC','Tobacco','Subscriptions','Shopping','Activities','Fees','Miscellaneous'];
const cents=value=>Math.round(value*100);
const dollars=value=>value/100;
const median=values=>{const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};
const posted=row=>row.pending!==true&&!/^(?:pending|waiting_on_recipient|failed)$/i.test(String(row.status||''));
const valid=row=>row&&posted(row)&&isValidDate(row.date)&&typeof row.description==='string'&&Number.isFinite(row.amount);

const subscriptionMerchant=d=>/\brecurring\s*purchase\b|doordashdash|dashpass|amazon\s+prime|\bnetflix\b|\bspotify\b|\bopenai\b|\banthropic\b|google\s+workspace|name.?cheap/.test(d);
/** Imported categories remain user-owned; grouping suggestions never overwrite them. */
export function categoryForHistory(row) { return row.category; }

// These planning groups never overwrite the original transaction categories.
export function spendingGroup(row) {
  const d=String(row.description||'').toLowerCase(),category=String(row.category||'');
  if(category==='Fees'||/\bfees?\b/.test(d))return 'Fees';
  if(category==='At work')return 'At work';
  if(['Cannabis','Cannabis/THC'].includes(category)||/\b(?:thc|cannabis|weed)\b/.test(d))return 'Cannabis/THC';
  if(category==='Tobacco'||/\btobacco\b|\bsmoke\s*shop\b|\bvape\b|\bcigarettes?\b|\bcigars?\b/.test(d))return 'Tobacco';
  if(/\b(?:facebook|facebk|meta\s+ads)\b/.test(d))return 'Miscellaneous';
  if(category==='Subscriptions'||subscriptionMerchant(d))return 'Subscriptions';
  if(category==='Groceries'||/kroger|\baldi\b|food\s+lion|trader\s+joe|whole\s+foods|publix|\bgrocer(?:y|ies)\b|\bformula\b|diapers|wipes/.test(d))return 'Groceries';
  if(category==='Dining'||/restaurant|coffee|cafe|pizza|doordash|uber.?eats|starbucks|mcdonald|wendy|taco\s+bell|burger\s+king/.test(d))return 'Dining';
  if(category==='Transport'||/\bgas\s*station\b|\bfuel\b/.test(d)||/\btransit\b|\bparking\b|\buber\b|\blyft\b/.test(d))return 'Transport';
  if(['Entertainment','Activities'].includes(category)||/\bguitar\b|poke.?\s?mon|microsoft\*?store|playstation|\bxbox\b|\bsteam\b|\bcinema\b|\bmovie\b/.test(d))return 'Activities';
  if(category==='Shopping'||/\bamazon\b|\btarget\b|\bwalmart\b|\bshopping\b/.test(d))return 'Shopping';
  return 'Miscellaneous';
}
function coveredByBills(row,plan) {
  const d=row.description.toLowerCase();
  const merchant=normalizeMerchant(row.description);
  return /rent.*electric.*internet/.test(d)||
    ((plan.bills||[]).some(b=>/phone/i.test(b.name))&&/straighttalk/.test(d))||
    (merchant&&(plan.bills||[]).some(b=>normalizeMerchant(b.name)===merchant));
}
function expenseKind(group,amount,threshold) {
  if(group==='Subscriptions')return 'subscriptions';
  if(threshold!==null&&amount>threshold)return 'oneOff';
  return 'routine';
}
function subscriptionsFor(rows,plan,asOf) {
  const proposals=detectRecurring(rows.map(row=>({...row,category:'Subscriptions'})),{...plan,bills:plan.bills||[],paychecks:plan.paychecks||[]},{asOf});
  const groups=new Map();
  for(const row of rows){const key=normalizeMerchant(row.description);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  const result=[];
  for(const [merchant,history]of groups){
    const candidate=proposals.find(p=>normalizeMerchant(p.name)===merchant);
    result.push(candidate||{key:'subscription-review:'+encodeURIComponent(merchant),name:merchant,amount:dollars(median(history.map(row=>cents(-row.amount)))),date:null,repeat:null,confidence:'tentative',reviewOnly:true,dateBasis:'posted_date',amountBasis:'observed_median',caution:'Too little consistent history to infer a renewal date. Review the charge before scheduling it.',evidence:{count:history.length,firstDate:history.map(r=>r.date).sort()[0],lastDate:history.map(r=>r.date).sort().at(-1)}});
  }
  return result;
}

/** Observed account overlap is evidence coverage, not proof every day is complete.
 * Routine amounts exclude confirmed bills, recurring charges and robust outliers.
 * Dated subscription candidates are returned separately for a provisional overlay.
 */
export function estimateSpending(transactions,plan,{asOf=plan.startDate,ledgerAsOf=asOf}={}) {
  if(!isValidDate(asOf))throw Error('Choose a valid analysis date.');
  if(!isValidDate(ledgerAsOf))throw Error('Choose a valid actual-ledger date.');
  const history=transactions.filter(valid);
  const sources=['cashapp','fifththird'].map(source=>{
    const dates=history.filter(t=>t.source===source&&t.date<=asOf).map(t=>t.date).sort();
    return dates.length?{source,first:dates[0],last:dates.at(-1)}:null;
  }).filter(Boolean);
  if(!sources.length)return null;
  const end=sources.map(s=>s.last).sort()[0];
  const start=[addDays(end,-29),...sources.map(s=>s.first)].sort().at(-1);
  if(start>end)return null;
  const days=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
  const groups=Object.fromEntries(GROUPS.map(name=>[name,{name,total:0,routine:0,count:0}]));
  let excluded=0,count=0;
  const eligible=[];
  for(const row of history){
    if(row.date<start||row.date>end||row.amount>=0||/^(?:transfer|transfers)$/i.test(String(row.category||'')))continue;
    const amount=cents(-row.amount);
    if(coveredByBills(row,plan)){excluded+=amount;continue;}
    eligible.push({row,amount,group:spendingGroup(row)});
  }
  const variable=eligible.filter(item=>item.group!=='Subscriptions').map(item=>item.amount);
  const center=variable.length?median(variable):0;
  const deviation=variable.length?median(variable.map(value=>Math.abs(value-center))):0;
  const threshold=variable.length>=5?Math.max(7500,3*center,center+3*deviation):null;
  const oneOffs=[],dailyHistory=[];
  for(let date=start;date<=end;date=addDays(date,1))dailyHistory.push({date,total:0,routine:0,oneOff:0,subscriptions:0});
  const byDate=new Map(dailyHistory.map(day=>[day.date,day]));
  let total=0,routine=0,subscriptionTotal=0,oneOffTotal=0;
  const subscriptionRows=[];
  for(const item of eligible){
    const {row,amount,group}=item,entry=groups[group],day=byDate.get(row.date);
    entry.total+=amount;entry.count++;count++;total+=amount;day.total+=amount;
    if(expenseKind(group,amount,threshold)==='subscriptions'){subscriptionRows.push(row);subscriptionTotal+=amount;day.subscriptions+=amount;}
    else if(expenseKind(group,amount,threshold)==='oneOff'){oneOffTotal+=amount;day.oneOff+=amount;oneOffs.push({date:row.date,description:row.description,amount:dollars(amount),group,reason:'Above the robust large-purchase threshold; future repetition is unknown.'});}
    else{routine+=amount;entry.routine+=amount;day.routine+=amount;}
  }
  const perWeek=value=>Math.round(value*7/days)/100;
  const resultGroups=GROUPS.map(name=>{const g=groups[name];return{...g,total:dollars(g.total),routine:dollars(g.routine),weekly:perWeek(g.total),routineWeekly:perWeek(g.routine),daily:Math.ceil(g.routine/days)/100};});
  const savings=[];
  for(const name of ['At work','Tobacco','Dining']){
    const value=groups[name].routine;
    if(value)savings.push({name:'Halve '+name.toLowerCase(),kind:'scenario',weekly:Math.round(value*7/days/2)/100,monthly:Math.round(value*7/days/2*52/12)/100,basis:'Half of observed routine '+name.toLowerCase()+' spending during this coverage window.',description:'A spending reduction scenario, not a guaranteed saving.'});
  }
  if(subscriptionTotal)savings.push({name:'Review recurring charges',kind:'review',weekly:null,monthly:null,observedWeekly:perWeek(subscriptionTotal),observedMonthly:Math.round(subscriptionTotal*7/days*52/12)/100,basis:'Observed recurring charges, kept outside routine daily spending.',description:'Confirm which services remain useful and which can be changed; this is not an assumption that every charge is cancellable.'});
  if(groups.Fees.total)savings.push({name:'Review avoidable fees',kind:'review',weekly:null,monthly:null,observedWeekly:perWeek(groups.Fees.total),basis:'Fees actually recorded in the coverage window.',description:'Check the cause of these fees; no automatic saving is assumed.'});
  // This separate ledger retains all known posted outflows after shared
  // coverage ends. Only dates with actual outflows are emitted, never zeros
  // invented for missing account data. It does not alter the baseline rate.
  const recentDays=new Map();
  for(const row of history){
    if(row.date<start||row.date>ledgerAsOf||row.amount>=0||/^(?:transfer|transfers)$/i.test(String(row.category||'')))continue;
    const amount=cents(-row.amount);
    if(!recentDays.has(row.date))recentDays.set(row.date,{date:row.date,total:0,routine:0,oneOff:0,subscriptions:0,bills:0,partialCoverage:row.date>end});
    const day=recentDays.get(row.date);day.total+=amount;
    const kind=coveredByBills(row,plan)?'bills':expenseKind(spendingGroup(row),amount,threshold);
    day[kind]+=amount;
  }
  const recentDailyHistory=[...recentDays.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(day=>({...day,total:dollars(day.total),routine:dollars(day.routine),oneOff:dollars(day.oneOff),subscriptions:dollars(day.subscriptions),bills:dollars(day.bills)}));
  return{start,end,days,sources,count,excluded:dollars(excluded),total:dollars(total),daily:Math.ceil(routine/days)/100,rawDaily:Math.ceil(total/days)/100,routineTotal:dollars(routine),weeklyRoutine:perWeek(routine),subscriptionTotal:dollars(subscriptionTotal),oneOffTotal:dollars(oneOffTotal),oneOffThreshold:threshold===null?null:dollars(threshold),outlierMethod:{minimumPurchases:5,floor:75,median:dollars(center),medianAbsoluteDeviation:dollars(deviation),rule:'For at least 5 variable purchases: max($75, 3 × median, median + 3 × median absolute deviation). Strictly larger purchases are separated, not erased.'},groups:resultGroups,purchases:eligible.map(({row,amount,group})=>({id:row.id,date:row.date,description:row.description,amount:dollars(amount),group})),oneOffs,subscriptions:subscriptionsFor(subscriptionRows,plan,asOf),savings,dailyHistory:dailyHistory.map(day=>({...day,total:dollars(day.total),routine:dollars(day.routine),oneOff:dollars(day.oneOff),subscriptions:dollars(day.subscriptions)})),recentDailyHistory,ledgerAsOf,activeDays:dailyHistory.filter(day=>day.total>0).length,cashResidual:null,limitations:['Routine daily spending excludes confirmed bills, recurring charges and identified large purchases; those costs still need separate consideration.','Dated recurring proposals are tentative overlays, not confirmed bills. Usage charges and uncertain renewals have no guessed due date.','The window uses overlapping observed account dates; zero-record days and the most recent missing days are not proven zero-spend days.','Unknown opening balances, savings and transfers prevent measuring an exact cash-spending residual.','A large-purchase threshold does not prove a purchase will never recur. Transfers to the bank are excluded, not treated as cash purchases.']};
}
