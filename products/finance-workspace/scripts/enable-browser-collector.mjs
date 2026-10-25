import {mkdir, writeFile, realpath} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const runtime = fileURLToPath(new URL('../runtime/',import.meta.url));
const downloadsDir = await realpath(path.join(homedir(),'Downloads'));
await mkdir(runtime,{recursive:true});
await writeFile(path.join(runtime,'browser-collector.json'),JSON.stringify({enabled:process.argv[2]!=='--disable',downloadsDir,enabledAt:new Date().toISOString()}));
console.log(process.argv[2]==='--disable'?'Browser export collection disabled.':'Download collection enabled. Older files are ignored. Install the companion Chrome extension and enable the accounts you want it to collect.');
