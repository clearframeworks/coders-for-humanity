import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Store} from '../server/store.mjs';
import {importEmailMessages,readEmailStatus} from '../server/email-alerts.mjs';

// Input is unchanged native Gmail message JSON supplied through the owner's
// connected mailbox. Parsing/classification happens in deterministic local code.
const input=process.argv[2];
if(!input) throw new Error('Choose a private JSON file containing native Gmail messages.');
const file=path.resolve(input);
if((await stat(file)).size>5000000) throw new Error('Email batch exceeds 5 MB.');
const raw=JSON.parse(await readFile(file,'utf8'));
const messages=Array.isArray(raw)?raw:Array.isArray(raw.messages)?raw.messages:[raw];
if(!messages.length||messages.length>200) throw new Error('Choose a batch of 1 to 200 messages.');
const runtimeDir=process.env.FINANCE_RUNTIME_DIR||fileURLToPath(new URL('../runtime/',import.meta.url));
const store=new Store({runtimeDir});
try{const result=importEmailMessages(store,messages);console.log(JSON.stringify({result,status:readEmailStatus(store)}));}
finally{store.close();}
