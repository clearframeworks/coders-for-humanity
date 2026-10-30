import {addDays} from './engine.mjs';
import {recordId} from './client-utils.mjs';
import {getCheckpoint,listSchedules,detectRecurring} from './planning.mjs';
import {estimateSpending} from './spending-plan.mjs';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const miniMoney=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n);
const dateText=d=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(d+'T12:00:00'));
const repeats={once:'One time',weekly:'Weekly',biweekly:'Every 2 weeks',monthly:'Monthly'};
const monthLabel=m=>new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(new Date(m+'-15T12:00:00'));

export function mountPlanningViews(ctx){
  let selectedDay=null,month=null,view=window.matchMedia?.('(max-width: 700px)').matches?'list':'calendar',checkpointId=null,scheduleFilter='all',editing=null;
  $('#forecast-content').insertAdjacentHTML('afterbegin','<section id="checkpoint-panel" class="checkpoint-panel"></section>');
  $('#forecast-content .upcoming-section').insertAdjacentHTML('beforebegin',`<section id="calendar-section" class="calendar-section"><div class="section-heading calendar-toolbar"><div><p class="eyebrow">BILLS, PAYDAYS & THE DAYS BETWEEN</p><h2>Your cash-flow calendar</h2></div><div class="button-row"><div class="segmented" aria-label="Forecast view"><button id="view-calendar" class="selected" aria-pressed="true">Calendar</button><button id="view-list" aria-pressed="false">List</button></div><button class="button primary" id="calendar-add">+ Add income or expense</button></div></div><div id="calendar-content"><div class="calendar-topline"><div><h3 id="calendar-month"></h3><span>Closing balances · select a day for exact amounts</span></div><div class="month-controls"><button class="icon-button" id="calendar-prev" aria-label="Previous calendar month">‹</button><button class="button small" id="calendar-start">Start date</button><button class="icon-button" id="calendar-next" aria-label="Next calendar month">›</button></div></div><div class="calendar-weekdays" aria-hidden="true">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<span>${d}</span>`).join('')}</div><div id="calendar-grid" class="calendar-grid" role="group" aria-label="Forecast calendar days"></div><div id="day-details" class="day-details"></div></div></section>`);
  $('#main').insertAdjacentHTML('beforeend',`<section id="page-bills" class="page" hidden><div class="page-heading"><div><p class="eyebrow">KNOW WHAT’S COMING</p><h1>Bills & income</h1><p>One place for paydays, rent, subscriptions and planned costs.</p></div><button class="button primary" id="schedule-add">+ Add a schedule</button></div><div id="schedule-totals" class="schedule-totals"></div><div class="schedule-toolbar"><div class="segmented" aria-label="Schedule type"><button class="selected" data-schedule-filter="all">All</button><button data-schedule-filter="bill">Bills</button><button data-schedule-filter="income">Income</button></div><p>Dates and totals use your selected forecast period.</p></div><div id="schedule-list"></div><section class="recurring-section"><div class="section-heading"><div><p class="eyebrow">FROM YOUR TRANSACTION HISTORY</p><h2>Possible recurring payments</h2></div><span class="review-label">Review before adding</span></div><div id="recurring-list"></div></section></section>
  <section id="page-accounts" class="page" hidden><div class="page-heading"><div><p class="eyebrow">THE STARTING POINT</p><h1>Your accounts</h1><p>Bring your accounts and everyday spending together.</p></div><button class="button primary" id="bank-connect">Connect account</button></div><section id="statement-history" class="account-history content-panel" hidden></section><div class="accounts-plan-heading"><div><h2>Your running balances</h2><p>Saved balance snapshots. Email receipts update purchase history; they do not verify account balances.</p></div><button class="button" id="account-add-view">Add balance</button></div><div class="accounts-headline"><span>Calculated balance now</span><strong id="accounts-total"></strong><p id="accounts-date"></p></div><div id="accounts-list"></div><section class="account-history account-import-strip"><div><h2>Have a statement?</h2><p>Import a CSV to review earlier spending. Your forecast stays based on your entered balances and bills.</p></div><button class="button" id="accounts-import">Import statement</button></section><p class="quiet-note">Calculated balances use recorded activity since each starting balance. Missing purchases or deposits can make the bank balance different. New statements and matching emails count once.</p></section>`);
  document.body.insertAdjacentHTML('beforeend',`<dialog id="schedule-dialog"><form id="schedule-form"><div class="dialog-header"><div><p class="eyebrow">YOUR FORECAST INPUTS</p><h2 id="schedule-dialog-title">Add a schedule</h2></div><button class="icon-button" type="button" id="schedule-close" aria-label="Close schedule">×</button></div><p class="dialog-intro">This updates planned cash flow. Repeating entries change as a series; no money is moved or marked paid.</p><label>Type<select name="kind"><option value="bill">Expense or bill</option><option value="income">Paycheck or income</option></select></label><label class="schedule-name-field">Name<input name="name" maxlength="100" required placeholder="Rent, paycheck, electricity…"></label><div class="field-grid"><label>Amount ($)<input name="amount" type="number" min="0.01" max="100000000" step="0.01" required></label><label>Schedule starts on<input name="date" type="date" required></label></div><label class="schedule-repeat-field">Repeat<select name="repeat"><option value="once">One time</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option></select></label><p class="quiet-note">Combined funds are used for this forecast. Everyday spending is estimated separately; avoid listing the same cost twice.</p><p id="schedule-error" class="form-error" role="alert" hidden></p><div class="dialog-actions"><button class="button" type="button" id="schedule-cancel">Cancel</button><button class="button primary" type="submit">Save schedule</button></div></form></dialog>`);
  const bankView=mountBankConnections(ctx);
  const setView=v=>{view=v;renderCalendar()};
  $('#view-calendar').onclick=()=>setView('calendar');$('#view-list').onclick=()=>setView('list');
  $('#calendar-prev').onclick=()=>moveMonth(-1);$('#calendar-next').onclick=()=>moveMonth(1);
  $('#calendar-start').onclick=()=>selectDay(ctx.getModel().startDate);
  $('#calendar-add').onclick=()=>openSchedule(null,selectedDay);$('#schedule-add').onclick=()=>openSchedule();
  $('#account-add-view').onclick=()=>{ctx.openPlan();$('#add-account').click()};
  $('#accounts-import').onclick=()=>{location.hash='transactions';$('#import-csv').click()};
  $$('[data-schedule-filter]').forEach(b=>b.onclick=()=>{scheduleFilter=b.dataset.scheduleFilter;renderSchedules()});
  $('#schedule-close').onclick=()=>$('#schedule-dialog').close();$('#schedule-cancel').onclick=()=>$('#schedule-dialog').close();
  $('#schedule-form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,kind=f.elements.kind.value,key=kind==='bill'?'bills':'paychecks';const next=structuredClone(ctx.getState());const entry={id:editing?.id||recordId(),name:f.elements.name.value.trim(),amount:Number(f.elements.amount.value),date:f.elements.date.value,repeat:f.elements.repeat.value};try{if(!entry.name)throw Error('Give this schedule a name.');if(editing){const i=next.plan[key].findIndex(s=>s.id===editing.id);if(i===-1)throw Error('This schedule changed. Close and reopen it before saving.');next.plan[key][i]=entry}else next.plan[key].push(entry);const basis=next.plan.forecastBasis;if(basis?.spendingMethod==='overlapping-history'&&next.plan.dailySpend===basis.estimatedDaily){const estimate=estimateSpending(next.transactions,next.plan);if(estimate){next.plan.dailySpend=estimate.daily;basis.estimatedDaily=estimate.daily}}await ctx.persist(next);$('#schedule-dialog').close();ctx.notice('Schedule saved. Your forecast and calendar have been updated.');}catch(err){$('#schedule-error').textContent=err.message;$('#schedule-error').hidden=false}};
  function selectDay(date){selectedDay=date;month=date.slice(0,7);ctx.onSelectedDate(date);renderCalendar()}
  function moveMonth(delta){const d=new Date(month+'-01T12:00:00');d.setMonth(d.getMonth()+delta);const target=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;const day=ctx.getModel().days.find(x=>x.date.startsWith(target));if(day)selectDay(day.date)}
  function openSchedule(item=null,date=selectedDay,kind='bill'){
    editing=item?.id?{id:item.id,kind:item.kind}:null;const f=$('#schedule-form');f.reset();f.elements.kind.value=item?.kind||kind;f.elements.kind.disabled=!!editing;f.elements.name.value=item?.name||'';f.elements.amount.value=item?.amount||'';f.elements.date.value=item?.date||date||ctx.getModel().startDate;f.elements.repeat.value=item?.repeat||'once';$('#schedule-dialog-title').textContent=editing?'Edit schedule':item?'Review recurring payment':'Add a schedule';$('#schedule-error').hidden=true;$('#schedule-dialog').showModal();
  }
  function renderCheckpoint(){
    const s=ctx.getState(),m=ctx.getModel(),available=s.plan.bills.filter(b=>m.events.some(e=>e.type==='bill'&&e.id===b.id));
    if(!available.length){$('#checkpoint-panel').hidden=true;return}$('#checkpoint-panel').hidden=false;
    if(!available.some(b=>b.id===checkpointId))checkpointId=(available.find(b=>/\brent\b/i.test(b.name))||available[0]).id;
    const c=getCheckpoint(s.plan,m,checkpointId);if(!c){$('#checkpoint-panel').hidden=true;return}
    $('#checkpoint-panel').innerHTML=`<div class="checkpoint-heading"><div><p class="eyebrow">PLAN AROUND A BILL</p><h2>Before ${esc(c.name)}</h2><p>${dateText(c.date)} · ${c.daysUntil} day${c.daysUntil!==1?'s':''} from your balance snapshot</p></div><label>Checkpoint<select id="checkpoint-choice">${available.map(b=>`<option value="${esc(b.id)}" ${b.id===checkpointId?'selected':''}>${esc(b.name)} · ${money(b.amount)}</option>`).join('')}</select></label></div><div class="checkpoint-facts"><div><span>Paychecks before it’s due</span><strong>${c.paychecksBefore}</strong><small>${money(c.incomeBefore)} expected beforehand</small></div><div><span>Everyday costs through that day</span><strong>${money(c.everydayThrough)}</strong><small>On top of ${money(c.billsThrough)} planned bills</small></div><div><span>Lowest balance through that day</span><strong class="${c.lowestThrough<0?'negative':''}">${money(c.lowestThrough)}</strong><small>${money(c.spendingRoomThrough)} left above your cushion</small></div></div>`;
    $('#checkpoint-choice').onchange=e=>{checkpointId=e.target.value;renderCheckpoint()};
  }
  function renderCalendar(){
    const m=ctx.getModel();if(!selectedDay||selectedDay<m.startDate||selectedDay>m.endDate)selectedDay=m.startDate;if(!month||month<m.startDate.slice(0,7)||month>m.endDate.slice(0,7))month=selectedDay.slice(0,7);
    $('#calendar-month').textContent=monthLabel(month);$('#calendar-prev').disabled=month<=m.startDate.slice(0,7);$('#calendar-next').disabled=month>=m.endDate.slice(0,7);
    $('#calendar-content').hidden=view!=='calendar';$('#forecast-content .upcoming-section').hidden=view==='calendar';$('#view-calendar').classList.toggle('selected',view==='calendar');$('#view-list').classList.toggle('selected',view==='list');$('#view-calendar').setAttribute('aria-pressed',view==='calendar');$('#view-list').setAttribute('aria-pressed',view==='list');
    const first=new Date(month+'-01T12:00:00'),offset=first.getDay(),count=new Date(first.getFullYear(),first.getMonth()+1,0).getDate(),n=Math.ceil((offset+count)/7)*7,byDate=new Map(m.days.map(d=>[d.date,d]));
    const cells=Array.from({length:n},(_,i)=>{const day=i-offset+1;if(day<1||day>count)return '<div class="calendar-blank" aria-hidden="true"></div>';const date=`${month}-${String(day).padStart(2,'0')}`,d=byDate.get(date);if(!d)return `<div class="calendar-outside"><span>${day}</span></div>`;const events=d.events.filter(e=>e.type==='income'||e.type==='bill');return `<button class="calendar-day ${date===selectedDay?'is-selected':''} ${d.lowBalance<0?'has-shortfall':''}" data-calendar-date="${date}" aria-pressed="${date===selectedDay}" aria-label="${dateText(date)}, closing balance ${money(d.balance)}, ${events.length} scheduled events"><span class="calendar-day-number">${day}${date===m.minDate?'<i title="Lowest forecast day" aria-hidden="true"></i>':''}</span><span class="calendar-events">${events.slice(0,2).map(e=>`<span class="calendar-event ${e.type}">${esc(e.name)} <b>${e.type==='income'?'+':'−'}${money(e.amount)}</b></span>`).join('')}${events.length>2?`<small>+${events.length-2} more</small>`:''}</span><span class="mobile-event-dots" aria-hidden="true">${events.slice(0,4).map(e=>`<i class="${e.type}"></i>`).join('')}</span><span class="calendar-balance"><span class="balance-full">${money(d.balance)}</span><span class="balance-compact">${miniMoney(d.balance)}</span></span></button>`});
    $('#calendar-grid').innerHTML=cells.join('');$$('[data-calendar-date]').forEach(b=>b.onclick=()=>selectDay(b.dataset.calendarDate));
    const d=byDate.get(selectedDay);$('#day-details').innerHTML=`<div class="day-detail-heading"><div><p class="eyebrow">SELECTED DAY</p><h3>${dateText(d.date)} · ${money(d.balance)} at close</h3></div><button class="button small" id="day-add">+ Add for this day</button></div><div class="day-entry"><span>Opening balance</span><strong>${money(d.startBalance)}</strong></div>${d.events.map(e=>`<div class="day-entry"><span>${esc(e.name)} <small>${e.type==='everyday'?'Daily estimate · excludes bills':e.type==='income'?'Expected income':'Planned expense'}</small></span><strong class="${e.type==='income'?'positive':''}">${e.type==='income'?'+':'−'}${money(e.amount)}</strong>${['income','bill'].includes(e.type)?`<button class="text-button" data-day-edit="${esc(e.id)}" data-kind="${e.type==='income'?'income':'bill'}" aria-label="Edit ${esc(e.name)}">Edit</button>`:''}</div>`).join('')}<p class="quiet-note">Lowest point: ${money(d.lowBalance)}. Costs are counted before income on the same day.</p>`;
    $('#day-add').onclick=()=>openSchedule(null,d.date);$$('[data-day-edit]').forEach(b=>b.onclick=()=>{const item=ctx.getState().plan[b.dataset.kind==='income'?'paychecks':'bills'].find(s=>s.id===b.dataset.dayEdit);if(item)openSchedule({...item,kind:b.dataset.kind})});
  }
  function renderSchedules(){
    const s=ctx.getState(),m=ctx.getModel(),items=listSchedules(s.plan,m).filter(x=>scheduleFilter==='all'||x.kind===scheduleFilter).sort((a,b)=>(a.nextDate||'9999').localeCompare(b.nextDate||'9999')||a.name.localeCompare(b.name));
    $$('[data-schedule-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.scheduleFilter===scheduleFilter));
    $('#schedule-totals').innerHTML=`<div><span>Expected income</span><strong class="positive">${money(m.income)}</strong></div><div><span>Planned bills</span><strong>${money(m.bills)}</strong></div><div><span>Everyday estimate</span><strong>${money(m.everyday)}</strong></div><div><span>Forecast period</span><strong class="period-total">${dateText(m.startDate)} – ${dateText(m.endDate)}</strong></div>`;
    $('#schedule-list').innerHTML=items.length?`<div class="table-scroll"><table class="ledger-table schedules-table"><thead><tr><th>NAME</th><th>NEXT DATE</th><th>REPEAT</th><th>AMOUNT</th><th>ACTION</th></tr></thead><tbody>${items.map(x=>`<tr><td><div class="schedule-title"><span class="schedule-type ${x.kind}">${x.kind==='income'?'Income':'Bill'}</span><strong>${esc(x.name)}</strong></div></td><td>${x.nextDate?dateText(x.nextDate):'Outside forecast'}</td><td>${repeats[x.repeat]}</td><td class="${x.kind==='income'?'positive':''}">${x.kind==='income'?'+':'−'}${money(x.amount)}</td><td><button class="text-button" data-edit-schedule="${esc(x.id)}" data-kind="${x.kind}">Edit</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-table">No matching schedules. Add income or an expense to see it on the forecast.</div>';
    $$('[data-edit-schedule]').forEach(b=>b.onclick=()=>{const item=s.plan[b.dataset.kind==='income'?'paychecks':'bills'].find(i=>i.id===b.dataset.editSchedule);if(item)openSchedule({...item,kind:b.dataset.kind})});
    const suggestions=detectRecurring(s.transactions,s.plan,{asOf:m.startDate});
    $('#recurring-list').innerHTML=suggestions.length?suggestions.map((r,i)=>`<article class="recurring-row"><div><strong>${esc(r.name)}</strong><p>${r.evidence.count} recorded charge${r.evidence.count===1?"":"s"} · ${r.confidence==="tentative"?"Unconfirmed recurrence":repeats[r.repeat]} · last seen ${dateText(r.evidence.lastDate)}${r.caution?"<br>"+esc(r.caution):""}</p></div><div><strong>${money(r.amount)}</strong><p>${r.date?"Estimated "+dateText(r.date):"Due date unknown"}</p></div><button class="button small" data-review-recurring="${i}">${r.reviewOnly?"Set verified schedule":"Review"}</button></article>`).join(''):'<div class="empty-table">No supported recurring pattern found yet. Suggestions need at least three similar bills or income transactions. Everyday spending is kept separate.</div>';
    $$('[data-review-recurring]').forEach(b=>b.onclick=()=>{const r=suggestions[Number(b.dataset.reviewRecurring)];openSchedule(r.reviewOnly?{...r,date:m.startDate,repeat:"once"}:r)});
  }
  function renderAccounts(){
    const s=ctx.getState(),calculated=ctx.getBalances?.(),rows=calculated?.accounts||s.plan.accounts.map(a=>({...a,snapshotBalance:a.balance,snapshotDate:a.balanceAsOf||s.plan.startDate,charges:0,credits:0,pendingCharges:0,chargeCount:0}));
    const imported=$('#statement-history'),sources=[['cashapp','Cash App'],['fifththird','Fifth Third']].map(([source,name])=>({name,rows:s.transactions.filter(t=>t.source===source||(source==='cashapp'&&t.source==='cashapp-email'))})).filter(x=>x.rows.length);
    imported.hidden=!sources.length;imported.innerHTML='<h2>Imported account history</h2>'+sources.map(x=>`<p><strong>${x.name}</strong> · ${x.rows.length} recorded transactions</p>`).join('')+'<a class="text-button" href="#transactions">Review transactions →</a>';
    $('#accounts-total').textContent=money(calculated?.balance??s.plan.balance);
    $('#accounts-date').textContent='Starting balances minus new charges, plus recorded credits. Pending and reported charges are included once.';
    $('#accounts-list').innerHTML=rows.map(a=>{const original=s.plan.accounts.find(row=>row.id===a.id);return `<article class="account-list-row running-account" data-running-account="${esc(a.id)}"><div><h2>${esc(a.name)}</h2><p>Starting ${money(a.snapshotBalance)} · ${esc(a.snapshotDate)}</p><p>− ${money(a.charges)} charges${a.credits?' + '+money(a.credits)+' credits':''} · ${a.chargeCount} charge${a.chargeCount===1?'':'s'}${a.pendingCharges?' · '+money(a.pendingCharges)+' pending/reported included':''}</p><label>Subtract activity from<select data-charge-source="${esc(a.id)}"><option value="auto" ${!original.chargeSource?'selected':''}>Match account name</option><option value="cashapp" ${original.chargeSource==='cashapp'?'selected':''}>Cash App</option><option value="fifththird" ${original.chargeSource==='fifththird'?'selected':''}>Fifth Third</option><option value="none" ${original.chargeSource==='none'?'selected':''}>Keep manual balance</option></select></label></div><strong class="running-account-amount">${money(a.balance)}</strong><button class="text-button" data-account-edit="${esc(a.id)}">Update starting balance</button></article>`;}).join('');
    if(calculated&&(calculated.unmapped||calculated.heldSameDay||calculated.heldAmbiguous))$('#accounts-list').insertAdjacentHTML('beforeend',`<p class="info-note">${calculated.unmapped||0} items need an account match; ${calculated.heldSameDay||0} have unclear timing on a balance date; ${calculated.heldAmbiguous||0} need duplicate review. These are not subtracted twice.</p>`);
    $$('[data-account-edit]').forEach(button=>button.onclick=()=>ctx.openPlan(button.dataset.accountEdit));
    $$('[data-charge-source]').forEach(select=>select.onchange=async()=>{const next=structuredClone(ctx.getState()),account=next.plan.accounts.find(a=>a.id===select.dataset.chargeSource);if(select.value==='auto')delete account.chargeSource;else account.chargeSource=select.value;try{await ctx.persist(next);ctx.notice('Charge source saved. Your calculated balance is updated.');}catch(error){ctx.notice(error.message,true);}});
  }

  return {render(){renderCheckpoint();renderCalendar();renderSchedules();renderAccounts();bankView.render();},selectedDay:()=>selectedDay};
}

function mountBankConnections(ctx){
  $('#page-accounts .page-heading').insertAdjacentHTML('afterend','<section id="bank-connections" class="bank-connections accounts-connections" aria-labelledby="bank-heading"></section>');
  document.body.insertAdjacentHTML('beforeend','<dialog id="connect-account-dialog" class="connect-account-dialog" aria-labelledby="connect-account-title" aria-describedby="connect-account-description"><div class="dialog-header"><h2 id="connect-account-title" tabindex="-1">Connect an account</h2><button class="icon-button" type="button" data-connect-action="close" aria-label="Close account connection">×</button></div><div id="connect-account-body"></div></dialog>');
  const oldNote=$('#page-accounts > .quiet-note');
  if(oldNote)oldNote.textContent='Forecast balances are entered manually. Imported purchases help you review spending; they do not change your starting money or scheduled bills.';
  const panel=$('#bank-connections');
  let status=null,loading=false,busy=false,error='',loadedAt=0,sdkPromise=null,refreshPromise=null,dialogMode='choose',dialogError='',returnFocus=null;
  const dialog=$('#connect-account-dialog');
  const localContext=()=>ctx.getConnectionContext?.()||{localService:false,session:{isLocal:false}};
  const canManage=()=>{const c=localContext();return c.localService&&c.session?.isLocal};
  const post=(path,body={})=>ctx.api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const stamp=value=>{const d=new Date(value);return value&&!Number.isNaN(d.getTime())?d.toLocaleString():'Not synced yet'};
  const normalDialogMode=()=>!canManage()?'device':!status?.configured?'unavailable':ctx.getState().mode!=='personal'?'plan':'choose';

  function renderDialog(focus=true){
    let content='';
    const fallback='<div class="connect-fallback"><p>You can keep planning while connections are unavailable.</p><div class="button-row"><button class="button" data-connect-action="balance">Enter a balance</button><button class="text-button" data-connect-action="import">Import statement</button></div></div>';
    if(dialogMode==='checking')content='<p id="connect-account-description" role="status">Checking whether bank sign-in is available…</p>';
    else if(dialogMode==='choose')content=`<p id="connect-account-description">Choose an account. Sign-in and permission requests open in the official bank connection window.</p><div class="connect-bank-choices"><button class="connect-bank-choice" data-connect-action="fifth-third"><span><strong>Fifth Third</strong><small>Find Fifth Third in the bank sign-in window</small></span><span aria-hidden="true">›</span></button><button class="connect-bank-choice" data-connect-action="cash-app"><span><strong>Cash App</strong><small>Automatic purchase imports unavailable</small></span><span aria-hidden="true">›</span></button><button class="connect-bank-choice" data-connect-action="another-bank"><span><strong>Another bank</strong><small>Search for a supported bank or credit union</small></span><span aria-hidden="true">›</span></button></div><p class="quiet-note">You choose which accounts to share. New posted purchases import automatically while the finance app is running on your computer.</p>${ctx.getState().transactions.length?'<p class="connect-overlap">Already imported statements or bank history? Some purchases may overlap. Review duplicates after connecting.</p>':''}<p class="connect-provider-note">Bank sign-in is provided by Plaid. If this window cannot complete sign-in, open the local app in Chrome or Edge.</p>`;
    else if(dialogMode==='unavailable')content='<h3>Bank connections aren’t available yet</h3><p id="connect-account-description">The app’s connection service needs to be activated before bank sign-in can open. You do not need to enter bank details here.</p><p class="quiet-note">No account was connected by this attempt. Your saved plan and history are unchanged.</p><button class="button primary" data-connect-action="retry">Check again</button>'+fallback;
    else if(dialogMode==='cash-app')content='<h3>Cash App imports aren’t available yet</h3><p id="connect-account-description">A connection to personal Cash App purchase history has not been verified. Connecting its funding bank will not import purchases made within Cash App.</p><p>You can import a statement in the supported CSV format instead.</p><div class="button-row"><button class="button primary" data-connect-action="import">Import statement</button><button class="text-button" data-connect-action="back">Back to accounts</button></div>';
    else if(dialogMode==='plan')content='<h3>Use your own numbers first</h3><p id="connect-account-description">You’re exploring an example plan. Start your own plan before connecting a real account so example purchases stay separate.</p><button class="button primary" data-connect-action="balance">Set up my plan</button>';
    else if(dialogMode==='device')content=localContext().localService?'<h3>Connect from your computer</h3><p id="connect-account-description">Open Accounts on the computer you paired with to connect a bank. Once connected, imported purchases will appear on this phone too.</p><p class="quiet-note">You can still review your plan and spending here.</p>':'<h3>Connect in the local app</h3><p id="connect-account-description">This browser edition does not collect bank purchases. Open the local app on your computer to connect an account.</p><p class="quiet-note">The plan saved in this browser stays separate from the local app.</p>'+fallback;
    else content=`<h3>We couldn’t finish the connection</h3><p id="connect-account-description" role="alert">${esc(dialogError||'Check your connection status before trying again.')}</p><button class="button primary" data-connect-action="retry">Check connection status</button>${fallback}`;
    $('#connect-account-body').innerHTML=content+'<div class="connect-dialog-footer"><button class="text-button" data-connect-action="close">Close</button></div>';
    if(focus)$('#connect-account-title').focus();
  }

  async function openConnectionDialog(){
    if(busy)return;
    returnFocus=document.activeElement;dialogError='';
    dialogMode=!canManage()?'device':status?normalDialogMode():'checking';
    renderDialog(false);dialog.showModal();$('#connect-account-title').focus();
    if(dialogMode==='checking'){
      const checked=await refresh(true);
      if(dialog.open){dialogMode=checked?normalDialogMode():'error';dialogError='The connection service could not be reached. Check again in a moment.';renderDialog()}
    }
  }

  $('#bank-connect').addEventListener('click',openConnectionDialog);
  dialog.addEventListener('close',()=>{const target=returnFocus?.isConnected?returnFocus:$('#bank-connect');target?.focus()});
  dialog.addEventListener('click',async event=>{
    const action=event.target.closest('[data-connect-action]')?.dataset.connectAction;
    if(!action)return;
    if(action==='close'){dialog.close();return}
    if(action==='balance'){dialog.close();ctx.openPlan();return}
    if(action==='import'){dialog.close();location.hash='transactions';$('#import-csv').click();return}
    if(action==='back'){dialogMode=normalDialogMode();renderDialog();return}
    if(action==='cash-app'){dialogMode='cash-app';renderDialog();return}
    if(action==='retry'){
      dialogMode='checking';renderDialog();const checked=await refresh(true);
      if(dialog.open){dialogMode=checked?normalDialogMode():'error';dialogError='The connection service could not be reached. Try again in a moment.';renderDialog()}
      return;
    }
    if(action==='fifth-third'||action==='another-bank'){
      if(normalDialogMode()!=='choose'){dialogMode=normalDialogMode();renderDialog();return}
      dialog.close();await connect();
    }
  });

  function render(){
    const context=localContext();
    $('#bank-connect').disabled=busy;
    const heading='<div class="bank-section-heading"><div><p class="eyebrow">YOUR SPENDING, TOGETHER</p><h2 id="bank-heading">Connected accounts</h2></div></div>';
    if(!context.localService){panel.innerHTML=heading+'<p>No accounts connected in this browser. To connect an account, open the local app on your computer. You can enter balances and import statements here.</p>';return}
    if(!context.session?.isLocal){panel.innerHTML=heading+'<p>Manage bank connections on the computer you paired with. Imported purchases appear in Transactions on this phone when the plan refreshes.</p>';return}
    panel.setAttribute('aria-busy',String(loading||busy));
    const warning=error?`<p class="bank-error" role="alert">${esc(error)}</p>`:'';
    if(!status){
      panel.innerHTML=heading+warning+(loading?'<p role="status">Checking your connections…</p>':'<p>Your connections could not be checked. Try again.</p><button class="button" id="bank-refresh">Check again</button>');
    }else{
      const items=Array.isArray(status.items)?status.items:[];
      const configured=status.configured===true;
      const interval=Math.max(1,Math.round((status.syncIntervalMs||900000)/60000));
      const setup=items.length?(configured?`<p>New posted purchases import automatically while the finance app is running on your computer.</p>`:`<p>Automatic imports are paused. The connection service is unavailable; your earlier purchases and saved connections are kept.</p>`):`<div class="bank-empty-state"><h3>No accounts connected</h3><p>Connect an account to bring new purchases into your spending history. You can also enter a balance or import a statement below.</p></div>`;
      panel.innerHTML=heading+warning+setup+`<div class="bank-linked-list">${items.length?items.map(item=>`<article class="bank-linked-item"><div class="bank-item-heading"><div><h3>${esc(item.institutionName||'Linked institution')}</h3><p>${esc(!configured?'Imports paused':item.status==='attention'||item.lastError?'Needs attention':'Connected')} · Last sync: ${esc(stamp(item.lastSync))}</p></div><div class="bank-item-actions">${item.requiresReauth||item.status==='attention'||item.lastError?`<button class="button small" data-bank-reconnect="${esc(item.id)}" ${busy||!configured?'disabled':''}>Reconnect</button>`:''}<button class="button small" data-bank-sync="${esc(item.id)}" ${busy||!configured?'disabled':''}>Sync purchases</button><button class="text-button" data-bank-disconnect="${esc(item.id)}" ${busy?'disabled':''}>Disconnect</button></div></div>${item.lastError?`<p class="bank-error">${esc(item.lastError)}</p>`:''}${Number(item.pendingCount)>0?`<p><span class="review-label">${Number(item.pendingCount)} pending purchase${Number(item.pendingCount)===1?'': 's'} awaiting posting</span></p>`:''}<ul class="bank-account-names">${(item.accounts||[]).map(account=>`<li><span>${esc(account.name||'Account')}${account.mask?' · ••'+esc(account.mask):''}</span><small>${esc(account.subtype||account.type||'Bank account')}${account.currency?' · '+esc(account.currency):''}</small></li>`).join('')}</ul></article>`).join(''):''}</div><p class="quiet-note">${items.length&&configured?`The app checks for new purchases every ${interval} minutes while running on your computer. Your bank may release transactions later; this is not instant purchase notification. `:''}Only posted purchases appear in Transactions; pending purchases wait for posting. Bank history stays separate from your manual forecast balances. Disconnecting stops future collection and keeps imported history.</p><div class="bank-footer-actions"><button class="text-button" id="bank-refresh" ${busy||loading?'disabled':''}>Refresh connection status</button>${items.length?'<button class="text-button" id="bank-open-transactions">Review imported purchases ↗</button>':''}</div>`;
    }
    $('#bank-refresh')?.addEventListener('click',()=>refresh(true));
    $('#bank-open-transactions')?.addEventListener('click',()=>{location.hash='transactions'});
    $$('[data-bank-sync]').forEach(button=>button.onclick=()=>sync(button.dataset.bankSync));
    $$('[data-bank-reconnect]').forEach(button=>button.onclick=()=>connect(button.dataset.bankReconnect));
    $$('[data-bank-disconnect]').forEach(button=>button.onclick=()=>disconnect(button.dataset.bankDisconnect));
    if(location.hash==='#accounts'&&!status&&!loading&&!error)refresh();
  }

  async function refresh(force=false){
    if(!canManage())return null;
    if(refreshPromise)return refreshPromise;
    if(!force&&status&&Date.now()-loadedAt<60000)return status;
    loading=true;error='';render();
    refreshPromise=(async()=>{
      try{status=await ctx.api('/api/banking/status');loadedAt=Date.now();window.dispatchEvent(new CustomEvent('finance-bank-status',{detail:status}));return status}
      catch{error='Your connections could not be checked. Check that the local app is running, then try again.';return null}
      finally{loading=false;refreshPromise=null;render()}
    })();
    return refreshPromise;
  }

  async function run(action,showDialog=false){
    if(busy||!canManage())return;
    busy=true;error='';render();
    try{await action()}
    catch(e){
      error='The connection could not be updated. Check its status before trying again.';
      if(showDialog){dialogMode=e.status===503?'unavailable':'error';dialogError=e.status?'The connection service could not finish this request. Check connection status before trying again.':e.message||error;if(!dialog.open)dialog.showModal();renderDialog()}
    }
    finally{busy=false;render()}
  }

  function loadPlaid(){
    if(window.Plaid)return Promise.resolve(window.Plaid);
    if(sdkPromise)return sdkPromise;
    const nonce=document.querySelector('meta[name="plaid-csp-nonce"]')?.content;
    if(!nonce)return Promise.reject(Error('Bank sign-in is not ready in this page. Reload the app, then try connecting again.'));
    sdkPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.plaid.com/link/v2/stable/link-initialize.js';script.async=true;
      script.nonce=nonce;
      const timeout=setTimeout(()=>fail(),20000);
      function fail(){clearTimeout(timeout);script.remove();sdkPromise=null;reject(Error('The bank sign-in window could not open. Check your connection, or open the local app in Chrome or Edge.'))}
      script.onload=()=>{clearTimeout(timeout);if(window.Plaid)resolve(window.Plaid);else fail()};
      script.onerror=fail;document.head.append(script);
    });
    return sdkPromise;
  }

  async function connect(itemId=null){
    if(!status?.configured||ctx.getState().mode!=='personal')return;
    await run(async()=>{
      const {linkToken}=await post('/api/banking/link-token',itemId?{itemId}:{});
      const Plaid=await loadPlaid();
      const result=await new Promise((resolve,reject)=>{
        let completed=false,handler;
        handler=Plaid.create({token:linkToken,onSuccess:async(publicToken,metadata)=>{
          completed=true;
          try{
            if(itemId){
              await post('/api/banking/sync',{itemId});
              resolve({message:'Bank access updated. Your existing connection and saved history were kept. Review imported purchases in Transactions.'});
            }else{
              if(!publicToken)throw Error('Plaid did not return a connection token. No connection has been saved.');
              const linked=await post('/api/banking/exchange',{publicToken,institutionName:metadata?.institution?.name,institutionId:metadata?.institution?.institution_id});
              resolve(linked);
            }
          }catch(e){reject(e)}finally{handler.destroy()}
        },onExit:err=>{if(completed)return;handler.destroy();if(err)reject(Error(err.display_message||err.error_message||'The connection could not finish. Please try again.'));else resolve(null)}});
        handler.open();
      });
      if(result){await ctx.reloadState();await refresh(true);ctx.notice(result.message||'Bank connected. Review imported purchases in Transactions. Future collection runs while the local service is open.')}
      else ctx.notice(itemId?'Reconnection closed. Your existing connection and saved history have not been replaced.':'Connection closed. No new bank account was added.');
    },true);
  }

  async function sync(itemId){await run(async()=>{const result=await post('/api/banking/sync',{itemId});await ctx.reloadState();await refresh(true);ctx.notice(`Bank sync finished: ${result.added||0} added, ${result.modified||0} updated, ${result.removed||0} removed.${result.excludedCurrency?' Some transactions were excluded because their currency is not USD.':''} Your forecast balance has not changed.`)})}
  async function disconnect(itemId){
    const item=status?.items?.find(i=>i.id===itemId);
    if(!confirm(`Disconnect ${item?.institutionName||'this institution'}? Future collection will stop. Imported history and your manual forecast balances will be kept.`))return;
    await run(async()=>{await post('/api/banking/disconnect',{itemId});await refresh(true);ctx.notice('Bank disconnected. Imported history and your forecast plan have been kept.')});
  }
  window.addEventListener('hashchange',()=>{if(location.hash==='#accounts'){render();if(status&&!busy)refresh()}});
  return {render};
}
