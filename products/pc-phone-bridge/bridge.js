const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const dir = process.env.BRIDGE_DATA_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'), 'PCPhoneBridge');
fs.mkdirSync(dir, {recursive:true});
const configPath = path.join(dir,'apps.json'), keyPath = path.join(dir,'access-key.txt');
if (!fs.existsSync(configPath)) fs.writeFileSync(configPath, JSON.stringify({apps:[]}, null, 2), {flag:'wx'});
if (!fs.existsSync(keyPath)) fs.writeFileSync(keyPath, crypto.randomBytes(24).toString('base64url'), {flag:'wx', mode:0o600});
const key = fs.readFileSync(keyPath,'utf8').trim();
const read = () => JSON.parse(fs.readFileSync(configPath,'utf8'));
const save = obj => { const t=configPath+'.tmp'; fs.writeFileSync(t,JSON.stringify(obj,null,2)); fs.renameSync(t,configPath); };
const [,,command,...args] = process.argv;
if (command === 'add') {
  const [id, port, ...rest] = args, name=rest.join(' ');
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id||'') || !/^\d+$/.test(port||'') || +port<1 || +port>65535 || !name || name.length>80) { console.error('Usage: node bridge.js add <id> <port> <name>'); process.exit(1); }
  const c=read(); if(c.apps.some(a=>a.id===id)) {console.error('That ID already exists.');process.exit(1)}
  c.apps.push({id, port:+port, name}); save(c); console.log('Added '+name+'.'); process.exit();
}
if(command==='remove') {const c=read(), n=c.apps.length; c.apps=c.apps.filter(a=>a.id!==args[0]); if(n===c.apps.length){console.error('App not found.');process.exit(1)} save(c);console.log('Removed.');process.exit();}
if(command==='list') {console.log(read().apps.map(a=>`${a.id}\t${a.port}\t${a.name}`).join('\n')||'No apps added.');process.exit();}
if(command==='key') { console.log('Access key file: '+keyPath); process.exit(); }
if(command && command!=='serve') {console.error('Use serve, add, remove, list, or key.');process.exit(1)}
const port=Number(process.env.BRIDGE_PORT||46820), sessions=new Map(); let failures=[];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const style=`<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px system-ui;background:#101820;color:#f5f7fa;max-width:680px;margin:auto;padding:28px 20px}h1{font-size:2rem;margin-bottom:6px}p{color:#b7c6ce;line-height:1.5}a{color:#91e6d2}label{display:block;margin:20px 0 8px}input{box-sizing:border-box;width:100%;padding:13px;font:inherit;border-radius:8px;border:1px solid #879aa3;background:#1d2c35;color:white}button,.app{font:inherit;border-radius:8px;padding:14px;margin-top:14px;background:#a8ead8;color:#102a27;border:0;font-weight:700}button{cursor:pointer}.app{display:block;text-decoration:none}small{color:#b7c6ce}form{margin:0}.note{padding:14px;border:1px solid #435963;border-radius:8px}</style>`;
function page(title,body){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title} · PC Bridge</title>${style}</head><body><h1>PC Bridge</h1>${body}</body></html>`}
function reply(res,status,html){res.writeHead(status,{'Content-Type':'text/html; charset=utf-8',...headers});res.end(html)}
function signed(req){const m=(req.headers.cookie||'').match(/(?:^|;\s*)bridge_session=([A-Za-z0-9_-]+)/); if(!m)return false; const expiry=sessions.get(m[1]); if(!expiry || expiry<Date.now()){sessions.delete(m[1]);return false}return true}
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(!['GET','HEAD','OPTIONS'].includes(req.method)){let ok=false;try{const o=new URL(req.headers.origin);ok=['http:','https:'].includes(o.protocol)&&o.host===req.headers.host}catch{} if(!ok)return reply(res,403,page('Request blocked','<p>Request origin was not accepted. Return to the bridge and try again.</p>'))}
 if(req.method==='GET' && url.pathname==='/login') return reply(res,200,page('Sign in',`<p>Enter the access key from your PC to open your apps.</p><form method="post" action="/login"><label for="key">Access key</label><input id="key" name="key" type="password" autocomplete="current-password" required><button>Connect</button></form>`));
 if(req.method==='POST' && url.pathname==='/login') {failures=failures.filter(t=>t>Date.now()-300000);if(failures.length>=5){res.setHeader('Retry-After','300');return reply(res,429,page('Try again later','<p>Too many attempts. Wait five minutes, then try again.</p>'))}let b='';req.on('data',x=>{b+=x;if(b.length>4096)req.destroy()});req.on('end',()=>{const v=new URLSearchParams(b).get('key')||''; const a=Buffer.from(v), k=Buffer.from(key); if(a.length!==k.length||!crypto.timingSafeEqual(a,k)){failures.push(Date.now());return reply(res,401,page('Sign in',`<p>That key didn’t match. <a href="/login">Try again</a>.</p>`))}failures=[];const s=crypto.randomBytes(32).toString('base64url');sessions.set(s,Date.now()+12*60*60*1000);res.writeHead(303,{Location:'/', 'Set-Cookie':`bridge_session=${s}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`,'Cache-Control':'no-store'});res.end()});return}
 if(!signed(req)){res.writeHead(303,{Location:'/login','Cache-Control':'no-store'});return res.end()}
 if(url.pathname==='/logout' && req.method==='POST'){const m=(req.headers.cookie||'').match(/bridge_session=([A-Za-z0-9_-]+)/);if(m)sessions.delete(m[1]);res.writeHead(303,{Location:'/login','Set-Cookie':'bridge_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});return res.end()}
 if(url.pathname==='/' && req.method==='GET'){const apps=read().apps;return reply(res,200,page('Your apps',`<p>Your apps on this PC</p>${apps.length?apps.map(a=>`<a class="app" href="/app/${esc(a.id)}/">${esc(a.name)} <span aria-hidden="true">→</span></a>`).join(''):'<p class="note">No apps added yet. Add one on your PC using the bridge launcher.</p>'}<p><small>Apps need to be running on your PC. Some apps need additional configuration to work under a path.</small></p><form method="post" action="/logout"><button>Sign out</button></form>`))}
 const m=url.pathname.match(/^\/app\/([a-z0-9-]+)(\/.*)$/), app=m&&read().apps.find(a=>a.id===m[1]);
 if(!app)return reply(res,404,page('Not found','<p>Page or app not found. <a href="/">Back to apps</a></p>'));
 const forward={...req.headers,host:`127.0.0.1:${app.port}`}; forward.cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(x=>x && !x.startsWith('bridge_session=')).join('; '); delete forward.authorization;
 const proxy=http.request({hostname:'127.0.0.1',port:app.port,method:req.method,path:m[2]+url.search,headers:forward},up=>{const h={...up.headers};if(h['set-cookie']) h['set-cookie']=h['set-cookie'].filter(c=>!/^bridge_session=/i.test(c)).map(c=>{let parts=c.split(';').filter(x=>!/^\s*(domain|path)=/i.test(x));return parts.join(';')+`; Path=/app/${app.id}/`;}); delete h['www-authenticate']; if(h.location && h.location.startsWith('/')&&!h.location.startsWith('//'))h.location=`/app/${app.id}${h.location}`;res.writeHead(up.statusCode,h);up.pipe(res)});
 proxy.on('error',()=>{if(!res.headersSent)reply(res,502,page('App unavailable',`<p>${esc(app.name)} isn’t responding on the PC. Start the app and try again.</p><p><a href="/app/${esc(app.id)}/">Try again</a> · <a href="/">Back to apps</a></p>`));else res.destroy()});req.pipe(proxy);
});
server.on('upgrade',(req,socket,head)=>{
 let originOK=true; try{if(req.headers.origin)originOK=new URL(req.headers.origin).host===req.headers.host}catch{originOK=false} if(!signed(req) || !originOK){socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');return}
 let url; try{url=new URL(req.url,'http://localhost')}catch{socket.destroy();return}
 const m=url.pathname.match(/^\/app\/([a-z0-9-]+)(\/.*)$/),app=m&&read().apps.find(a=>a.id===m[1]);
 if(!app){socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');return}
 const upstream=net.connect(app.port,'127.0.0.1',()=>{const headers={...req.headers,host:`127.0.0.1:${app.port}`};headers.cookie=(headers.cookie||'').split(';').map(x=>x.trim()).filter(x=>x&&!x.startsWith('bridge_session=')).join('; ');delete headers.authorization;let out=`${req.method} ${m[2]}${url.search} HTTP/1.1\r\n`;for(const [k,v] of Object.entries(headers))out+=`${k}: ${v}\r\n`;upstream.write(out+'\r\n');if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket)});upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());
});
server.listen(port,'127.0.0.1',()=>console.log(`PC Bridge: http://127.0.0.1:${port}\nAccess key file: ${keyPath}\nListening on this PC only.`));
