import test from 'node:test';
import assert from 'node:assert/strict';
import {projectMonthlySavings} from '../dist/monthly-savings.mjs';
import {projectForecast} from '../dist/projection.mjs';

const state=overrides=>({plan:{startDate:'2026-10-24',horizon:30,balance:500,cushion:0,dailySpend:10,bills:[],paychecks:[{id:'pay',name:'Weekly pay',amount:800,date:'2026-10-30',repeat:'weekly'}],...overrides},transactions:[]});
const cents=value=>Math.round(value*100);

test('six calendar months include current partial month, year boundary and actual five-paycheck month',()=>{
 const input=state(),before=structuredClone(input),result=projectMonthlySavings(input);
 assert.equal(result.startDate,'2026-10-24');assert.equal(result.endDate,'2027-03-31');assert.equal(result.horizon,159);assert.equal(result.truncated,false);assert.equal(result.months.length,6);
 const october=result.months[0],january=result.months.find(row=>row.month==='2027-01');
 assert.equal(october.partial,true);assert.equal(october.startDate,'2026-10-24');assert.equal(october.endDate,'2026-10-31');assert.equal(october.income,800);assert.equal(october.routine,80);assert.equal(october.netSavings,720);assert.equal(october.openingBalance,500);assert.equal(october.endingBalance,1220);
 assert.equal(january.income,4000);assert.equal(january.partial,false);assert.equal(result.months.find(row=>row.month==='2026-11').income,3200);assert.deepEqual(input,before);
});

test('negative balances carry between months and opening cash never counts as new savings',()=>{
 const input=state({balance:10,dailySpend:20,paychecks:[],bills:[{id:'bill',name:'Month-end bill',amount:25,date:'2026-10-31',repeat:'monthly'}]});
 const result=projectMonthlySavings(input,{months:2});
 assert.equal(result.months[0].netSavings,-185);assert.equal(result.months[0].endingBalance,-175);assert.equal(result.months[1].openingBalance,-175);assert.equal(result.months[1].expenses,625);assert.equal(result.months[1].endingBalance,-800);assert.equal(result.totalNetSavings,-810);assert.equal(result.endingBalance,-800);
 const funded=projectMonthlySavings(state({balance:1000,dailySpend:0,paychecks:[]}),{months:1});assert.equal(funded.months[0].netSavings,0);assert.equal(funded.months[0].endingBalance,1000);
});

test('monthly low retains same-day pre-paycheck trough rather than just positive month-end balance',()=>{
 const input=state({startDate:'2026-11-01',balance:0,dailySpend:1,paychecks:[{id:'pay',name:'Pay',amount:100,date:'2026-11-01',repeat:'once'}]});
 const [month]=projectMonthlySavings(input,{months:1}).months;assert.equal(month.lowestBalance,-1);assert.equal(month.endingBalance,70);assert.equal(month.netSavings,70);assert.equal(month.partial,false);
});

test('proposed subscriptions use the existing projection overlay once, separate from confirmed bills and routine spending',()=>{
 const input=state({bills:[{id:'rent',name:'Rent',amount:100,date:'2026-11-01',repeat:'monthly'}],forecastBasis:{spendingMethod:'routine-history',estimatedDaily:10}});
 input.transactions=[{source:'fifththird',date:'2026-10-01',description:'RECURRING PURCHASE AT NETFLIX',amount:-20,category:'Other'},{source:'fifththird',date:'2026-10-02',description:'Kroger',amount:-10,category:'Groceries'}];
 const before=structuredClone(input),result=projectMonthlySavings(input),november=result.months.find(row=>row.month==='2026-11');
 assert.equal(november.confirmedBills,100);assert.equal(november.estimatedRecurring,20);assert.equal(november.routine,150);assert.equal(november.expenses,270);
 const forecast=projectForecast({...input,plan:{...input.plan,horizon:159}});
 assert.equal(result.endingBalance,forecast.ending);assert.equal(result.lowestBalance,forecast.min);assert.equal(result.months.reduce((sum,row)=>sum+cents(row.estimatedRecurring),0),cents(forecast.estimatedRecurringTotal));
 for(let i=0;i<result.months.length;i++){const row=result.months[i];assert.equal(cents(row.expenses),cents(row.confirmedBills)+cents(row.estimatedRecurring)+cents(row.routine));assert.equal(cents(row.endingBalance),cents(row.openingBalance)+cents(row.netSavings));if(i)assert.equal(row.openingBalance,result.months[i-1].endingBalance);}
 assert.deepEqual(input,before);
});

test('180-day cap is disclosed rather than extrapolating beyond the engine limit',()=>{
 const result=projectMonthlySavings(state({startDate:'2026-10-01'}));assert.equal(result.horizon,180);assert.equal(result.requestedEndDate,'2027-03-31');assert.equal(result.endDate,'2027-03-29');assert.equal(result.truncated,true);assert.equal(result.months.at(-1).partial,true);assert.match(result.limitations.at(-1),/180 days/);
 assert.throws(()=>projectMonthlySavings(state(),{months:0}),/one to six/);assert.throws(()=>projectMonthlySavings(state(),{months:7}),/one to six/);assert.throws(()=>projectMonthlySavings(state({startDate:'2026-02-30'})),/valid/);
});
