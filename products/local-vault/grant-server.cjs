'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const PORT = 8788, HOST = '127.0.0.1';
const grants = new Map();
const uiKey = crypto.randomBytes(32).toString('base64url');
function reply(res, code, data) { res.writeHead(code, { 'content-type':'application/json', 'cache-control':'no-store', 'x-content-type-options':'nosniff' }); res.end(JSON.stringify(data)); }
function body(req) { return new Promise((resolve, reject) => { let data=''; req.on('data', b => { data += b; if (data.length > 16384) { reject(new Error('Too large')); req.destroy(); } }); req.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } }); req.on('error',reject); }); }
function validHost(req) { return req.headers.host === `${HOST}:${PORT}`; }
function uiRequest(req) { return req.headers.origin === `http://${HOST}:${PORT}` && req.headers['x-vault-ui-key'] === uiKey && req.headers['content-type'] === 'application/json'; }
const page=fs.readFileSync(path.join(__dirname,'grant.html'),'utf8').replace('UI_KEY_PLACEHOLDER',uiKey);
const server=http.createServer(async (req,res) => {
  res.setHeader('cache-control','no-store');
  if (!validHost(req)) return reply(res,403,{error:'Forbidden'});
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if(req.method==='GET' && url.pathname==='/') { res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",'x-frame-options':'DENY','referrer-policy':'no-referrer'}); return res.end(page); }
  if(req.method==='POST' && url.pathname==='/grant') {
    if(!uiRequest(req)) return reply(res,403,{error:'Forbidden'});
    try { const d=await body(req); if(typeof d.label!=='string'||!d.label.trim()||d.label.length>120||typeof d.secret!=='string'||!d.secret||d.secret.length>8192||!Number.isInteger(d.seconds)||d.seconds<10||d.seconds>300) return reply(res,400,{error:'Enter a label, secret, and duration from 10 to 300 seconds.'});
      const token=crypto.randomBytes(32).toString('base64url'), id=crypto.randomUUID();
      const expires=Date.now()+d.seconds*1000;
      const timer=setTimeout(()=>grants.delete(token), d.seconds*1000); timer.unref();
      if(grants.size) { clearTimeout(timer); return reply(res,409,{error:'Another grant is active. Revoke it or wait for it to expire.'}); }
      grants.set(token,{id,label:d.label,secret:d.secret,expires,timer}); return reply(res,201,{id,token,expires});
    } catch { return reply(res,400,{error:'Invalid request'}); }
  }
  if(req.method==='POST' && url.pathname==='/vault-grant') {
    if(!uiRequest(req)) return reply(res,403,{error:'Forbidden'});
    if(process.env.LOCAL_VAULT_EXPERIMENTAL_ITEM_GRANT !== '1') return reply(res,503,{error:'Direct vault access is disabled pending further security review. Use the manual grant.'});
    try {
      const d=await body(req);
      if(typeof d.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.id)||typeof d.session!=='string'||!d.session||d.session.length>512||!Number.isInteger(d.seconds)||d.seconds<10||d.seconds>300) return reply(res,400,{error:'Enter a valid item ID, unlocked CLI session and duration.'});
      const cli=path.join(__dirname,'node_modules','@bitwarden','cli','build','bw.js');
      if(!fs.existsSync(cli)) return reply(res,503,{error:'Bitwarden CLI is not installed in this folder.'});
      const stateDir=process.env.BITWARDENCLI_APPDATA_DIR || path.join(process.env.APPDATA || '', 'Bitwarden CLI');
      const state=JSON.parse(fs.readFileSync(path.join(stateDir,'data.json'),'utf8'));
      const config=state.global_environment_environment;
      const allowed=['http://localhost:8787','http://127.0.0.1:8787'];
      if(config?.region!=='Self-hosted'||!config.urls||!allowed.includes(config.urls.base)) return reply(res,403,{error:'Configure the CLI for the local vault before using this feature.'});
      for(const value of Object.values(config.urls)) {
        if(value===null || value==='') continue;
        if(typeof value!=='string') return reply(res,403,{error:'Invalid CLI endpoint configuration.'});
        let endpoint; try { endpoint=new URL(value); } catch { return reply(res,403,{error:'Invalid CLI endpoint configuration.'}); }
        if(!allowed.includes(endpoint.origin)||endpoint.username||endpoint.password) return reply(res,403,{error:'All CLI endpoints must point to this local vault.'});
      }
      const env={...process.env,BW_SESSION:d.session};
      const statusText=await new Promise((resolve,reject)=>execFile(process.execPath,[cli,'status','--raw','--nointeraction'],{env,timeout:15000,maxBuffer:16384,windowsHide:true},(err,out)=>err?reject(err):resolve(out)));
      const status=JSON.parse(statusText);
      if(!['http://localhost:8787','http://127.0.0.1:8787'].includes(status.serverUrl)) return reply(res,403,{error:'CLI must be configured for this local vault on port 8787.'});
      const value=await new Promise((resolve,reject)=>execFile(process.execPath,[cli,'get','item',d.id,'--raw','--nointeraction'],{env,timeout:15000,maxBuffer:16384,windowsHide:true},(err,out)=>err?reject(err):resolve(out)));
      const item=JSON.parse(value), password=item?.login?.password;
      if(typeof password!=='string'||!password||password.length>8192) return reply(res,400,{error:'Item has no usable password.'});
      const token=crypto.randomBytes(32).toString('base64url'),id=crypto.randomUUID(),expires=Date.now()+d.seconds*1000;
      const timer=setTimeout(()=>grants.delete(token),d.seconds*1000);timer.unref();
      if(grants.size) { clearTimeout(timer); return reply(res,409,{error:'Another grant is active. Revoke it or wait for it to expire.'}); }
      grants.set(token,{id,label:'Selected vault item',secret:password,expires,timer}); return reply(res,201,{id,token,expires});
    } catch { return reply(res,400,{error:'Could not read that item. Check the item ID and that the local CLI is configured, logged in and unlocked.'}); }
  }
  if(req.method==='POST' && url.pathname==='/revoke') {
    if(!uiRequest(req)) return reply(res,403,{error:'Forbidden'});
    try { const d=await body(req); for(const [token,g] of grants) if(g.id===d.id){clearTimeout(g.timer);grants.delete(token); return reply(res,200,{revoked:true});} return reply(res,404,{error:'Already used, expired, or revoked'}); } catch { return reply(res,400,{error:'Invalid request'}); }
  }
  if(req.method==='POST' && url.pathname==='/consume') {
    if(req.headers.origin || req.headers['sec-fetch-site']) return reply(res,403,{error:'Browser requests are not allowed'});
    const auth=req.headers.authorization || ''; if(!auth.startsWith('Bearer ')) return reply(res,401,{error:'Grant required'});
    const token=auth.slice(7), grant=grants.get(token); if(!grant) return reply(res,403,{error:'Invalid, expired, used or revoked grant'});
    grants.delete(token); clearTimeout(grant.timer); if(Date.now()>=grant.expires) return reply(res,403,{error:'Expired grant'});
    return reply(res,200,{label:grant.label,secret:grant.secret});
  }
  return reply(res,404,{error:'Not found'});
});
server.on('error', e => { console.error('Could not start local grant service:',e.message); process.exitCode=1; });
server.listen(PORT,HOST,()=>console.log(`Grant service running at http://${HOST}:${PORT} (local computer only)`));
