import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateSpending,spendingGroup,categoryForHistory} from '../dist/spending-plan.mjs';
test('common coverage excludes transfers and confirmed household/phone costs without inventing cash',()=>{
 const rows=[{source:'cashapp',date:'2026-10-01',description:'Cash Out',amount:-100,category:'Transfers'},
 {source:'fifththird',date:'2026-10-02',description:'Kroger',amount:-20,category:'Groceries'},
 {source:'cashapp',date:'2026-10-02',description:'guitar',amount:-30,category:'Other'},
 {source:'fifththird',date:'2026-10-03',description:'STRAIGHTTALK',amount:-45,category:'Other'},
 {source:'cashapp',date:'2026-10-03',description:'rent, electric, internet, formula',amount:-700,category:'Other'},
 {source:'cashapp',date:'2026-10-05',description:'newer grocery',amount:-99,category:'Other'}];
 const original=structuredClone(rows);
 const e=estimateSpending(rows,{startDate:'2026-10-05',bills:[{name:'Phone'}]});
 assert.equal(e.start,'2026-10-02');assert.equal(e.end,'2026-10-03');assert.equal(e.days,2);
 assert.equal(e.total,50);assert.equal(e.daily,25);assert.equal(e.excluded,745);assert.equal(e.cashResidual,null);
 assert.equal(e.groups.find(g=>g.name==='Activities').weekly,105);assert.deepEqual(rows,original);
});
test('no eligible history gives no estimate and categories stay broad',()=>{
 assert.equal(estimateSpending([],{startDate:'2026-10-23',bills:[]}),null);
 assert.equal(spendingGroup({description:'unknown shop'}),'Miscellaneous');
 assert.equal(spendingGroup({description:'Kroger'}),'Groceries');
});
test('confirming a subscription removes its past charge from the variable estimate',()=>{
 const rows=[{source:'fifththird',date:'2026-10-01',description:'RECURRING PURCHASE AT OPENAI *CHATGPT',amount:-100,category:'Other'},
 {source:'fifththird',date:'2026-10-02',description:'Kroger',amount:-20,category:'Groceries'}];
 const before=estimateSpending(rows,{startDate:'2026-10-23',bills:[]});
 const after=estimateSpending(rows,{startDate:'2026-10-23',bills:[{name:'OpenAI'}]});
 assert.equal(before.daily,10);assert.equal(before.rawDaily,60);assert.equal(before.subscriptionTotal,100);assert.equal(before.subscriptions.length,1);assert.equal(after.daily,10);assert.equal(after.excluded,100);assert.equal(after.subscriptions.length,0);
});

const entry=(description,amount,date='2026-10-02',category='Other')=>({source:'fifththird',date,description,amount,category});
test('meaningful planning categories follow explicit merchant evidence without changing recorded categories',()=>{
 const cases=[['Tobacco Smoke Shop','Tobacco'],['Vape store THC products','Cannabis/THC'],['Restaurant lunch','Dining'],['Shell fuel','Transport'],['RECURRING PURCHASE AT OPENAI','Subscriptions'],['Amazon retail purchase','Shopping'],['Guitar strings','Activities'],['Instant transfer fee','Fees'],['FACEBOOK ADS','Miscellaneous']];
 for(const[description,group]of cases){const row=entry(description,-10);assert.equal(spendingGroup(row),group);assert.equal(row.category,'Other');}
 assert.equal(spendingGroup(entry('PayPal',-600,'2026-10-02','Cannabis')),'Cannabis/THC');
 assert.equal(spendingGroup(entry('Unknown shop',-600)),'Miscellaneous');
});

test('large purchase is separated by transparent robust threshold and daily history reconciles exactly',()=>{
 const rows=[entry('Opening evidence',1,'2026-10-01'),...Array.from({length:5},(_,i)=>entry('Grocery items',-10,'2026-10-02','Groceries')),entry('Large repair',-500,'2026-10-03')];
 const e=estimateSpending(rows,{startDate:'2026-10-04',bills:[]});
 assert.equal(e.days,3);assert.equal(e.total,550);assert.equal(e.rawDaily,183.34);assert.equal(e.daily,16.67);assert.equal(e.routineTotal,50);assert.equal(e.oneOffTotal,500);assert.equal(e.oneOffThreshold,75);assert.equal(e.oneOffs.length,1);assert.equal(e.activeDays,2);
 assert.equal(e.dailyHistory.reduce((s,d)=>s+d.total,0),550);assert.ok(e.dailyHistory.every(d=>Math.abs(d.total-d.routine-d.oneOff-d.subscriptions)<.001));
 assert.match(e.outlierMethod.rule,/median/);
});

test('sparse history does not invent outliers or a category-specific large-purchase cutoff',()=>{
 const rows=[entry('Opening',1,'2026-10-01'),entry('PayPal',-600,'2026-10-02','Cannabis'),entry('Unknown shop',-600,'2026-10-02'),entry('Cash Out',-600,'2026-10-03','Transfers')];
 const e=estimateSpending(rows,{startDate:'2026-10-04',bills:[]});assert.equal(e.oneOffThreshold,null);assert.equal(e.oneOffs.length,0);assert.equal(e.total,1200);assert.equal(e.routineTotal,1200);
});

test('pending rows and income do not inflate spend or extend source coverage',()=>{
 const rows=[entry('Opening',1,'2026-10-01'),entry('Coffee',-10,'2026-10-02'),{...entry('Pending purchase',-500,'2026-10-20'),pending:true},entry('Paycheck',800,'2026-10-02','Income')];
 const e=estimateSpending(rows,{startDate:'2026-10-24',bills:[]});assert.equal(e.end,'2026-10-02');assert.equal(e.total,10);assert.equal(e.count,1);assert.equal(e.daily,5);assert.equal(e.cashResidual,null);
});

test('subscription history is excluded routine once and proposals do not duplicate already confirmed bills',()=>{
 const rows=[entry('Opening',1,'2026-10-01'),entry('RECURRING PURCHASE AT OPENAI REF ABC12345',-20,'2026-10-02'),entry('Kroger',-10,'2026-10-03','Groceries')];
 const p={startDate:'2026-10-24',bills:[],paychecks:[]},e=estimateSpending(rows,p);
 assert.equal(e.routineTotal,10);assert.equal(e.subscriptionTotal,20);assert.equal(e.subscriptions.length,1);assert.equal(e.subscriptions[0].date,'2026-11-02');assert.equal(e.subscriptions[0].confidence,'tentative');
 const confirmed=estimateSpending(rows,{...p,bills:[{name:'OpenAI',amount:20,date:'2026-11-02',repeat:'monthly'}]});assert.equal(confirmed.excluded,20);assert.equal(confirmed.subscriptionTotal,0);assert.equal(confirmed.subscriptions.length,0);assert.equal(confirmed.routineTotal,10);
});

test('savings show concrete half-spend scenarios while subscription/fee reviews promise no cancellation savings',()=>{
 const rows=[entry('Opening',1,'2026-10-01'),entry('Cigarettes',-20,'2026-10-02','Tobacco'),entry('Work lunch',-10,'2026-10-03','At work'),entry('Service fee',-5,'2026-10-04'),entry('Netflix',-15,'2026-10-07','Subscriptions')];
 const e=estimateSpending(rows,{startDate:'2026-10-24',bills:[],paychecks:[]});
 assert.equal(e.savings.find(s=>s.name==='Halve tobacco').weekly,10);assert.equal(e.savings.find(s=>s.name==='Halve at work').weekly,5);
 const review=e.savings.find(s=>s.name==='Review recurring charges');assert.equal(review.weekly,null);assert.equal(review.monthly,null);assert.equal(review.observedWeekly,15);assert.match(review.description,/not an assumption/);
 assert.equal(e.savings.find(s=>s.name==='Review avoidable fees').weekly,null);
});

test('public categories preserve user labels and distinguish meals, fuel and tobacco',()=>{
 for(const [description,category,group] of [['Restaurant lunch','Other','Dining'],['Shell fuel','Other','Transport'],['Tobacco shop','Other','Tobacco'],['Work lunch','At work','At work'],['Unknown shop','Other','Miscellaneous']]) {
  const row=entry(description,-10,'2026-10-02',category);
  assert.equal(categoryForHistory(row),category);assert.equal(spendingGroup(row),group);
 }
});

test('purchase details use exactly the same eligible basis and positive amounts as group totals',()=>{
 const rows=[
  {...entry('Opening',1,'2026-10-01'),id:'income'},
  {...entry('Kroger',-12.34,'2026-10-02','Groceries'),id:'groceries'},
  {...entry('Example workplace meal',-9.87,'2026-10-02'),id:'at-work'},
  {...entry('Example shop',-15,'2026-10-03'),id:'cannabis'},
  {...entry('OpenAI',-20,'2026-10-03','Subscriptions'),id:'confirmed-bill'},
  {...entry('Cash Out',-100,'2026-10-03','Transfers'),id:'transfer'},
  {...entry('Pending restaurant',-50,'2026-10-03'),id:'pending',pending:true},
  {...entry('Future groceries',-10,'2026-12-01'),id:'future'}
 ];
 const e=estimateSpending(rows,{startDate:'2026-10-24',bills:[{name:'OpenAI'}],paychecks:[]});
 assert.deepEqual(e.purchases.map(p=>p.id),['groceries','at-work','cannabis']);
 assert.equal(e.purchases.every(p=>p.amount>0),true);
 assert.equal(Math.round(e.purchases.reduce((s,p)=>s+p.amount,0)*100),Math.round(e.total*100));
 for(const group of e.groups)assert.equal(Math.round(e.purchases.filter(p=>p.group===group.name).reduce((s,p)=>s+p.amount,0)*100),Math.round(group.total*100));
 assert.deepEqual(Object.keys(e.purchases[0]).sort(),['id','date','description','amount','group'].sort());
});

test('recent actual ledger retains later Cash App outflows as partial without changing overlapping baseline',()=>{
 const rows=[
  {...entry('Opening',1,'2026-10-01'),source:'cashapp'},
  entry('Opening',1,'2026-10-01'),
  {...entry('Kroger',-10,'2026-10-02','Groceries'),source:'cashapp'},
  {...entry('Coverage evidence',1,'2026-10-19'),source:'cashapp'},
  entry('Known purchase',-7,'2026-10-19'),
  {...entry('Example workplace meal',-20,'2026-10-20'),source:'cashapp'},
  {...entry('StraightTalk',-45,'2026-10-21'),source:'cashapp'},
  {...entry('RECURRING PURCHASE AT OPENAI',-15,'2026-10-22'),source:'cashapp'},
  {...entry('PayPal',-600,'2026-10-23','Cannabis/THC'),source:'cashapp'},
  {...entry('Pending restaurant',-99,'2026-10-23'),source:'cashapp',pending:true},
  {...entry('Cash Out',-100,'2026-10-23','Transfers'),source:'cashapp'},
  {...entry('Paycheck',800,'2026-10-23','Income'),source:'cashapp'}
 ];
 const p={startDate:'2026-10-24',bills:[{name:'Phone'}],paychecks:[]};
 const e=estimateSpending(rows,p),baseline=estimateSpending(rows.filter(r=>r.date<='2026-10-19'),p);
 assert.equal(e.end,'2026-10-19');assert.equal(e.total,17);assert.equal(e.daily,baseline.daily);assert.deepEqual(e.dailyHistory,baseline.dailyHistory);assert.deepEqual(e.purchases,baseline.purchases);
 const recent=e.recentDailyHistory;assert.equal(recent.at(-1).date,'2026-10-23');assert.equal(recent.at(-1).partialCoverage,true);assert.equal(recent.at(-1).routine,600);
 assert.equal(recent.find(day=>day.date==='2026-10-20').routine,20);
 assert.equal(recent.find(day=>day.date==='2026-10-21').bills,45);
 assert.equal(recent.find(day=>day.date==='2026-10-22').subscriptions,15);
 assert.equal(recent.find(day=>day.date==='2026-10-19').partialCoverage,false);
 assert.equal(recent.some(day=>day.date==='2026-10-24'),false);
 assert.equal(recent.reduce((sum,day)=>sum+day.total,0),697);
 assert.ok(recent.every(day=>Math.abs(day.total-day.routine-day.oneOff-day.subscriptions-day.bills)<.001));
});

test('actual-ledger date can advance beyond saved plan without changing baseline or admitting future outflows',()=>{
 const rows=[
  entry('Bank first record',1,'2026-10-01'),entry('Bank purchase',-10,'2026-10-19'),
  {...entry('Cash App first record',1,'2026-10-01'),source:'cashapp'},
  {...entry('Cash App observed purchase',-5,'2026-10-23'),source:'cashapp'},
  {...entry('Newly imported purchase',-12,'2026-10-25'),source:'cashapp'},
  {...entry('Future purchase',-99,'2026-10-26'),source:'cashapp'}
 ];
 const plan={startDate:'2026-10-24',bills:[],paychecks:[]};
 const old=estimateSpending(rows,plan),current=estimateSpending(rows,plan,{ledgerAsOf:'2026-10-25'});
 assert.equal(current.ledgerAsOf,'2026-10-25');assert.equal(current.end,'2026-10-19');assert.equal(current.daily,old.daily);assert.equal(current.total,old.total);assert.deepEqual(current.purchases,old.purchases);assert.deepEqual(current.subscriptions,old.subscriptions);assert.deepEqual(current.dailyHistory,old.dailyHistory);
 assert.equal(old.recentDailyHistory.at(-1).date,'2026-10-23');assert.equal(current.recentDailyHistory.at(-1).date,'2026-10-25');assert.equal(current.recentDailyHistory.at(-1).partialCoverage,true);assert.equal(current.recentDailyHistory.at(-1).total,12);assert.equal(current.recentDailyHistory.some(day=>day.date==='2026-10-26'),false);
 assert.throws(()=>estimateSpending(rows,plan,{ledgerAsOf:'2026-02-30'}),/actual-ledger date/);
});
