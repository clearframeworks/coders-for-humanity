const labels = {
  off: 'Off.', opening: 'Opening a dedicated account tab…',
  requested: 'Official CSV export requested. Check the finance app for the actual import.',
  tab_active: 'Collector tab is in use. Leave it in the background; the next check will retry.',
  sign_in_required: 'Paused. Sign in using the link below, then Resume or Try once.',
  needs_attention: 'Paused. Sign in and check the official export page, then retry. A changed page or multiple checking accounts may need attention.'
};
async function request(action, provider) {
  const response = await chrome.runtime.sendMessage({kind: 'finance-popup', action, provider});
  if (!response?.ok) throw new Error(response?.error || 'Could not reach the collector. Reopen this popup and retry.');
  return response.value;
}
async function render() {
  const state = await request('state');
  for (const section of document.querySelectorAll('[data-provider]')) {
    const value = state[section.dataset.provider];
    section.querySelector('.status').textContent = `${value.enabled ? value.paused ? 'Collection paused. ' : 'Every 15 minutes. ' : 'Automatic collection off. '}${labels[value.status] || 'Check the account page and retry.'}`;
    section.querySelector('.last').textContent = value.lastRequested ? 'Last export request: ' + new Date(value.lastRequested).toLocaleString() : 'No export requested yet.';
    section.querySelector('.start').textContent = value.paused ? 'Resume every 15 min' : 'Start every 15 min';
    section.querySelector('.start').disabled = value.enabled && !value.paused;
    section.querySelector('.stop').disabled = !value.enabled && value.status === 'off';
  }
}
for (const section of document.querySelectorAll('[data-provider]')) {
  for (const action of ['start', 'try', 'stop']) section.querySelector('.' + action).onclick = async () => {
    document.querySelector('#error').textContent = '';
    const button = section.querySelector('.' + action); button.disabled = true;
    if (action !== 'stop') {section.querySelector('.status').textContent = 'Checking the official export controls…';section.querySelector('.stop').disabled = false;}
    try { await request(action, section.dataset.provider); }
    catch (error) { document.querySelector('#error').textContent = error.message; }
    finally { button.disabled = false; await render().catch(error => {document.querySelector('#error').textContent = error.message;}); }
  };
}
render().catch(error => {document.querySelector('#error').textContent = error.message;});
