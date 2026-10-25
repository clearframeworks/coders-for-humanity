import test from 'node:test';import assert from 'node:assert/strict';
import {groupSlug,purchaseKey,getCategoryDetail} from '../dist/detail-view.mjs';
test('category routes resolve exact report purchases and amounts without changing source records',()=>{
 const state={plan:{startDate:'2026-10-24',bills:[]},transactions:[{id:'provider-sensitive-id',source:'fifththird',date:'2026-10-01',description:'Example workplace meal',amount:-10,category:'At work'},{id:'other-id',source:'fifththird',date:'2026-10-02',description:'Kroger',amount:-20,category:'Groceries'}]};
 const original=structuredClone(state),d=getCategoryDetail(state,'at-work');assert.equal(d.group.total,10);assert.equal(d.purchases.length,1);assert.equal(d.purchases[0].amount,10);assert.equal(d.purchases[0].id,'provider-sensitive-id');assert.equal(getCategoryDetail(state,'missing'),null);assert.deepEqual(state,original);
 assert.equal(groupSlug('Cannabis/THC'),'cannabis-thc');const key=purchaseKey(d.purchases[0]);assert.equal(key.includes('sensitive'),false);assert.equal(key,purchaseKey(d.purchases[0]));assert.notEqual(key,purchaseKey({id:'other-id'}));
});
