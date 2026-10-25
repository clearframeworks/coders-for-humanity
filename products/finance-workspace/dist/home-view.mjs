import {addDays,isValidDate} from './engine.mjs';
import {currentLedgerDate,projectForecast} from './projection.mjs';
import {projectMonthlySavings} from './monthly-savings.mjs';
import {estimateSpending} from './spending-plan.mjs';

const cents=value=>Math.round(value*100);
const sum=(rows,field)=>rows.reduce((total,row)=>total+cents(row[field]||0),0)/100;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
const monthName=value=>new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(new Date(value+'-15T12:00:00'));

/** A home-page view of existing models. It never changes the saved forecast. */
export function buildHomeModel(state,{asOf=currentLedgerDate()}={}){
  if(!isValidDate(asOf)||!isValidDate(state?.plan?.startDate))throw Error('Choose valid home and balance snapshot dates.');
  const snapshotDate=state.plan.startDate,windowStart=asOf<snapshotDate?snapshotDate:asOf,windowEnd=addDays(windowStart,6);
  const requestedHorizon=Math.round((Date.parse(windowEnd)-Date.parse(snapshotDate))/86400000)+1;
  const requestedUpcomingEnd=addDays(windowStart,13),limitEnd=addDays(snapshotDate,179);
  const upcomingEnd=requestedHorizon>180?requestedUpcomingEnd:requestedUpcomingEnd>limitEnd?limitEnd:requestedUpcomingEnd;
  const analysis=estimateSpending(state.transactions,state.plan,{ledgerAsOf:asOf});
  const monthly=projectMonthlySavings(state);
  const months=monthly.months.filter(row=>row.endDate>=windowStart).slice(0,3);
  const history=analysis?{start:analysis.start,end:analysis.end,activeDays:analysis.activeDays,days:analysis.days,routineDaily:analysis.daily,groups:analysis.groups.filter(group=>group.total>0).map(group=>({name:group.name,total:group.total,routineWeekly:group.routineWeekly}))}:null;
  const limitations=[
    'All balances and projections begin with the saved balance snapshot; they are not newly verified bank balances.',
    'Potential savings means projected income minus costs. It is not money already saved or transferred.',
    'Routine spending, confirmed bills and dated tentative renewals are counted separately. Unscheduled bulk purchases and unmeasured cash spending can add costs.',
    ...(analysis?[`History baseline: ${analysis.start}–${analysis.end}; ${analysis.activeDays} days have records out of ${analysis.days}. Missing records do not prove no spending.`]:['No supported purchase history is available; routine costs use the saved daily estimate.'])
  ];
  const result={asOf,snapshotDate,snapshotBalance:state.plan.balance,windowStart,windowEnd,upcomingEnd,futureStart:asOf<snapshotDate,months,history,outlook:null,upcoming:[],savings:[],limitations};
  if(requestedHorizon>180)return {...result,week:{available:false,reason:'These seven days are beyond the 180-day projection limit. Review the saved balance date and plan before using a new forecast.'}};
  const horizon=Math.round((Date.parse(upcomingEnd)-Date.parse(snapshotDate))/86400000)+1;
  const extended={...state,plan:{...state.plan,horizon}};
  const model=projectForecast(extended,null,{ledgerAsOf:asOf});
  const outlookDays=model.days.filter(day=>day.date>=windowStart&&day.date<=upcomingEnd);
  const lowestDay=outlookDays.reduce((lowest,day)=>day.lowBalance<lowest.lowBalance?day:lowest);
  const outlook={lowestBalance:lowestDay.lowBalance,minDate:lowestDay.date};
  const days=model.days.filter(day=>day.date>=windowStart&&day.date<=windowEnd);
  if(days.length!==7)return {...result,week:{available:false,reason:'A full seven-day forecast is not available for these dates.'}};
  const events=model.events.filter(event=>event.date>=windowStart&&event.date<=upcomingEnd&&event.type!=='everyday');
  const estimated=events.filter(event=>event.date<=windowEnd&&event.type==='bill'&&event.id.startsWith('estimated:'));
  const estimatedRecurring=sum(estimated,'amount'),bills=sum(days,'bills');
  const week={available:true,routine:sum(days,'everyday'),confirmedBills:(cents(bills)-cents(estimatedRecurring))/100,estimatedRecurring,expenses:sum(days,'expenses'),income:sum(days,'income'),net:(cents(sum(days,'income'))-cents(sum(days,'expenses')))/100,openingBalance:days[0].startBalance,endingBalance:days.at(-1).balance,lowestBalance:Math.min(...days.map(day=>day.lowBalance))};
  const upcoming=events.map(event=>({id:event.id,date:event.date,name:event.name,type:event.type,amount:event.amount,estimated:event.id.startsWith('estimated:')}));
  const savings=(analysis?.savings||[]).filter(suggestion=>suggestion.kind==='scenario'&&suggestion.weekly>0).map(suggestion=>{
    const dailyReduction=suggestion.weekly/7;
    const changed=projectForecast(extended,null,{dailyReduction,ledgerAsOf:asOf});
    const changedDays=changed.days.filter(day=>day.date>=windowStart&&day.date<=windowEnd);
    return{name:suggestion.name,basis:suggestion.basis,description:suggestion.description,dailyReduction,weeklyReduction:Math.max(0,cents(week.expenses)-cents(sum(changedDays,'expenses')))/100};
  }).filter(suggestion=>suggestion.weeklyReduction>0);
  return {...result,week,outlook,upcoming,savings};
}

export function mountHomeView({getState,navigate}){
  function render(){
    const root=document.querySelector('#page-home');if(!root)return;
    const model=buildHomeModel(getState()),week=model.week;
    root.innerHTML=`<div class="page-heading"><div><p class="eyebrow">YOUR PLAN AT A GLANCE</p><h1>Your money ahead</h1><p>What may be left, what is coming up and where you could make room.</p></div></div>
      <div class="workspace-context"><p>Saved balance snapshot · ${esc(model.snapshotDate)} <strong>${money(model.snapshotBalance)}</strong></p>${model.outlook?`<p>Lowest projected funds through ${esc(model.upcomingEnd)} <strong class="${model.outlook.lowestBalance<0?'negative':''}">${money(model.outlook.lowestBalance)}</strong> on ${esc(model.outlook.minDate)}${model.outlook.lowestBalance<0?' · Possible shortfall':''}</p>`:''}</div>
      <section id="home-monthly" class="content-panel"><div class="section-heading"><h2>Potential monthly savings</h2><a class="text-button" href="#forecast/monthly">See monthly projection →</a></div><p>Expected income minus projected costs, separate from the funds already in your accounts.</p>${model.months.length?`<div class="table-scroll"><table class="ledger-table mobile-records"><thead><tr><th>Month</th><th>Potential savings</th><th>Projected funds at month end</th></tr></thead><tbody>${model.months.map(month=>`<tr><td data-label="Month"><strong>${esc(monthName(month.month))}</strong><small>${esc(month.startDate)}–${esc(month.endDate)}${month.partial?' · Partial month':''}</small></td><td data-label="Potential savings" class="${month.netSavings<0?'negative':''}">${money(month.netSavings)}</td><td data-label="Funds at month end">${money(month.endingBalance)}</td></tr>`).join('')}</tbody></table></div>`:'<p>No future monthly projection remains within the saved plan’s forecast window.</p>'}<p class="quiet-note">Projected surpluses are not deposits into savings. Missing cash costs and unplanned bulk purchases can reduce them.</p></section>
      <section id="home-week" class="content-panel"><div class="section-heading"><h2>${model.futureStart?'First seven planned days':'Next seven days'}</h2><a class="text-button" href="#forecast/compare">Try a change →</a></div><p>${esc(model.windowStart)}–${esc(model.windowEnd)}${model.futureStart?' · Your saved plan starts after today.':''}</p>${week.available?`<div class="flow-summary"><div><span>Expected costs</span><strong>${money(week.expenses)}</strong></div><div><span>Expected income</span><strong>${money(week.income)}</strong></div></div><div id="home-week-breakdown" class="home-cost-breakdown"><h3>Daily spending and bills, separately</h3><dl class="purchase-facts"><div><dt>Daily spending estimate · excludes bills</dt><dd>${money(week.routine)}</dd></div><div><dt>Fixed / scheduled bills</dt><dd>${money(week.confirmedBills)}</dd></div><div><dt>Tentative recurring charges</dt><dd>${money(week.estimatedRecurring)}</dd></div></dl><p>Daily spending excludes recognized bills and recurring charges. Each dated charge is added separately, once. Bulk purchases and undated renewals need additional room.</p></div>`:`<p role="status">${esc(week.reason)}</p>`}</section>
      <section id="home-charges" class="content-panel"><div class="section-heading"><h2>Upcoming payments & paydays</h2><a class="text-button" href="#forecast/calendar">See what’s due →</a></div><p>${esc(model.windowStart)}–${esc(model.upcomingEnd)} · Planned dates, not posted transactions. Upcoming dates extend beyond the seven-day cost estimate.</p>${model.upcoming.length?`<ul class="home-upcoming">${model.upcoming.map(event=>`<li><span>${esc(event.date)} · ${esc(event.name)}${event.estimated?' · Tentative':event.type==='income'?' · Expected income':' · Planned bill'}</span><strong>${event.type==='income'?'+':'−'}${money(event.amount)}</strong></li>`).join('')}</ul>`:`<p>${week.available?'No dated bills or paydays in this upcoming window. Routine purchases still apply.':'Review the saved plan date to see upcoming payments.'}</p>`}</section>
      <section id="home-save" class="content-panel"><div class="section-heading"><h2>Ways to make room this week</h2><a class="text-button" href="#spending/opportunities">Review opportunities →</a></div>${model.savings.length?model.savings.map(suggestion=>`<div class="saving-row"><div><h3>${esc(suggestion.name)}</h3><p>${esc(suggestion.basis)}</p></div><div><strong>About ${money(suggestion.weeklyReduction)} less in these seven days</strong><p>One scenario at a time; these amounts are not additive or guaranteed.</p><a class="text-button" href="#spending/opportunities">See savings options →</a></div></div>`).join(''):'<p>No evidence-based routine reduction scenario is available for this window. Review recorded spending before choosing a target.</p>'}<details id="home-history-basis"><summary>What does your history suggest?</summary>${model.history?`<p>${esc(model.history.start)}–${esc(model.history.end)} · ${model.history.activeDays} days with records out of ${model.history.days}. Recent account coverage can be incomplete.</p><p>${money(model.history.routineDaily)} per day is the routine history estimate, excluding confirmed bills, recurring charges and identified large purchases.</p><ul>${model.history.groups.filter(group=>group.routineWeekly>0).map(group=>`<li>${esc(group.name)} · ${money(group.routineWeekly)} routine purchases per week at the observed pace</li>`).join('')}</ul>`:'<p>No supported spending history yet. The forecast uses your saved daily amount.</p>'}<a class="text-button" href="#spending/categories">See recorded spending →</a></details></section>
      <p class="quiet-note">${esc(model.limitations[0])} <a href="#accounts">Review balances and dates</a></p>`;
    root.querySelectorAll('a[href^="#"]').forEach((link,index)=>{link.id='home-link-'+index;link.addEventListener('click',event=>{if(!navigate||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const [page,tab]=link.getAttribute('href').slice(1).split('/');event.preventDefault();navigate(page,tab);});});
  }
  return {render};
}
