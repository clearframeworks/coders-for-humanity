import {createCollector, PROVIDERS} from './controller.mjs';
const collector = createCollector(chrome);
chrome.runtime.onInstalled.addListener(() => collector.restore());
chrome.runtime.onStartup.addListener(() => collector.restore());
chrome.alarms.onAlarm.addListener(alarm => {
  const id = alarm.name.startsWith('finance:') ? alarm.name.slice(8) : '';
  if (PROVIDERS[id]) collector.run(id).catch(() => {});
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || sender.tab || message?.kind !== 'finance-popup') return;
  const task = message.action === 'state' ? collector.state() : collector.command(message.provider, message.action);
  task.then(value => sendResponse({ok: true, value}), () => sendResponse({ok: false, error: 'Collection could not run. Open the account export page and retry.'}));
  return true;
});
