import test from 'node:test';
import assert from 'node:assert/strict';
import {needsPlanSetup} from '../dist/home-view.mjs';

const state=()=>({mode:'personal',plan:{balance:0,dailySpend:0,paychecks:[],bills:[]},transactions:[]});

test('untouched defaults need setup but a confirmed zero-dollar plan does not',()=>{
  const input=state();assert.equal(needsPlanSetup(input),true);
  input.plan.setupComplete=true;assert.equal(needsPlanSetup(input),false);
});

test('existing financial inputs and fictional examples do not trigger onboarding',()=>{
  for(const change of [{balance:-10},{dailySpend:5},{paychecks:[{amount:100}]},{bills:[{amount:20}]}]){
    const input=state();Object.assign(input.plan,change);assert.equal(needsPlanSetup(input),false);
  }
  const example=state();example.mode='example';assert.equal(needsPlanSetup(example),false);
});

test('imported history without forecast inputs still needs setup and is not modified',()=>{
  const input=state();input.transactions=[{id:'synthetic-purchase',amount:-15}];
  const original=structuredClone(input);assert.equal(needsPlanSetup(input),true);assert.deepEqual(input,original);
});
