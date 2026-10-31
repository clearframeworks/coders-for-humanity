import test from 'node:test';
import assert from 'node:assert/strict';
import { requestSession, currentSession, transition } from '../core/session.mjs';

const request = () => requestSession({ id: 'local-1', purpose: 'Volunteer delivery', minutes: 5 }, 1000);

test('a request remains pending without explicit approval', () => {
  const session = request();
  assert.equal(session.status, 'pending');
  assert.throws(() => transition(session, 'start', { now: 2000 }), /approval/);
  assert.equal(session.startedAt, null);
});
test('approval starts; stop ends; stopped sessions cannot restart', () => {
  const active = transition(request(), 'start', { approved: true, now: 2000 });
  const stopped = transition(active, 'stop', { now: 3000 });
  assert.equal(active.startedAt, 2000);
  assert.equal(stopped.status, 'stopped');
  assert.equal(stopped.endedAt, 3000);
  assert.throws(() => transition(stopped, 'start', { approved: true, now: 4000 }));
  assert.equal(transition(stopped, 'revoke', { now: 4000 }).status, 'revoked');
});
test('declined and revoked sessions cannot start', () => {
  for (const action of ['deny', 'revoke']) {
    const ended = transition(request(), action, { now: 2000 });
    assert.throws(() => transition(ended, 'start', { approved: true, now: 3000 }));
  }
  const active = transition(request(), 'start', { approved: true, now: 2000 });
  const revoked = transition(active, 'revoke', { now: 3000 });
  assert.equal(revoked.status, 'revoked');
  assert.throws(() => transition(revoked, 'stop', { now: 4000 }));
});
test('pending and active sessions expire at the exact deadline', () => {
  for (const session of [request(), transition(request(), 'start', { approved: true, now: 2000 })]) {
    assert.equal(currentSession(session, 300999).status, session.status);
    assert.equal(currentSession(session, 301000).status, 'expired');
    assert.throws(() => transition(session, 'start', { approved: true, now: 301000 }));
  }
});
test('invalid input, unknown actions and clock regression are rejected', () => {
  for (const minutes of [0, 121, NaN, 1.5, '5']) {
    assert.throws(() => requestSession({ id: 'x', purpose: 'Delivery', minutes }, 1000));
  }
  assert.throws(() => requestSession({ id: 'x', purpose: ' ', minutes: 5 }, 1000));
  assert.throws(() => currentSession(request(), NaN));
  assert.throws(() => transition(request(), 'unknown', { now: 2000 }));
  assert.throws(() => transition(request(), 'start', { approved: true, now: 999 }));
  const active = transition(request(), 'start', { approved: true, now: 3000 });
  assert.throws(() => transition(active, 'stop', { now: 2000 }), /backwards/);
  const stopped = transition(active, 'stop', { now: 4000 });
  assert.throws(() => transition(stopped, 'revoke', { now: 3500 }), /backwards/);
});
