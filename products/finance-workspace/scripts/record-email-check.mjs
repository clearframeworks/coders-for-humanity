import {readFile,stat} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import {resolveRuntimeDir} from '../server/runtime-path.mjs';
import {recordEmailCheck} from '../server/email-alerts.mjs';

const input=process.argv[2];
if(!input)throw Error('Choose a private JSON status file containing only state, checkedAt, error and counts.');
if((await stat(input)).size>16384)throw Error('Email check status exceeds 16 KB.');
const payload=JSON.parse(await readFile(input,'utf8'));
const database=path.join(resolveRuntimeDir(),'finance.sqlite');
await stat(database); // Never create a new financial database for an incorrect runtime path.
const db=new DatabaseSync(database);
try{
  db.exec('PRAGMA busy_timeout=5000;');
  if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='metadata'").get())throw Error('Choose an existing finance runtime database.');
  console.log(JSON.stringify({collection:recordEmailCheck({db},payload)}));
}finally{db.close();}
