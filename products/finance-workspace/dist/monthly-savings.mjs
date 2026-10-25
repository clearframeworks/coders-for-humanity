import {addDays,isValidDate} from './engine.mjs';
import {projectForecast} from './projection.mjs';

const DAY_MS=86400000;
const cents=value=>Math.round(value*100);
const dollars=value=>value/100;
function monthEnd(date,offset=0){
  const first=new Date(date.slice(0,7)+'-01T00:00:00Z');
  first.setUTCMonth(first.getUTCMonth()+offset+1);first.setUTCDate(0);
  return first.toISOString().slice(0,10);
}

/** Potential monthly surplus from the same daily forecast, never a savings
 * transfer or a claim about actual saved money. Opening cash is carried once.
 */
export function projectMonthlySavings(state,{months=6}={}){
  if(!state?.plan||!isValidDate(state.plan.startDate))throw Error('Choose a valid forecast starting date.');
  if(!Number.isInteger(months)||months<1||months>6)throw Error('Choose one to six calendar months.');
  const startDate=state.plan.startDate,requestedEndDate=monthEnd(startDate,months-1);
  const requestedHorizon=Math.round((Date.parse(requestedEndDate)-Date.parse(startDate))/DAY_MS)+1;
  const horizon=Math.min(180,requestedHorizon),endDate=addDays(startDate,horizon-1);
  const model=projectForecast({...state,plan:{...state.plan,horizon}},null);
  const estimated=new Map();
  for(const event of model.estimatedRecurringEvents||[]){
    if(event.type!=='bill')continue;
    estimated.set(event.date,(estimated.get(event.date)||0)+cents(event.amount));
  }
  const grouped=new Map();
  for(const day of model.days){
    const month=day.date.slice(0,7);
    if(!grouped.has(month))grouped.set(month,{month,startDate:day.date,endDate:day.date,income:0,confirmedBills:0,estimatedRecurring:0,routine:0,expenses:0,openingBalance:cents(day.startBalance),endingBalance:cents(day.balance),lowestBalance:Math.min(cents(day.startBalance),cents(day.lowBalance))});
    const row=grouped.get(month),estimatedToday=estimated.get(day.date)||0;
    row.endDate=day.date;row.income+=cents(day.income);row.confirmedBills+=cents(day.bills)-estimatedToday;row.estimatedRecurring+=estimatedToday;row.routine+=cents(day.everyday);row.expenses+=cents(day.expenses);row.endingBalance=cents(day.balance);row.lowestBalance=Math.min(row.lowestBalance,cents(day.lowBalance));
  }
  const result=[...grouped.values()].map(row=>({month:row.month,startDate:row.startDate,endDate:row.endDate,partial:row.startDate!==row.month+'-01'||row.endDate!==monthEnd(row.startDate),income:dollars(row.income),confirmedBills:dollars(row.confirmedBills),estimatedRecurring:dollars(row.estimatedRecurring),routine:dollars(row.routine),expenses:dollars(row.expenses),netSavings:dollars(row.income-row.expenses),openingBalance:dollars(row.openingBalance),endingBalance:dollars(row.endingBalance),lowestBalance:dollars(row.lowestBalance)}));
  return{months:result,startDate,endDate,requestedEndDate,horizon,truncated:horizon<requestedHorizon,startingBalance:state.plan.balance,totalNetSavings:dollars(result.reduce((sum,row)=>sum+cents(row.netSavings),0)),endingBalance:model.ending,lowestBalance:model.min,limitations:[
    'Net savings means projected income minus projected expenses, not money already saved or transferred. Opening balances are carried separately.',
    'The first calendar month may be partial. Negative balances carry into following months; payday counts follow their real scheduled dates.',
    'Estimated recurring charges remain provisional. Unscheduled bulk purchases, missing cash spending and other unplanned expenses can reduce these surpluses.',
    'Balances use the saved plan snapshot and its starting date; they are not newly verified bank balances.',
    ...(horizon<requestedHorizon?['The projection is capped at 180 days, so the final calendar month is partial.']:[])
  ]};
}
