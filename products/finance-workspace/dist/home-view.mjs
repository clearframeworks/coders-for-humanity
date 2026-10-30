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

export function mountHomeView({getState,navigate,onSetup,onExample}){
  const setup=()=>onSetup?onSetup():document.querySelector('#edit-top')?.click();
  const explore=()=>onExample?onExample():document.querySelector('#view-example')?.click();
  function bind(root){
    root.querySelector('[data-home-action="setup"]')?.addEventListener('click',setup);
    root.querySelector('[data-home-action="example"]')?.addEventListener('click',explore);

    root.querySelectorAll('a[href^="#"]').forEach((link,index)=>{
      link.id='home-link-'+index;
      link.addEventListener('click',event=>{
        if(!navigate||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
        const [page,tab]=link.getAttribute('href').slice(1).split('/');
        event.preventDefault();navigate(page,tab);
      });
    });
  }
  function render(){
    const root=document.querySelector('#page-home');if(!root)return;
    const state=getState();
    if(needsPlanSetup(state)){
      const records=state.transactions?.length||0;
      root.innerHTML=`<section class="home-welcome" aria-labelledby="home-welcome-heading">
        <div class="home-welcome-intro"><p class="eyebrow">YOUR MONEY, YOUR PLAN</p><h1 id="home-welcome-heading">Know what's ahead.<br>Start with what you have.</h1>
        <p class="home-welcome-lead">Bring your balance, paydays and bills together. See how the timing could affect your money before making a commitment.</p>
        ${records?`<p class="home-records-note">Your ${records.toLocaleString()} imported transaction${records===1?' is':'s are'} still here. Add your current balance and upcoming payments to build a forecast.</p>`:''}
        <div class="home-start-actions"><button type="button" id="home-start-plan" class="button primary" data-home-action="setup">Set up my plan</button><button type="button" id="home-explore-example" class="button" data-home-action="example">Explore an example</button></div>
        <p class="quiet-note">No bank connection or AI required. You can change your inputs later.</p></div>
        <div class="home-welcome-guide"><h2>A few things to get started</h2><dl><div><dt>Available money</dt><dd>The balances you can spend, and the date they were checked.</dd></div><div><dt>Paydays and bills</dt><dd>Expected amounts, dates and how often they repeat.</dd></div><div><dt>Everyday costs</dt><dd>An estimate for daily spending and a cushion you want to keep.</dd></div></dl><p>Want to look around first? The example uses fictional amounts and can be replaced with your own plan.</p></div>
      </section>`;
      bind(root);return;
    }
    const model=buildHomeModel(state),week=model.week,outlook=model.outlook;
    const shortfall=outlook&&outlook.lowestBalance<0;
    const cushionGap=outlook&&!shortfall&&state.plan.cushion>outlook.lowestBalance;
    const date=value=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(value+'T12:00:00'));
    root.innerHTML=`<div class="page-heading home-heading"><div><p class="eyebrow">YOUR PLAN AT A GLANCE</p><h1>Your money ahead</h1><p>The next few days, with your plans in view.</p></div></div>
      <div class="home-snapshot"><div><span>Saved balance</span><strong>${money(model.snapshotBalance)}</strong><span>as of <time datetime="${esc(model.snapshotDate)}">${esc(date(model.snapshotDate))}</time></span></div><a class="text-button" href="#accounts">Review balances</a></div>
      <div class="home-overview">
        <section id="home-outlook" class="home-focus ${shortfall?'has-shortfall':cushionGap?'has-cushion-gap':''}" aria-labelledby="home-outlook-heading">
          ${outlook?`<p class="home-risk-label">${shortfall?'Possible shortfall':cushionGap?'Below your cushion':'Based on your saved plan'}</p><h2 id="home-outlook-heading">Lowest projected balance</h2><p class="home-period">${esc(date(model.windowStart))} – ${esc(date(model.upcomingEnd))}</p><strong class="home-primary-amount">${money(outlook.lowestBalance)}</strong><p class="home-low-date">On ${esc(date(outlook.minDate))}</p>${shortfall?'<p class="home-risk-description">Your planned costs could take the balance below zero before this period ends.</p>':cushionGap?`<p class="home-risk-description">This is below the ${money(state.plan.cushion)} cushion in your plan.</p>`:'<p class="home-risk-description">This is a projection, not a newly checked bank balance.</p>'}<a class="text-button" href="#forecast/calendar">Open calendar →</a>`:`<h2 id="home-outlook-heading">Review your balance date</h2><p>${esc(week.reason||'The saved plan does not cover this period.')}</p><a class="button" href="#accounts">Review balances and dates</a>`}
        </section>
        <section id="home-week" class="home-week-panel" aria-labelledby="home-week-heading"><div class="section-heading"><h2 id="home-week-heading">${model.futureStart?'First seven planned days':'Next seven days'}</h2><a class="text-button" href="#forecast/compare">Try a change →</a></div><p class="home-period">${esc(date(model.windowStart))} – ${esc(date(model.windowEnd))}${model.futureStart?' · Your plan starts after today.':''}</p>
          ${week.available?`<dl class="home-week-totals"><div><dt>Expected income</dt><dd class="positive">${money(week.income)}</dd></div><div><dt>Planned costs</dt><dd>${money(week.expenses)}</dd></div></dl><div class="home-week-ending"><span>Projected balance after these seven days</span><strong>${money(week.endingBalance)}</strong></div><details id="home-week-breakdown" class="home-cost-breakdown"><summary>What's included in costs?</summary><dl class="purchase-facts"><div><dt>Everyday spending</dt><dd>${money(week.routine)}</dd></div><div><dt>Fixed / scheduled bills</dt><dd>${money(week.confirmedBills)}</dd></div><div><dt>Tentative recurring charges</dt><dd>${money(week.estimatedRecurring)}</dd></div></dl><p class="quiet-note">Everyday costs and dated bills are counted separately, once. Unplanned purchases can add costs.</p></details>`:`<p role="status">${esc(week.reason)}</p>`}
        </section>
      </div>
      <section id="home-charges" class="content-panel home-section" aria-labelledby="home-charges-heading"><div class="section-heading"><div><h2 id="home-charges-heading">Upcoming payments & paydays</h2><p class="home-period">Through ${esc(date(model.upcomingEnd))} · Scheduled dates, not posted transactions</p></div><a class="text-button" href="#forecast/calendar">See all upcoming →</a></div>
        ${model.upcoming.length?`<ul class="home-event-list">${model.upcoming.slice(0,5).map(event=>`<li><time datetime="${esc(event.date)}"><span>${esc(new Intl.DateTimeFormat('en-US',{month:'short'}).format(new Date(event.date+'T12:00:00')))}</span><strong>${Number(event.date.slice(-2))}</strong></time><div class="home-event-description"><strong>${esc(event.name)}</strong><span>${event.estimated?'Tentative recurring charge':event.type==='income'?'Expected income':'Planned bill'} · ${esc(date(event.date))}</span></div><strong class="home-event-amount ${event.type==='income'?'positive':''}">${event.type==='income'?'+':'−'}${money(event.amount)}</strong></li>`).join('')}</ul>${model.upcoming.length>5?`<p class="quiet-note">Showing the next 5 of ${model.upcoming.length} scheduled items.</p>`:''}`:`<div class="home-no-events"><p>${week.available?'No scheduled payments in this window. Everyday spending still applies.':'Review your saved plan date to see upcoming payments.'}</p><a class="button" href="#bills">Add bill or income</a></div>`}
      </section>
      <section id="home-monthly" class="content-panel home-section" aria-labelledby="home-monthly-heading"><div class="section-heading"><div><h2 id="home-monthly-heading">Further ahead</h2><p>Income minus costs is a projected surplus or shortfall, not money already saved.</p></div><a class="text-button" href="#forecast/monthly">Monthly projections →</a></div>
        ${model.months.length?`<ul class="home-month-list">${model.months.map(month=>`<li><div class="home-month-name"><strong>${esc(monthName(month.month))}</strong><small>${esc(date(month.startDate))} – ${esc(date(month.endDate))}${month.partial?' · Partial month':''}</small></div><dl><div><dt>Projected ${month.netSavings<0?'shortfall':'surplus'}</dt><dd class="${month.netSavings<0?'negative':''}">${money(month.netSavings)}</dd></div><div><dt>Funds at month end</dt><dd>${money(month.endingBalance)}</dd></div></dl></li>`).join('')}</ul>`:'<p>No monthly projection remains within this plan. Review your saved balance date.</p>'}
      </section>
      ${model.savings.length?`<section id="home-save" class="content-panel home-section" aria-labelledby="home-save-heading"><div class="section-heading"><h2 id="home-save-heading">Ways to make room</h2><a class="text-button" href="#spending/opportunities">Review spending options →</a></div>${model.savings.slice(0,2).map(suggestion=>`<div class="saving-row"><div><h3>${esc(suggestion.name)}</h3><p>${esc(suggestion.basis)}</p></div><div><strong>About ${money(suggestion.weeklyReduction)} less in these seven days</strong><a class="text-button" href="#spending/opportunities">Explore this change →</a></div></div>`).join('')}<p class="quiet-note">One scenario at a time. These estimates are not additive or guaranteed.</p></section>`:''}
      <p class="home-basis-note">${esc(model.limitations[0])} <a href="#spending/categories">Review recorded spending</a>.</p>`;
    bind(root);
  }
  return {render};
}

/** A completed zero-dollar plan is different from untouched defaults. Imported
 * history alone does not establish a current balance or future obligations. */
export function needsPlanSetup(state){
  const plan=state?.plan;
  return state?.mode!=='example'&&!!plan&&plan.setupComplete!==true&&plan.balance===0&&plan.dailySpend===0&&!plan.paychecks?.length&&!plan.bills?.length;
}
