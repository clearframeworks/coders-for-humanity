import {isValidDate} from './engine.mjs';
import {estimateSpending} from './spending-plan.mjs';
import {projectForecast} from './projection.mjs';

const cents=value=>Math.round(value*100);
const dollars=value=>value/100;
const summary=(model,opening)=>({ending:model.ending,min:model.min,minDate:model.minDate,income:model.income,expenses:dollars(cents(model.bills)+cents(model.everyday)+cents(model.scenarioTotal||0)),netSavings:dollars(cents(model.ending)-cents(opening))});

/** Compare the same dated projection with explicit hypothetical changes only.
 * Reduction percentages apply to routine purchases, never irregular bulk costs.
 */
export function compareTrends(state,{targetDate,diningReductionPercent=0,shoppingReductionPercent=0,excludedRenewalKeys=[]}={}){
  if(!state?.plan||!isValidDate(state.plan.startDate)||!Array.isArray(state.transactions))throw Error('Use a saved plan and transaction history for this comparison.');
  if(!isValidDate(targetDate))throw Error('Choose a valid comparison target date.');
  const horizon=Math.round((Date.parse(targetDate)-Date.parse(state.plan.startDate))/86400000)+1;
  if(horizon<1||horizon>180)throw Error('Choose a target from the forecast start through its next 179 days.');
  for(const value of [diningReductionPercent,shoppingReductionPercent])if(!Number.isFinite(value)||value<0||value>100)throw Error('Choose spending reductions from 0 to 100 percent.');
  if(!Array.isArray(excludedRenewalKeys)||excludedRenewalKeys.length>1000||excludedRenewalKeys.some(key=>typeof key!=='string'||!key||key.length>5000))throw Error('Choose valid recurring-charge comparison keys.');
  const projectedState={...state,plan:{...state.plan,horizon}};
  const analysis=estimateSpending(state.transactions,state.plan);
  const baselineModel=projectForecast(projectedState,null);
  const groups=[['Dining',diningReductionPercent],['Shopping',shoppingReductionPercent]].map(([name,percent])=>{
    const routineTotal=analysis?.groups.find(group=>group.name===name)?.routine||0;
    return{name,percent,routineTotal,dailyReduction:analysis?dollars(Math.round(cents(routineTotal)*percent/100/analysis.days)):0};
  });
  const baselineDaily=cents(baselineModel.routineDaily??state.plan.dailySpend);
  const dailyReduction=dollars(Math.min(baselineDaily,groups.reduce((sum,group)=>sum+cents(group.dailyReduction),0)));
  const candidates=(baselineModel.analysis?.subscriptions||[]).filter(candidate=>candidate.date&&candidate.repeat&&!candidate.reviewOnly);
  const keys=[...new Set(excludedRenewalKeys)];
  if(keys.some(key=>!candidates.some(candidate=>candidate.key===key&&candidate.date&&candidate.repeat&&!candidate.reviewOnly)))throw Error('Choose a dated recurring-charge candidate available in this forecast.');
  const changedModel=projectForecast(projectedState,null,{dailyReduction,excludedRenewalKeys:keys});
  return{targetDate,horizon,baseline:summary(baselineModel,state.plan.balance),changed:summary(changedModel,state.plan.balance),improvement:dollars(cents(changedModel.ending)-cents(baselineModel.ending)),dailyReduction,groups,candidates,excludedRenewalKeys:keys,analysisWindow:analysis?{start:analysis.start,end:analysis.end,days:analysis.days}:null,assumptions:[
    'Both outcomes start with the same saved balances, pay schedule and confirmed bills. Potential net savings excludes opening cash and is not an actual deposit.',
    'Spending reductions apply only to observed routine Dining and Shopping purchases; large irregular purchases are not reduced.',
    'Each category reduction is rounded to daily cents, then their combined reduction is capped at the forecast routine spending amount.',
    'Recurring-charge exclusions are hypothetical. Their effect occurs only on projected charge dates; this does not cancel a service or establish that it is cancellable.',
    'History coverage is incomplete. Unplanned purchases, missing cash spending, changed income or changed bills can change either outcome.'
  ]};
}
