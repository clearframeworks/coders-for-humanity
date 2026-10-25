import {networkInterfaces} from 'node:os';
import {isIP} from 'node:net';
import {createHash, randomBytes, randomInt, timingSafeEqual} from 'node:crypto';
import {InputError} from './validation.mjs';

const COOKIE = 'finance_phone_session';
const PAIRING_MS = 5 * 60 * 1000;
const SESSION_MS = 12 * 60 * 60 * 1000;
const normalize = value => String(value || '').replace(/^::ffff:/i, '');
export function isLoopbackPeer(address) {
  const value = normalize(address);
  return value === '::1' || (isIP(value) === 4 && value.split('.')[0] === '127');
}
export function isPrivateIpv4(address) {
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
export function privateAddresses() {
  return [...new Set(Object.values(networkInterfaces()).flat().filter(item => item && !item.internal && item.family === 'IPv4' && isPrivateIpv4(item.address)).map(item => item.address))];
}
const tokenHash = token => createHash('sha256').update(token).digest('hex');

/** Per-process pairing and sessions. Nothing secret is persisted or put in URLs. */
export class LanAuth {
  constructor({enabled = false, addresses = privateAddresses(), now = Date.now} = {}) {
    if (!Array.isArray(addresses) || addresses.some(address => !isPrivateIpv4(address))) throw new Error('LAN addresses must be private IPv4 addresses.');
    this.enabled = enabled; this.addresses = [...new Set(addresses)]; this.now = now;
    this.sessions = new Map(); this.pairing = null;
  }
  prune() {
    const now = this.now();
    for (const [key, session] of this.sessions) if (session.expiresAt <= now) this.sessions.delete(key);
  }
  token(req) {
    const match = String(req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${COOKIE}=`));
    const value = match?.slice(COOKIE.length + 1) || '';
    return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
  }
  inspect(req, port) {
    this.prune();
    const peer = normalize(req.socket?.remoteAddress);
    if (!isLoopbackPeer(peer) && !(this.enabled && isPrivateIpv4(peer))) throw new InputError('Only this computer and paired devices on a private network can access this app.', 403);
    const localHosts = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`];
    const requestedHost = req.headers.host;
    const allowedHosts = [...localHosts, ...(this.enabled ? this.addresses.map(address => `${address}:${port}`) : [])];
    if (!allowedHosts.includes(requestedHost)) throw new InputError('Host is not allowed.', 403);
    const isLocal = isLoopbackPeer(peer) && localHosts.includes(requestedHost);
    const token = this.token(req), session = token ? this.sessions.get(tokenHash(token)) : null;
    const paired = !!session;
    return {isLocal, paired, lanEnabled: this.enabled, requiresPairing: !isLocal && !paired, sessionExpiresAt: session ? new Date(session.expiresAt).toISOString() : null};
  }
  requireLocal(session) {
    if (!session.isLocal) throw new InputError('This control is available only on the computer running the app.', 403);
  }
  requireAuthorized(session) {
    if (session.requiresPairing) throw new InputError('Pair this device using the code shown on your computer.', 401);
  }
  status(port) {
    this.prune();
    const active = !!this.pairing && this.pairing.expiresAt > this.now() && this.pairing.failures < 5;
    return {lanEnabled: this.enabled, urls: this.enabled ? this.addresses.map(address => `http://${address}:${port}`) : [], sessions: this.sessions.size, pairing: {active, expiresAt: this.pairing ? new Date(this.pairing.expiresAt).toISOString() : null, attemptsRemaining: this.pairing ? Math.max(0, 5 - this.pairing.failures) : 0}};
  }
  createPairing() {
    if (!this.enabled) throw new InputError('Phone access is disabled. Restart with FINANCE_LAN=1 to enable private-network access.', 409);
    const code = String(randomInt(10000000, 100000000));
    this.pairing = {hash: tokenHash(code), expiresAt: this.now() + PAIRING_MS, failures: 0};
    return {code, expiresAt: new Date(this.pairing.expiresAt).toISOString(), attemptsRemaining: 5};
  }
  pair(req, res, code) {
    if (!this.enabled) throw new InputError('Phone access is disabled.', 403);
    if (!this.pairing || this.pairing.expiresAt <= this.now()) throw new InputError('The pairing code has expired or is no longer active. Generate a new code on your computer.', 410);
    if (this.pairing.failures >= 5) throw new InputError('Too many pairing attempts. Generate a new code on your computer.', 429);
    if (typeof code !== 'string' || !/^\d{8}$/.test(code)) {
      this.pairing.failures++;
      throw new InputError('Enter the eight-digit pairing code shown on your computer.', this.pairing.failures >= 5 ? 429 : 400);
    }
    const supplied = Buffer.from(tokenHash(code), 'hex'), expected = Buffer.from(this.pairing.hash, 'hex');
    if (!timingSafeEqual(supplied, expected)) {
      this.pairing.failures++;
      throw new InputError('The pairing code did not match. Check the code on your computer.', this.pairing.failures >= 5 ? 429 : 401);
    }
    this.prune();
    if (this.sessions.size >= 10) throw new InputError('Ten devices are already paired. Revoke phone sessions on your computer before pairing another device.', 409);
    const old = this.token(req); if (old) this.sessions.delete(tokenHash(old));
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(tokenHash(token), {expiresAt: this.now() + SESSION_MS});
    this.pairing = null;
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}`);
    return {paired: true, sessionExpiresAt: new Date(this.now() + SESSION_MS).toISOString()};
  }
  logout(req, res) {
    const token = this.token(req); if (token) this.sessions.delete(tokenHash(token));
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
  }
  revoke() { this.sessions.clear(); this.pairing = null; }
}
