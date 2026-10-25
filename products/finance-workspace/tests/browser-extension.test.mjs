import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createCollector, permittedURL, reusableTabURL} from '../browser-connector/controller.mjs';

function harness({ready = true, request = true} = {}) {
  const local = {}, session = {}, tabs = new Map(), alarms = new Map();
  let counter = 0, clicks = 0;
  const storage = data => ({get: async key => ({[key]: structuredClone(data[key])}), set: async values => Object.assign(data, structuredClone(values)), remove: async key => {delete data[key];}});
  const chrome = {storage: {local: storage(local), session: storage(session)}, alarms: {create: async (name, value) => alarms.set(name, value), clear: async name => alarms.delete(name)}, tabs: {
    create: async value => {const tab = {id: ++counter, status: 'complete', ...value}; tabs.set(tab.id, tab); return tab;},
    get: async id => {if (!tabs.has(id)) throw Error('closed'); return tabs.get(id);},
    update: async (id, value) => {Object.assign(tabs.get(id), value); return tabs.get(id);},
    sendMessage: async (_id, message) => {
      if (message.kind === 'finance-export-ready') return {ready, reason: 'signed_out'};
      if (message.kind === 'finance-export-cancel') return {cancelled: true};
      clicks++; return {requested: request};
    }
  }};
  return {chrome, local, session, tabs, alarms, clicks: () => clicks};
}
test('MV3 permissions are narrow and provider URL boundaries reject unrelated origins', async () => {
  const manifest = JSON.parse(await readFile(new URL('../browser-connector/manifest.json', import.meta.url)));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['alarms', 'storage']);
  assert.deepEqual(manifest.host_permissions, ['https://cash.app/account/*','https://secure.53.com/olb/*']);
  assert.equal(permittedURL('cashapp','https://cash.app/account/activity'),true);
  for (const url of ['https://cash.app/login','https://cash.app.evil.test/account/activity','http://cash.app/account/activity','https://user@cash.app/account/activity']) assert.equal(permittedURL('cashapp',url),false);
});
test('default off; start schedules 15 minutes, reuses inactive owned tab, and never reports imported', async () => {
  const h = harness(), collector = createCollector(h.chrome);
  await collector.restore(); assert.equal(h.alarms.size,0);
  assert.equal((await collector.run('cashapp')).status,'off'); assert.equal(h.tabs.size,0);
  assert.equal((await collector.command('cashapp','start')).status,'requested');
  assert.deepEqual(h.alarms.get('finance:cashapp'),{delayInMinutes:15,periodInMinutes:15});
  await collector.run('cashapp'); assert.equal(h.tabs.size,1); assert.equal(h.clicks(),2);
  const state=(await collector.state()).cashapp;
  assert.equal(state.status,'requested'); assert.equal('imported' in state,false);
  await collector.command('cashapp','stop'); assert.equal(h.alarms.size,0);
  assert.equal((await collector.run('cashapp')).status,'off'); assert.equal(h.clicks(),2);
});
test('manual try does not enable automation; provider controls are independent', async () => {
  const h=harness(), collector=createCollector(h.chrome);
  await collector.command('cashapp','try'); assert.equal((await collector.state()).cashapp.enabled,false);assert.equal(h.alarms.size,0);
  await collector.command('fifththird','start');await collector.command('cashapp','stop');
  assert.equal(h.alarms.has('finance:fifththird'),true);
});
test('repurposed inactive foreign or same-bank payment/settings/login tabs are never overwritten', async () => {
  for (const [provider, url] of [
    ['cashapp','https://example.test/notes'],
    ['cashapp','https://cash.app/account/payments'],
    ['cashapp','https://cash.app/account/settings'],
    ['fifththird','https://secure.53.com/olb/payments'],
    ['fifththird','https://secure.53.com/olb/login']
  ]) {
    const h=harness(), collector=createCollector(h.chrome);
    await collector.command(provider,'try');h.tabs.get(1).url=url;
    await collector.command(provider,'try');
    assert.equal(h.tabs.get(1).url,url);
    assert.equal(h.tabs.size,2);
    assert.equal(h.session['collectorTab:'+provider],2);
  }
  assert.equal(reusableTabURL('cashapp','https://cash.app/account/'),true);
  assert.equal(reusableTabURL('fifththird','https://secure.53.com/olb/accounts'),true);
  assert.equal(reusableTabURL('fifththird','https://secure.53.com/olb/accounts?action=payment'),false);
});
test('expired authentication pauses until explicit resume; active collector tabs are left alone', async () => {
  const h=harness({ready:false}), collector=createCollector(h.chrome,{wait:async()=>{}});
  assert.equal((await collector.command('cashapp','start')).status,'sign_in_required');
  assert.equal(h.alarms.size,0);assert.equal(h.clicks(),0);assert.equal((await collector.state()).cashapp.paused,true);
  const good=harness(), second=createCollector(good.chrome);
  await second.command('cashapp','start');good.tabs.get(1).active=true;
  assert.equal((await second.run('cashapp')).status,'tab_active');assert.equal(good.clicks(),1);
});
test('concurrent requests click once; Stop during load prevents later export', async () => {
  const h=harness(), collector=createCollector(h.chrome);
  await Promise.all([collector.command('cashapp','try'),collector.command('cashapp','try')]);assert.equal(h.clicks(),1);
  const h2=harness();let release,waiting;
  const barrier=new Promise(resolve=>{waiting=resolve;});
  h2.chrome.tabs.create=async value=>{const tab={id:1,status:'loading',...value};h2.tabs.set(1,tab);return tab;};
  const c2=createCollector(h2.chrome,{wait:async()=>{waiting();await new Promise(resolve=>{release=resolve;});}});
  const task=c2.command('cashapp','start');await barrier;
  await c2.command('cashapp','stop');h2.tabs.get(1).status='complete';release();await task;
  assert.equal(h2.clicks(),0);assert.equal((await c2.state()).cashapp.status,'off');
});

async function contentHarness(provider,{accounts=1,asyncForm=false,placeholder=false,aria=true,dateControls='labels',startDate='09/23/2026',endDate='10/22/2026',fixedToday='2026-10-23T12:00:00Z',rejectEndChange=false,stagedAccount=false}={}) {
  let listener,clicks=0,staleClicks=0;
  const button={disabled:asyncForm,textContent:provider==='cashapp'?aria?'':'Download':'SUBMIT',value:'',getAttribute:key=>key==='aria-label'&&provider==='cashapp'&&aria?'Download':null,getClientRects:()=>[{}],click:()=>{clicks++;}};
  let currentButton=button;
  const option=(value,textContent)=>({value,textContent,disabled:false});
  const select=(options)=>({options,value:'',disabled:false,getClientRects:()=>[{}],dispatchEvent:()=>{}});
  const account=select(Array.from({length:accounts},(_,i)=>option('synthetic-account-'+i,'Checking'))),type=select([option('csv','CSV'),option('qfx','QFX')]);
  let formRendered=!stagedAccount,accountChanges=0;
  if(stagedAccount)account.dispatchEvent=event=>{if(event.type==='change'){accountChanges++;setTimeout(()=>{formRendered=true;},15);}};
  const dateInput=value=>({tagName:'INPUT',type:'text',value,readOnly:false,disabled:false,getClientRects:()=>[{}],dispatchEvent:()=>{}});
  const start=dateInput(startDate),end=dateInput(endDate);
  if(rejectEndChange)end.dispatchEvent=()=>{end.value=endDate;};
  const startLabel={textContent:'Start Date',htmlFor:'start-date'},endLabel={textContent:'EndDate',htmlFor:'end-date'};
  if(placeholder)account.options.unshift(option('placeholder','- Select From Account -'));
  if(asyncForm)type.dispatchEvent=()=>{button.click=()=>{staleClicks++;};setTimeout(()=>{currentButton={...button,disabled:false,click:()=>{clicks++;}};},15);};
  const doc={getElementById:id=>formRendered?(id==='start-date'?start:id==='end-date'?end:null):null,querySelector:selector=>selector==='select#From-account'?account:selector==='select#type'&&formRendered?type:null,querySelectorAll:selector=> {
    if(selector==='button'||selector==='button,input[type="submit"]')return [currentButton];
    if(selector==='label'&&dateControls==='labels'&&formRendered)return [startLabel,endLabel];
    if(dateControls==='containers'&&formRendered&&selector==='[id="startCalendar"],[name="startCalendar"]')return [{tagName:'DIV',querySelectorAll:()=>[start]}];
    if(dateControls==='containers'&&formRendered&&selector==='[id="endCalendar"],[name="endCalendar"]')return [{tagName:'DIV',querySelectorAll:()=>[end]}];
    return [];
  }};
  const location=new URL(provider==='cashapp'?'https://cash.app/account/activity':'https://secure.53.com/olb/account/details/transactionExport');
  const chrome={runtime:{id:'extension',onMessage:{addListener:fn=>{listener=fn;}}}};
  class ClockDate extends Date {constructor(...args){super(...(args.length?args:[fixedToday]));}}
  vm.runInNewContext(await readFile(new URL('../browser-connector/content.js',import.meta.url),'utf8'),{chrome,document:doc,location,URL,Event,setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,5)),Date:ClockDate});
  const send=message=>new Promise(resolve=>listener(message,{id:'extension'},resolve));
  return {send,clicks:()=>clicks,staleClicks:()=>staleClicks,location,start,end,accountChanges:()=>accountChanges};
}
test('content clicks only Cash App Download and waits for fresh enabled Fifth Third CSV SUBMIT', async () => {
  const cash=await contentHarness('cashapp');
  assert.equal((await cash.send({kind:'finance-export-request',provider:'cashapp'})).requested,true);assert.equal(cash.clicks(),1);
  const bank=await contentHarness('fifththird',{asyncForm:true});
  assert.equal((await bank.send({kind:'finance-export-ready',provider:'fifththird'})).ready,true);
  assert.equal((await bank.send({kind:'finance-export-request',provider:'fifththird'})).requested,true);
  assert.equal(bank.clicks(),1);assert.equal(bank.staleClicks(),0);
});
test('multiple checking accounts, wrong origin and cancellation never submit', async () => {
  const multiple=await contentHarness('fifththird',{accounts:2});
  assert.equal((await multiple.send({kind:'finance-export-request',provider:'fifththird'})).requested,false);assert.equal(multiple.clicks(),0);
  const wrong=await contentHarness('cashapp');wrong.location.href='https://evil.test/account/activity';
  assert.equal((await wrong.send({kind:'finance-export-request',provider:'cashapp'})).requested,false);assert.equal(wrong.clicks(),0);
  const cancelled=await contentHarness('fifththird',{asyncForm:true});
  const task=cancelled.send({kind:'finance-export-request',provider:'fifththird'});
  await cancelled.send({kind:'finance-export-cancel'});assert.equal((await task).requested,false);assert.equal(cancelled.clicks(),0);
});
test('Download may use visible text and bank placeholder is excluded despite its nonempty value', async () => {
  const cash=await contentHarness('cashapp',{aria:false});
  assert.equal((await cash.send({kind:'finance-export-request',provider:'cashapp'})).requested,true);
  assert.equal(cash.clicks(),1);
  const bank=await contentHarness('fifththird',{placeholder:true});
  assert.equal((await bank.send({kind:'finance-export-request',provider:'fifththird'})).requested,true);
  assert.equal(bank.clicks(),1);
});
test('bank export advances through today across month/year rollover, preserving its identified start', async () => {
  for(const [options,expected] of [
    [{},'10/23/2026'],
    [{startDate:'9/23/2026',endDate:'10/22/2026'},'10/23/2026'],
    [{startDate:'1/30/2026',endDate:'2/28/2026',fixedToday:'2026-03-01T12:00:00Z'},'03/01/2026'],
    [{startDate:'12/01/2026',endDate:'12/31/2026',fixedToday:'2027-01-01T12:00:00Z',dateControls:'containers'},'01/01/2027'],
    [{startDate:'2026-10-01',endDate:'2026-10-23'},'2026-10-23']
  ]) {
    const bank=await contentHarness('fifththird',options),originalStart=bank.start.value;
    assert.equal((await bank.send({kind:'finance-export-request',provider:'fifththird'})).requested,true);
    assert.equal(bank.end.value,expected);assert.equal(bank.start.value,originalStart);assert.equal(bank.clicks(),1);
  }
});
test('unrecognized or invalid date fields fail closed instead of claiming current coverage', async () => {
  for(const options of [{dateControls:'unrecognized'},{endDate:'02/30/2026'},{startDate:'10/24/2026'}]) {
    const bank=await contentHarness('fifththird',options);
    assert.equal((await bank.send({kind:'finance-export-request',provider:'fifththird'})).requested,false);assert.equal(bank.clicks(),0);
  }
});
test('bank never submits when the form refuses the current end date', async () => {
  const bank=await contentHarness('fifththird',{rejectEndChange:true});
  assert.equal((await bank.send({kind:'finance-export-request',provider:'fifththird'})).requested,false);assert.equal(bank.clicks(),0);
});
test('unselected sole account is selected before dates and CSV controls render', async () => {
  const bank=await contentHarness('fifththird',{stagedAccount:true,placeholder:true,asyncForm:true});
  assert.equal((await bank.send({kind:'finance-export-ready',provider:'fifththird'})).ready,true);
  assert.equal((await bank.send({kind:'finance-export-request',provider:'fifththird'})).requested,true);
  assert.equal(bank.accountChanges(),1);assert.equal(bank.end.value,'10/23/2026');
  assert.equal(bank.clicks(),1);assert.equal(bank.staleClicks(),0);
});
