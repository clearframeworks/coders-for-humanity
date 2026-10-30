import {createHash} from 'node:crypto';
import {InputError} from './validation.mjs';

const fail = message => { throw new InputError(message); };
const hash = value => createHash('sha256').update(value).digest('hex');
const normalized = value => value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
function headers(raw, name) { return (raw.payload?.headers || []).filter(item => item?.name?.toLowerCase() === name.toLowerCase()).map(item => item.value); }
function header(raw, name) {
  const values = headers(raw, name);
  if (values.length !== 1 || typeof values[0] !== 'string') fail(`Cash App sent email needs one ${name} header.`);
  return values[0].trim();
}
function parts(payload, result = {plain: [], html: []}, depth = 0) {
  if (!payload || depth > 12) fail('Cash App sent email MIME structure is unsupported.');
  if (['text/plain', 'text/html'].includes(payload.mime_type)) {
    const body = payload.body || {};
    const value = typeof body.content === 'string' ? body.content : typeof body.base64_url_content === 'string' ? Buffer.from(body.base64_url_content, 'base64url').toString('utf8') : '';
    if (value) result[payload.mime_type === 'text/plain' ? 'plain' : 'html'].push(value);
  }
  for (const child of payload.parts || []) parts(child, result, depth + 1);
  return result;
}
function entities(value) {
  const names = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™', hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•'};
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, key) => {
    if (key[0] !== '#') { if (!(key.toLowerCase() in names)) fail('Cash App sent receipt contains an unsupported HTML entity.'); return names[key.toLowerCase()]; }
    const number = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    if (!Number.isInteger(number) || number < 32 || number > 0x10ffff || (number >= 0xd800 && number <= 0xdfff)) fail('Cash App sent receipt contains an invalid HTML entity.');
    return String.fromCodePoint(number);
  });
}

// Static, bounded tokenization only. No DOM, scripts, styles, images or URLs are
// executed or fetched. Ancestor visibility is retained for evidence fields.
function receiptNodes(html) {
  const root = {tag: 'root', attrs: {}, children: [], hidden: false}, stack = [root], nodes = [];
  const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  for (const match of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z][^>]*>|[^<]+/g)) {
    const token = match[0];
    if (token.startsWith('<!--') || token.startsWith('<!')) continue;
    if (token.startsWith('</')) {
      const tag = /^<\/([\w:-]+)/.exec(token)?.[1].toLowerCase();
      const position = stack.findLastIndex(node => node.tag === tag);
      if (position <= 0) fail('Cash App sent receipt HTML structure is unsupported.');
      stack.length = position; continue;
    }
    if (!token.startsWith('<')) { stack.at(-1).children.push(token); continue; }
    const opening = /^<([\w:-]+)\b([\s\S]*?)\/?\s*>$/.exec(token);
    if (!opening) fail('Cash App sent receipt HTML structure is unsupported.');
    const tag = opening[1].toLowerCase(), attrs = {};
    for (const attribute of opening[2].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      const name = attribute[1].toLowerCase(); if (name in attrs) fail('Cash App sent receipt has ambiguous HTML attributes.');
      attrs[name] = attribute[2] ?? attribute[3] ?? attribute[4] ?? '';
    }
    const parent = stack.at(-1);
    const hidden = parent.hidden || ['script', 'style', 'template', 'iframe', 'object'].includes(tag) || 'hidden' in attrs || attrs['aria-hidden'] === 'true' || /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attrs.style || '');
    const node = {tag, attrs, children: [], hidden}; parent.children.push(node); nodes.push(node);
    if (nodes.length > 100000 || stack.length > 100) fail('Cash App sent receipt HTML exceeds the supported limits.');
    if (!voids.has(tag) && !/\/\s*>$/.test(token)) stack.push(node);
  }
  return nodes;
}
function content(node) {
  const collect = current => typeof current === 'string' ? current : current.tag === 'br' ? '\n' : ['script', 'style', 'template', 'iframe', 'object'].includes(current.tag) ? '' : current.children.map(collect).join('');
  return entities(collect(node)).replace(/[\t\r\f ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n+/g, '\n').trim();
}
const hasClass = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name);
const leafCell = node => node.tag === 'td' && !node.children.some(child => typeof child !== 'string' && child.tag === 'table');
function one(nodes, label) {
  const hiddenChild = node => node.children.some(child => typeof child !== 'string' && (child.hidden || hiddenChild(child)));
  if (nodes.length !== 1 || nodes[0].hidden || hiddenChild(nodes[0])) fail(`Cash App sent receipt ${label} is missing, hidden or ambiguous.`);
  return content(nodes[0]);
}
function amount(value) {
  if (!/^\$(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{2})?$/.test(value)) fail('Cash App sent payment amount is invalid.');
  const cents = Math.round(Number(value.replace(/[$,]/g, '')) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 100000000000) fail('Cash App sent payment amount is invalid.');
  return -cents / 100;
}

/** Gmail-native evidence only. Authentication is Gmail's verdict, not a local
 * cryptographic verification of arbitrary caller-supplied JSON. */
export function parseCashAppSentEmail(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Buffer.byteLength(JSON.stringify(raw)) > 5000000) fail('Choose a Gmail-native Cash App sent email smaller than 5 MB.');
  if (typeof raw.id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(raw.id)) fail('Cash App sent email needs its stable Gmail message ID.');
  if (!/^(?:cash@square\.com|[^<>\r\n]*<cash@square\.com>)$/i.test(header(raw, 'From'))) fail('Cash App sent email sender is not cash@square.com.');
  if (header(raw, 'Subject') !== 'Payment sent') fail('Cash App sent email is not the supported Payment sent template.');
  const auths = headers(raw, 'Authentication-Results').filter(value => typeof value === 'string' && /^mx\.google\.com\s*;/i.test(value.trim()));
  if (auths.length !== 1) fail('Cash App sent email needs unambiguous Gmail authentication results.');
  const auth = auths[0];
  if (!/\bdkim=pass\b[^;]*\bheader\.(?:i|d)=(?:@|[^\s;@]+@)?square\.com(?=[;\s]|$)/i.test(auth) || !/\bdmarc=pass\b[^;]*\bheader\.from=square\.com(?=[;\s]|$)/i.test(auth) || !/\bspf=pass\b/i.test(auth) || /\b(?:dkim|dmarc|spf)=(?:fail|softfail|neutral|none|temperror|permerror)\b/i.test(auth)) fail('Cash App sent email lacks passing aligned Gmail authentication results.');
  const bodies = parts(raw.payload);
  if (bodies.plain.length !== 1 || bodies.html.length !== 1) fail('Cash App sent email needs one plain text and one HTML receipt.');
  const plain = /^You paid (.{1,200}?)\s+(\$(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{2})?)(?:\s+for\s+(.{1,500}))?$/u.exec(bodies.plain[0].replace(/\s+/gu, ' ').trim());
  if (!plain) fail('Cash App sent plain text does not match the supported payment template.');
  const recipient = plain[1].trim(), paymentAmount = amount(plain[2]), note = plain[3]?.trim() || '';
  const nodes = receiptNodes(bodies.html[0]), cells = nodes.filter(leafCell);
  const profileRecipient = one(cells.filter(node => hasClass(node, 'text-standard') && /\bfont-size\s*:\s*32px\b/i.test(node.attrs.style || '')), 'recipient heading');
  const profiles = cells.filter(node => hasClass(node, 'profile-description') && /^For\s/.test(content(node)));
  const profileNote = profiles.length ? one(profiles, 'note') : '';
  const htmlAmount = one(cells.filter(node => /\bfont-size\s*:\s*48px\b/i.test(node.attrs.style || '') && /^\$/.test(content(node))), 'amount');
  const parties = one(cells.filter(node => /^Recipient:/.test(content(node))), 'recipient and sender');
  const partiesMatch = /^Recipient:\s*([^\n]{1,200})\nSender:\s*([^\n]{1,200})$/.exec(parties);
  if (!partiesMatch || normalized(recipient) !== normalized(profileRecipient) || normalized(recipient) !== normalized(partiesMatch[1]) || paymentAmount !== amount(htmlAmount) || normalized(profileNote) !== normalized(note ? `For ${note}` : '')) fail('Cash App sent plain text and HTML amount, recipient or note disagree.');
  const headlines = cells.filter(node => hasClass(node, 'timeline-row-headline-title'));
  const statuses = headlines.filter(node => /^(?:Complete|Pending|Cancelled|Canceled|Failed|Reversed|Refunded|Declined)$/i.test(content(node)));
  const status = one(statuses, 'status');
  if (!['Complete', 'Pending'].includes(status)) fail('Cash App sent receipt status is unsupported.');
  const confirmation = cells.filter(node => hasClass(node, 'timeline-row-subheadline-title') && /^(?:Payment sent successfully|Payment pending|Payment is pending|Payment failed|Payment cancelled|Payment canceled)$/i.test(content(node)));
  const confirmationText = one(confirmation, 'payment confirmation');
  if (status === 'Complete' ? confirmationText !== 'Payment sent successfully' : !['Payment pending', 'Payment is pending'].includes(confirmationText)) fail('Cash App sent status and payment confirmation disagree.');
  one(headlines.filter(node => content(node) === 'Payment source'), 'payment source label');
  const receipts = new Set();
  for (const node of nodes.filter(node => node.tag === 'a' && typeof node.attrs.href === 'string')) {
    let url; try { url = new URL(entities(node.attrs.href)); } catch { continue; }
    if (!url.pathname.startsWith('/launch/activity/receipt/')) continue;
    const token = /^\/launch\/activity\/receipt\/([A-Za-z0-9_+=\/-]{8,4096})$/.exec(url.pathname)?.[1];
    if (url.origin !== 'https://cash.app' || url.username || url.password || url.hash || !token || [...url.searchParams.keys()].some(key => !['accountPid', 'metadata_id'].includes(key))) fail('Cash App sent email contains an invalid official receipt link.');
    receipts.add(token);
  }
  if (receipts.size !== 1) fail('Cash App sent email needs one unambiguous official receipt identity.');
  if (typeof raw.internal_date !== 'string' || !/^\d{13}$/.test(raw.internal_date)) fail('Cash App sent email needs its Gmail received timestamp.');
  const received = new Date(Number(raw.internal_date));
  if (!Number.isFinite(received.getTime()) || received.getUTCFullYear() < 2000 || received.getUTCFullYear() > 2200) fail('Cash App sent email received date is invalid.');
  const date = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'}).format(received);
  const receivedTime = new Intl.DateTimeFormat('en-GB', {timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'}).format(received);
  return {provider: 'cashapp', paymentKind: 'p2p', cashAppType: 'P2P', messageId: raw.id, receiptId: hash([...receipts][0]), status: status === 'Complete' ? 'completed' : 'pending', date, receivedAt: received.toISOString(), receivedTime, amount: paymentAmount, recipient, note, merchant: `Cash App to ${recipient}${note ? ` — ${note}` : ''}`.slice(0, 500), category: 'Other', needsReview: true, dateBasis: 'email_received', authentication: 'gmail-aligned-pass'};
}
