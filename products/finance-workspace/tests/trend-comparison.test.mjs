import test from 'node:test';
import assert from 'node:assert/strict';
import {compareTrends} from '../dist/trend-comparison.mjs';
import {projectForecast} from '../dist/projection.mjs';

function state({subscription=false}={}){
  const transactions=[
    {source:'fifththird',date:'2026-10-01',description:'Opening evidence',amount:1,category:'Income'},
    {source:'fifththird',date:'2026-10-02',description:'Example workplace meal',amount:-40,category:'Dining'},
    {source:'fifththird',date:'2026-10-03',description:'Example shop',amount:-20,category:'Shopping'},
    {source:'fifththird',date:'2026-10-04',description:'Kroger',amount:-20,category:'Groceries'}
  ];
  if(subscription)transactions.push({source:'fifththird',date:'2026-10-01',description:'RECURRING PURCHASE AT NETFLIX',amount:-20,category:'Other'});
  return{plan:{startDate:'2026-10-24',horizon:30,balance:100,cushion:0,dailySpend:20,bills:[],paychecks:[],forecastBasis:{spendingMethod:'routine-history',estimatedDaily:20}},transactions};
}

test('zero changes yield identical outcomes and the exact existing forecast ending',()=>{
  const input=state(),before=structuredClone(input),result=compareTrends(input,{targetDate:'2026-10-25'});
  assert.deepEqual(result.changed,result.baseline);assert.equal(result.improvement,0);assert.equal(result.horizon,2);
  assert.equal(result.baseline.ending,projectForecast({...input,plan:{...input.plan,horizon:2}}).ending);assert.equal(result.baseline.netSavings,-40);assert.deepEqual(input,before);
});
test('25/50-percent scenarios use exact daily cents from separate routine groups, without changing recorded purchases',()=>{
  const input=state(),work=compareTrends(input,{targetDate:'2026-10-25',diningReductionPercent:25}),combined=compareTrends(input,{targetDate:'2026-10-25',diningReductionPercent:25,shoppingReductionPercent:50});
  assert.equal(work.dailyReduction,2.5);assert.equal(work.improvement,5);
  assert.equal(combined.groups.find(group=>group.name==='Shopping').routineTotal,20);assert.equal(combined.groups.find(group=>group.name==='Shopping').dailyReduction,2.5);assert.equal(combined.dailyReduction,5);assert.equal(combined.improvement,10);assert.equal(combined.changed.ending,70);
  const full=compareTrends(input,{targetDate:'2026-10-25',diningReductionPercent:100,shoppingReductionPercent:100});assert.equal(full.dailyReduction,15);assert.equal(full.changed.expenses,10);
});
test('renewal exclusions save only on their actual proposed dates, not an averaged monthly allowance',()=>{
  const input=state({subscription:true}),before=structuredClone(input),key=compareTrends(input,{targetDate:'2026-10-31'}).candidates.find(candidate=>candidate.name==='Netflix').key;
  assert.equal(compareTrends(input,{targetDate:'2026-10-31',excludedRenewalKeys:[key]}).improvement,0);
  const november=compareTrends(input,{targetDate:'2026-11-02',excludedRenewalKeys:[key]});assert.equal(november.improvement,20);
  const december=compareTrends(input,{targetDate:'2026-12-02',excludedRenewalKeys:[key,key]});assert.equal(december.improvement,40);assert.equal(december.excludedRenewalKeys.length,1);assert.deepEqual(input,before);
});
test('invalid dates, targets beyond 180 inclusive days, percentages and unknown charge keys fail clearly',()=>{
  const input=state();for(const options of [{targetDate:'2026-10-23'},{targetDate:'2027-10-24'},{targetDate:'2026-02-30'},{targetDate:'2026-10-25',diningReductionPercent:101},{targetDate:'2026-10-25',shoppingReductionPercent:-1},{targetDate:'2026-10-25',diningReductionPercent:NaN},{targetDate:'2026-10-25',excludedRenewalKeys:['unknown']}])assert.throws(()=>compareTrends(input,options));
  assert.equal(compareTrends(input,{targetDate:'2026-10-24'}).horizon,1);
  assert.equal(compareTrends(input,{targetDate:'2027-04-21'}).horizon,180);assert.throws(()=>compareTrends(input,{targetDate:'2027-04-22'}),/179 days/);
});
test('combined modeled reduction cannot exceed a smaller manual daily spending amount',()=>{
  const input=state();input.plan.dailySpend=3;
  const result=compareTrends(input,{targetDate:'2026-10-25',diningReductionPercent:100,shoppingReductionPercent:100});assert.equal(result.dailyReduction,3);assert.equal(result.changed.expenses,0);assert.equal(result.improvement,6);
});

test('candidate controls contain only dated active forecast proposals, excluding uncertain renewals and manual-mode overlays',()=>{
  const input=state({subscription:true});input.transactions.push({source:'fifththird',date:'2026-10-02',description:'RECURRING PURCHASE AT NAME-CHEAP.COM* GX',amount:-14,category:'Other'});
  const automatic=compareTrends(input,{targetDate:'2026-10-31'});
  assert.equal(automatic.candidates.length,1);assert.equal(automatic.candidates[0].name,'Netflix');assert.ok(automatic.candidates.every(c=>c.date&&c.repeat&&!c.reviewOnly));
  const key=automatic.candidates[0].key;
  assert.equal(compareTrends(input,{targetDate:'2026-10-31',excludedRenewalKeys:[key]}).improvement,0);
  input.plan.dailySpend=3;
  assert.deepEqual(compareTrends(input,{targetDate:'2026-11-02'}).candidates,[]);
  assert.throws(()=>compareTrends(input,{targetDate:'2026-11-02',excludedRenewalKeys:[key]}),/available in this forecast/);
});
