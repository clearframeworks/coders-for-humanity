'use strict';
const {spawn}=require('node:child_process'); const assert=require('node:assert/strict'); const fs=require('node:fs'); const os=require('node:os'); const path=require('node:path');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'local-vault-test-')); const data=path.join(temp,'data.json');
const child=spawn(process.execPath,[path.join(__dirname,'grant-server.cjs')],{env:{...process.env,BITWARDENCLI_APPDATA_DIR:temp,LOCAL_VAULT_EXPERIMENTAL_ITEM_GRANT:'1'},stdio:'ignore'});
(async()=>{try{
 await new Promise(r=>setTimeout(r,700)); const base='http://127.0.0.1:8788';let html=await(await fetch(base)).text();const match=html.match(/const key='([^']+)'/);assert(match,'grant UI unavailable');const headers={'content-type':'application/json',origin:base,'x-vault-ui-key':match[1]};
 const request=async(url,data,h=headers)=>fetch(base+url,{method:'POST',headers:h,body:JSON.stringify(data)});
 let r=await request('/grant',{label:'fixture',secret:'test-only',seconds:10},{'content-type':'application/json'}); assert.equal(r.status,403);
 const fixture={id:'11111111-1111-4111-8111-111111111111',session:'test-only',seconds:10};
 const cli=path.join(__dirname,'node_modules','@bitwarden','cli','build','bw.js');
 if(!fs.existsSync(cli)) { r=await request('/vault-grant',fixture); assert.equal(r.status,503,'missing CLI must fail closed'); }
 else {
 r=await request('/vault-grant',fixture);assert.equal(r.status,400,'missing state must fail closed');
 fs.writeFileSync(data,JSON.stringify({global_environment_environment:{region:'Self-hosted',urls:{base:'http://localhost:8787',api:'https://example.com'}}}));
 r=await request('/vault-grant',fixture);assert.equal(r.status,403,'remote endpoint must be blocked');
 fs.writeFileSync(data,'{broken');r=await request('/vault-grant',fixture);assert.equal(r.status,400,'malformed state must fail closed');
 }
 r=await request('/grant',{label:'fixture',secret:'test-only',seconds:10});assert.equal(r.status,201);const g=await r.json();
 r=await request('/grant',{label:'second',secret:'test-only',seconds:10});assert.equal(r.status,409);
 r=await fetch(base+'/consume',{method:'POST',headers:{authorization:'Bearer '+g.token}});assert.equal(r.status,200);assert.equal((await r.json()).secret,'test-only');
 r=await fetch(base+'/consume',{method:'POST',headers:{authorization:'Bearer '+g.token}});assert.equal(r.status,403);
 r=await request('/grant',{label:'fixture',secret:'test-only',seconds:10});const g2=await r.json();r=await request('/revoke',{id:g2.id});assert.equal(r.status,200);r=await fetch(base+'/consume',{method:'POST',headers:{authorization:'Bearer '+g2.token}});assert.equal(r.status,403);
 console.log('PASS: origin check, missing CLI or CLI configuration checks, overlapping grants, one-time access, replay and revocation');
 }catch(e){console.error(e.message);process.exitCode=1}finally{child.kill();fs.rmSync(temp,{recursive:true,force:true})}})();
