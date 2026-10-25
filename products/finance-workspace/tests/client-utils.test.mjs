import test from 'node:test';
import assert from 'node:assert/strict';
import {recordId} from '../dist/client-utils.mjs';
test('Record IDs work on a plain HTTP phone without randomUUID',()=>{let called=false;const id=recordId({getRandomValues(bytes){called=true;bytes.fill(3);return bytes}});assert.ok(called);assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);assert.equal(recordId({randomUUID:()=> 'native-id'}),'native-id');assert.notEqual(recordId({}),recordId({}));});
