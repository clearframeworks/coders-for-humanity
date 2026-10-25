export const PROVIDERS = Object.freeze({
  cashapp: {name: 'Cash App', url: 'https://cash.app/account/activity', origin: 'https://cash.app', path: '/account/'},
  fifththird: {name: 'Fifth Third', url: 'https://secure.53.com/olb/account/details/transactionExport', origin: 'https://secure.53.com', path: '/olb/'}
});
const initial = () => Object.fromEntries(Object.keys(PROVIDERS).map(id => [id, {enabled: false, paused: false, status: 'off', lastAttempt: null, lastRequested: null}]));
export function permittedURL(id, value) {
  try { const url = new URL(value), p = PROVIDERS[id]; return !!p && url.origin === p.origin && url.pathname.startsWith(p.path) && !url.username && !url.password; } catch { return false; }
}
export function reusableTabURL(id, value) {
  if (!permittedURL(id, value)) return false;
  const url = new URL(value);
  const allowedPaths = id === 'cashapp' ? ['/account/activity', '/account/'] : ['/olb/account/details/transactionExport', '/olb/accounts'];
  return allowedPaths.includes(url.pathname) && !url.search && !url.hash;
}

export function createCollector(chrome, {now = () => new Date().toISOString(), wait = ms => new Promise(resolve => setTimeout(resolve, ms))} = {}) {
  const running = new Map();
  let writes = Promise.resolve();
  async function state() {
    const saved = (await chrome.storage.local.get('collectorState')).collectorState || {};
    return Object.fromEntries(Object.entries(initial()).map(([id, value]) => [id, {...value, ...(saved[id] || {})}]));
  }
  function update(id, patch) {
    const operation = writes.then(async () => { const all = await state(); all[id] = {...all[id], ...patch}; await chrome.storage.local.set({collectorState: all}); return all[id]; });
    writes = operation.catch(() => {}); return operation;
  }
  async function ownedTab(id) {
    const key = 'collectorTab:' + id;
    const saved = (await chrome.storage.session.get(key))[key];
    if (saved !== undefined) {
      try {
        const tab = await chrome.tabs.get(saved);
        if (tab.active) throw new Error('tab_active');
        if (reusableTabURL(id, tab.url)) return await chrome.tabs.update(tab.id, {url: PROVIDERS[id].url, active: false});
        // A user may have repurposed this tab. Leave its page untouched and
        // relinquish ownership before creating a fresh inactive collector tab.
        await chrome.storage.session.remove(key);
      } catch (error) {
        if (['tab_active', 'signed_out'].includes(error.message)) throw error;
        await chrome.storage.session.remove(key);
      }
    }
    const tab = await chrome.tabs.create({url: PROVIDERS[id].url, active: false});
    await chrome.storage.session.set({[key]: tab.id});
    return tab;
  }
  async function execute(id, cancellation) {
    await update(id, {status: 'opening', lastAttempt: now()});
    const tab = await ownedTab(id);
    cancellation.tabId = tab.id;
    // At most 20 seconds of load retries; no repeated export clicks.
    for (let attempt = 0; attempt < 40; attempt++) {
      if (cancellation.stopped) return {status: 'stopped'};
      const current = await chrome.tabs.get(tab.id);
      if (current.active) throw new Error('tab_active');
      if (current.status === 'complete') {
        if (!permittedURL(id, current.url)) throw new Error('signed_out');
        let ready;
        try { ready = await chrome.tabs.sendMessage(tab.id, {kind: 'finance-export-ready', provider: id}); } catch {}
        if (ready?.ready) {
          if (cancellation.stopped) return {status: 'stopped'};
          const result = await chrome.tabs.sendMessage(tab.id, {kind: 'finance-export-request', provider: id});
          if (cancellation.stopped) return {status: 'stopped'};
          if (!result?.requested) throw new Error(result?.reason || 'controls_missing');
          await update(id, {status: 'requested', paused: false, lastRequested: now()});
          return {status: 'requested'};
        }
        if (ready?.reason === 'signed_out') throw new Error('signed_out');
      }
      await wait(500);
    }
    throw new Error('controls_missing');
  }
  async function run(id, manual = false) {
    if (!PROVIDERS[id]) throw new Error('Unknown provider.');
    if (running.has(id)) return running.get(id).promise;
    const current = (await state())[id];
    if (running.has(id)) return running.get(id).promise;
    if (!manual && (!current.enabled || current.paused)) return {status: 'off'};
    const cancellation = {stopped: false};
    const promise = (async () => {
      try { return await execute(id, cancellation); }
      catch (error) {
        if (cancellation.stopped) return {status: 'stopped'};
        const status = error.message === 'tab_active' ? 'tab_active' : error.message === 'signed_out' ? 'sign_in_required' : 'needs_attention';
        const paused = status !== 'tab_active';
        await update(id, {status, paused});
        if (paused) await chrome.alarms.clear('finance:' + id);
        return {status};
      } finally { running.delete(id); }
    })();
    running.set(id, {promise, cancellation}); return promise;
  }
  async function command(id, action) {
    if (!PROVIDERS[id]) throw new Error('Unknown provider.');
    if (action === 'stop') {
      const active = running.get(id);
      if (active) active.cancellation.stopped = true;
      if (active?.cancellation.tabId !== undefined) await chrome.tabs.sendMessage(active.cancellation.tabId, {kind: 'finance-export-cancel'}).catch(() => {});
      await chrome.alarms.clear('finance:' + id);
      await update(id, {enabled: false, paused: false, status: 'off'});
      return {status: 'off'};
    }
    if (action === 'start') {
      await update(id, {enabled: true, paused: false});
      await chrome.alarms.create('finance:' + id, {delayInMinutes: 15, periodInMinutes: 15});
      return run(id);
    }
    if (action === 'try') {
      const result = await run(id, true);
      if (result.status === 'requested' && (await state())[id].enabled) await chrome.alarms.create('finance:' + id, {delayInMinutes: 15, periodInMinutes: 15});
      return result;
    }
    throw new Error('Unknown action.');
  }
  async function restore() {
    for (const [id, value] of Object.entries(await state())) {
      if (value.enabled && !value.paused) await chrome.alarms.create('finance:' + id, {delayInMinutes: 15, periodInMinutes: 15});
      else await chrome.alarms.clear('finance:' + id);
    }
  }
  return {state, command, run, restore};
}
