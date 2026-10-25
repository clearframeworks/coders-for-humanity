import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHomeModel} from '../dist/home-view.mjs';
import {projectForecast} from '../dist/projection.mjs';
const state=overrides=>({plan:{startDate:'2026-10-24',horizon:30,balance:1000,cushion:0,dailySpend:10,bills:[],paychecks:[],...overrides},transactions:[]});
const cents=value=>Math.round(value*100);

test('seven-day costs include both boundaries and exclude older/later charges',()=>{
  const input=state({bills:[{id:'old',name:'Already modeled',amount:3,date:'2026-10-24',repeat:'once'},{id:'first',name:'First day',amount:10,date:'2026-10-25',repeat:'once'},{id:'last',name:'Seventh day',amount:15,date:'2026-10-31',repeat:'once'},{id:'later',name:'After window',amount:90,date:'2026-11-01',repeat:'once'}],paychecks:[{id:'pay',name:'Pay',amount:100,date:'2026-10-31',repeat:'once'}]});
  const before=structuredClone(input),result=buildHomeModel(input,{asOf:'2026-10-25'});
  assert.equal(result.windowStart,'2026-10-25');assert.equal(result.windowEnd,'2026-10-31');assert.equal(result.week.available,true);
  assert.equal(result.week.routine,70);assert.equal(result.week.confirmedBills,25);assert.equal(result.week.expenses,95);assert.equal(result.week.income,100);assert.equal(result.week.net,5);
  assert.equal(result.week.openingBalance,987);assert.equal(result.week.endingBalance,992);
  assert.deepEqual(result.upcoming.map(row=>row.id),['first','last','pay','later']);assert.equal(result.upcomingEnd,'2026-11-07');assert.deepEqual(input,before);
});

test('tentative renewals count once, outside routine costs and confirmed bills',()=>{
  const input=state({forecastBasis:{spendingMethod:'routine-history',estimatedDaily:10},bills:[{id:'bill',name:'Known bill',amount:100,date:'2026-11-01',repeat:'monthly'}]});
  input.transactions=[{source:'fifththird',date:'2026-10-01',description:'RECURRING PURCHASE AT NETFLIX',amount:-20,category:'Other'},{source:'fifththird',date:'2026-10-02',description:'Kroger',amount:-10,category:'Groceries'}];
  const result=buildHomeModel(input,{asOf:'2026-10-30'});
  assert.equal(result.week.routine,35);assert.equal(result.week.confirmedBills,100);assert.equal(result.week.estimatedRecurring,20);assert.equal(result.week.expenses,155);
  assert.equal(result.upcoming.filter(row=>row.estimated).length,1);
  assert.equal(cents(result.week.expenses),cents(result.week.routine)+cents(result.week.confirmedBills)+cents(result.week.estimatedRecurring));
  const model=projectForecast({...input,plan:{...input.plan,horizon:13}}),days=model.days.filter(day=>day.date>='2026-10-30'&&day.date<='2026-11-05');
  assert.equal(cents(result.week.expenses),days.reduce((total,day)=>total+cents(day.expenses),0));
});

test('monthly potential savings exclude opening funds and show partial months and real pay cadence',()=>{
  const result=buildHomeModel(state({dailySpend:0,paychecks:[{id:'pay',name:'Weekly pay',amount:100,date:'2026-10-30',repeat:'weekly'}]}),{asOf:'2026-10-24'});
  assert.equal(result.months.length,3);assert.equal(result.months[0].partial,true);assert.equal(result.months[0].netSavings,100);assert.equal(result.months[0].endingBalance,1100);
  assert.equal(result.months[1].income,400);assert.equal(result.months[2].income,400);
  const later=buildHomeModel(state(),{asOf:'2026-11-03'});assert.equal(later.months[0].month,'2026-11');
  assert.match(result.limitations[1],/not money already saved/);
});

test('future starting snapshot is explicit; stale dates never extrapolate beyond engine limit',()=>{
  const future=buildHomeModel(state(),{asOf:'2026-10-20'});assert.equal(future.futureStart,true);assert.equal(future.windowStart,'2026-10-24');assert.equal(future.windowEnd,'2026-10-30');assert.equal(future.week.routine,70);
  assert.equal(buildHomeModel(state(),{asOf:'2027-04-15'}).week.available,true);
  const stale=buildHomeModel(state(),{asOf:'2027-04-16'});assert.equal(stale.week.available,false);assert.match(stale.week.reason,/180-day/);assert.deepEqual(stale.upcoming,[]);assert.deepEqual(stale.savings,[]);
  assert.throws(()=>buildHomeModel(state(),{asOf:'2026-02-30'}),/valid/);
});

test('weekly opportunities use actual seven-day scenario expense differences, capped by the saved routine cost',()=>{
  const input=state({dailySpend:1});input.transactions=[{source:'fifththird',date:'2026-10-01',description:'History begins',amount:1,category:'Income'},{source:'fifththird',date:'2026-10-02',description:'Example workplace meal',amount:-40,category:'At work'},{source:'fifththird',date:'2026-10-04',description:'History ends',amount:1,category:'Income'}];
  const result=buildHomeModel(input,{asOf:'2026-10-26'});
  const opportunity=result.savings.find(row=>row.name==='Halve at work');assert.ok(opportunity);assert.equal(opportunity.dailyReduction,5);assert.equal(opportunity.weeklyReduction,7);assert.equal(result.week.expenses,7);
  assert.equal(result.history.groups.find(group=>group.name==='At work').routineWeekly,70);assert.equal(result.history.start,'2026-10-01');assert.equal(result.history.end,'2026-10-04');
});
test('upcoming includes next-week bills without folding them into the seven-day costs, capped at 180 days',()=>{
  const input=state({dailySpend:0,bills:[{id:'rent',name:'Rent',amount:550,date:'2026-10-31',repeat:'once'},{id:'after',name:'Outside upcoming',amount:50,date:'2026-11-07',repeat:'once'}]});
  const result=buildHomeModel(input,{asOf:'2026-10-24'});
  assert.equal(result.windowEnd,'2026-10-30');assert.equal(result.upcomingEnd,'2026-11-06');assert.equal(result.week.expenses,0);assert.deepEqual(result.upcoming.map(row=>row.id),['rent']);
  const capped=buildHomeModel(state(),{asOf:'2027-04-15'});assert.equal(capped.week.available,true);assert.equal(capped.upcomingEnd,'2027-04-21');
});
test('near-term outlook surfaces a shortfall after the seven-day estimate without changing that estimate',()=>{
  const input=state({balance:100,dailySpend:0,bills:[{id:'future-bill',name:'Next week bill',amount:125,date:'2026-11-06',repeat:'once'}]});
  const result=buildHomeModel(input,{asOf:'2026-10-24'});
  assert.equal(result.week.lowestBalance,100);assert.equal(result.week.expenses,0);
  assert.deepEqual(result.outlook,{lowestBalance:-25,minDate:'2026-11-06'});
  assert.equal(result.upcomingEnd,'2026-11-06');
});
