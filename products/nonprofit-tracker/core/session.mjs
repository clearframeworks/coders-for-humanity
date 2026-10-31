// Consent/session lifecycle only. This module never starts a sensor or network request.
function timestamp(now) {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid timestamp.');
  return now;
}

function text(value, name, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new Error(`${name} must contain 1–${max} characters.`);
  }
  return value.trim();
}

export function requestSession({ id, purpose, minutes }, now = Date.now()) {
  timestamp(now);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) {
    throw new Error('Duration must be a whole number from 1 to 120 minutes.');
  }
  return {
    id: text(id, 'Session ID', 80), purpose: text(purpose, 'Purpose', 240),
    client: 'This device', origin: 'local', status: 'pending',
    requestedAt: now, expiresAt: now + minutes * 60_000,
    startedAt: null, endedAt: null,
  };
}

export function currentSession(session, now = Date.now()) {
  timestamp(now);
  if (!session) return null;
  if (['pending', 'active'].includes(session.status) && now >= session.expiresAt) {
    return { ...session, status: 'expired', endedAt: session.expiresAt };
  }
  return session;
}

export function transition(session, action, { approved = false, now = Date.now() } = {}) {
  const current = currentSession(session, now);
  if (!current) throw new Error('Create a session first.');
  if (!['start', 'stop', 'revoke', 'deny'].includes(action)) throw new Error('Unknown action.');
  const latestEvent = Math.max(current.requestedAt, current.startedAt ?? 0, current.endedAt ?? 0);
  if (now < latestEvent) throw new Error('Session time cannot move backwards.');
  if (action === 'start') {
    if (current.status !== 'pending') throw new Error('Only a pending session can start.');
    if (approved !== true) throw new Error('Explicit approval is required.');
    return { ...current, status: 'active', startedAt: now };
  }
  if (action === 'deny') {
    if (current.status !== 'pending') throw new Error('Only a pending session can be declined.');
    return { ...current, status: 'denied', endedAt: now };
  }
  if (action === 'stop') {
    if (current.status !== 'active') throw new Error('Only an active session can stop.');
    return { ...current, status: 'stopped', endedAt: now };
  }
  if (!['pending', 'active', 'stopped'].includes(current.status)) {
    throw new Error('This session can no longer be revoked.');
  }
  return { ...current, status: 'revoked', endedAt: now };
}
