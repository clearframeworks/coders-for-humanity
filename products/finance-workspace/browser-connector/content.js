(() => {
  let generation = 0, busy = false;
  function visible(element) { return !!element && !element.disabled && element.getClientRects().length > 0; }
  function label(element) { return (element.getAttribute('aria-label') || element.textContent || '').trim(); }
  function calendarDate(value) {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
    const iso = match ? `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}` : value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const date = new Date(iso + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
  }
  function dateControl(kind) {
    const found = new Set();
    const add = element => {
      if (!element) return;
      const candidates = element.tagName === 'INPUT' ? [element] : [...element.querySelectorAll('input')];
      for (const input of candidates) if (visible(input) && !input.readOnly && ['text', 'date', ''].includes(input.type || '') && calendarDate(input.value)) found.add(input);
    };
    const expected = kind === 'start' ? /^Start\s*Date:?$/i : /^End\s*Date:?$/i;
    for (const element of document.querySelectorAll('label')) {
      if (!expected.test(element.textContent.trim())) continue;
      if (element.htmlFor) add(document.getElementById(element.htmlFor));
      else add(element);
    }
    for (const element of document.querySelectorAll(`[id="${kind}Calendar"],[name="${kind}Calendar"]`)) add(element);
    return found.size === 1 ? [...found][0] : null;
  }
  function today() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function dateValue(input, iso) {
    return /^\d{4}-\d{2}-\d{2}$/.test(input.value.trim()) ? iso : `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
  }
  function controls(provider, accountOnly = false) {
    const url = new URL(location.href);
    if (provider === 'cashapp' && url.origin === 'https://cash.app' && url.pathname === '/account/activity') {
      const button = [...document.querySelectorAll('button')].find(element => visible(element) && label(element) === 'Download');
      return button ? {button} : null;
    }
    if (provider === 'fifththird' && url.origin === 'https://secure.53.com' && url.pathname === '/olb/account/details/transactionExport') {
      const account = document.querySelector('select#From-account');
      if (!visible(account)) return null;
      const accounts = [...account.options].filter(option => !option.disabled && option.value.trim() && !/^(?:select|choose)\b/i.test(option.textContent.replace(/^[-–—\s]+/, '').trim()));
      if (accounts.length !== 1) return null;
      if (accountOnly) return {account, accountValue: accounts[0].value};
      const type = document.querySelector('select#type');
      const button = [...document.querySelectorAll('button,input[type="submit"]')].find(element => element.getClientRects().length > 0 && (label(element) || element.value).trim().toUpperCase() === 'SUBMIT');
      if (!visible(account) || !visible(type) || !button) return null;
      const csv = [...type.options].find(option => !option.disabled && /^(?:csv|comma separated(?: values)?)(?:\s*\(\.csv\))?$/i.test(option.textContent.trim()));
      const start = dateControl('start'), end = dateControl('end');
      if (accounts.length !== 1 || !csv || !start || !end || start === end || calendarDate(start.value) > today() || calendarDate(end.value) < calendarDate(start.value)) return null;
      return {account, type, button, start, end, accountValue: accounts[0].value, csvValue: csv.value};
    }
    return null;
  }
  function signedOut() {
    return /\/(?:login|signin|sign-in)(?:\/|$)/i.test(location.pathname) || [...document.querySelectorAll('h1,h2,button')].some(element => visible(element) && /^(?:sign in|log in|login)$/i.test(label(element)));
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message?.kind === 'finance-export-cancel') {generation++; sendResponse({cancelled: true}); return;}
    if (!['finance-export-ready', 'finance-export-request'].includes(message?.kind)) return;
    const selected = controls(message.provider, true);
    if (message.kind === 'finance-export-ready') { sendResponse({ready: !!selected, reason: selected ? null : signedOut() ? 'signed_out' : 'controls_missing'}); return; }
    if (!selected) { sendResponse({requested: false, reason: signedOut() ? 'signed_out' : 'controls_missing'}); return; }
    if (busy) {sendResponse({requested: false, reason: 'already_running'}); return;}
    busy = true;
    const token = generation;
    (async () => {
      try {
        if (selected.account) {
          // The official bank form renders dates/format only after its sole
          // account choice is selected. Do not require those fields beforehand.
          selected.account.value = selected.accountValue;
          selected.account.dispatchEvent(new Event('input', {bubbles: true}));
          selected.account.dispatchEvent(new Event('change', {bubbles: true}));
          let form = null;
          for (let attempt = 0; attempt < 50; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (generation !== token) {sendResponse({requested: false, reason: 'cancelled'}); return;}
            const current = controls(message.provider);
            if (current && current.account.value === selected.accountValue) {form = current; break;}
          }
          if (!form) {sendResponse({requested: false, reason: 'controls_missing'}); return;}
          const desiredEnd = today();
          for (const [element, value] of [[form.type, form.csvValue], [form.end, dateValue(form.end, desiredEnd)]]) {
            element.value = value;
            element.dispatchEvent(new Event('input', {bubbles: true}));
            element.dispatchEvent(new Event('change', {bubbles: true}));
          }
          // Framework-driven forms may replace/disable SUBMIT during onchange.
          for (let attempt = 0; attempt < 30; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (generation !== token) {sendResponse({requested: false, reason: 'cancelled'}); return;}
            const current = controls(message.provider);
            if (current && !current.button.disabled && current.account.value === selected.accountValue && current.type.value === form.csvValue && calendarDate(current.end.value) === desiredEnd && calendarDate(current.start.value) <= desiredEnd) {
              current.button.click(); sendResponse({requested: true}); return;
            }
          }
          sendResponse({requested: false, reason: 'controls_missing'}); return;
        }
        if (generation === token) {selected.button.click(); sendResponse({requested: true});}
        else sendResponse({requested: false, reason: 'cancelled'});
      } catch {sendResponse({requested: false, reason: 'controls_missing'});}
      finally {busy = false;}
    })();
    // A request is a click only; the receiver verifies the actual file separately.
    return true;
  });
})();
