import {createHash} from 'node:crypto';
import {InputError} from './validation.mjs';
import {suggestCategory} from '../dist/engine.mjs';
const fail=message=>{throw new InputError(message);};
function header(raw,name){const values=(raw.payload?.headers||[]).filter(item=>item?.name?.toLowerCase()===name.toLowerCase()).map(item=>item.value);if(values.length!==1||typeof values[0]!=='string')fail(`Fifth Third alert needs one ${name} header.`);return values[0].trim();}
function htmlParts(payload,result=[],depth=0){
  if(!payload||depth>12)fail('Fifth Third alert MIME structure is unsupported.');
  if(payload.mime_type==='text/html'){const body=payload.body||{};result.push(typeof body.content==='string'?body.content:typeof body.base64_url_content==='string'?Buffer.from(body.base64_url_content,'base64url').toString('utf8'):'');}
  for(const part of payload.parts||[])htmlParts(part,result,depth+1);return result;
}
function entities(text){
  const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(whole,key)=>{
    if(key[0]!=='#'){if(!(key.toLowerCase() in named))fail('Fifth Third purchase contains an unsupported HTML entity.');return named[key.toLowerCase()];}
    const number=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
    if(!Number.isInteger(number)||number<32||number>0x10ffff||(number>=0xd800&&number<=0xdfff))fail('Fifth Third purchase contains an invalid HTML entity.');return String.fromCodePoint(number);
  });
}

/** A bank purchase notification is reported activity, not proof of settlement. */
export function parseFifthThirdEmail(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Buffer.byteLength(JSON.stringify(raw))>5000000)fail('Choose a Gmail-native Fifth Third alert smaller than 5 MB.');
  if(typeof raw.id!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(raw.id))fail('Fifth Third alert needs its stable Gmail message ID.');
  if(!/^(?:FifthThirdBank@53\.com|[^<>\r\n]*<FifthThirdBank@53\.com>)$/i.test(header(raw,'From')))fail('Fifth Third alert sender is not FifthThirdBank@53.com.');
  if(header(raw,'Subject')!=='Card Purchase')fail('Fifth Third alert is not the supported Card Purchase template.');
  const auths=(raw.payload.headers||[]).filter(item=>item?.name?.toLowerCase()==='authentication-results'&&typeof item.value==='string'&&/^mx\.google\.com\s*;/i.test(item.value.trim()));
  if(auths.length!==1)fail('Fifth Third alert needs unambiguous Gmail authentication results.');
  const auth=auths[0].value;
  if(!/\bdkim=pass\b[^;]*\bheader\.(?:i|d)=(?:@|[^\s;@]+@)?53\.com(?=[;\s]|$)/i.test(auth)||!/\bdmarc=pass\b[^;]*\bheader\.from=53\.com(?=[;\s]|$)/i.test(auth)||!/\bspf=pass\b/i.test(auth)||/\b(?:dkim|dmarc|spf)=(?:fail|softfail|neutral|none|temperror|permerror)\b/i.test(auth))fail('Fifth Third alert lacks passing aligned Gmail authentication results.');
  const messageId=header(raw,'Message-ID');
  if(!/^<[^<>\s@]{1,900}@[^<>\s@]{1,250}>$/.test(messageId))fail('Fifth Third alert needs a valid provider Message-ID.');
  const parts=htmlParts(raw.payload);if(parts.length!==1||!parts[0])fail('Fifth Third alert needs one HTML body.');
  const clean=parts[0].replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  const paragraphs=[...clean.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p\s*>/gi)];
  const candidates=paragraphs.filter(match=>/your card ending|was used to make a purchase/i.test(match[2].replace(/<[^>]*>/g,' ')));
  if(candidates.some(match=>/\bhidden\b|\baria-hidden\s*=\s*["']?true|(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(match[1])))fail('Fifth Third purchase paragraph is hidden or misleading.');
  const purchases=candidates.map(match=>entities(match[2].replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim());
  if((clean.replace(/<[^>]*>/g,' ').match(/was used to make a purchase/gi)||[]).length!==1)fail('Fifth Third purchase body is missing or ambiguous.');
  if(purchases.length!==1)fail('Fifth Third purchase paragraph is missing or ambiguous.');
  const purchase=/^Your card ending in x\d{4} was used to make a purchase of (\$(?:\d+|\d{1,3}(?:,\d{3})+)\.\d{2}) at (.{1,500})\.$/.exec(purchases[0]);
  if(!purchase)fail('Fifth Third alert is not the supported purchase paragraph.');
  const amountCents=Math.round(Number(purchase[1].replace(/[$,]/g,''))*100),merchant=purchase[2].trim();
  if(!Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>100000000000||!merchant||/[<>\r\n]|[.!?]\s/.test(merchant))fail('Fifth Third purchase amount or merchant is invalid.');
  if(typeof raw.internal_date!=='string'||!/^\d{13}$/.test(raw.internal_date))fail('Fifth Third alert needs its Gmail received timestamp.');
  const received=new Date(Number(raw.internal_date));if(!Number.isFinite(received.getTime())||received.getUTCFullYear()<2000||received.getUTCFullYear()>2200)fail('Fifth Third received date is invalid.');
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(received);
  return {provider:'fifththird',messageId:raw.id,receiptId:'fifththird-email:'+createHash('sha256').update(messageId).digest('hex'),status:'reported',date,amount:-amountCents/100,merchant,category:suggestCategory(merchant),dateBasis:'email_received',authentication:'gmail-aligned-pass'};
}
