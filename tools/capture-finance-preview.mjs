// Capture the real interface with its built-in fictional example, never owner data.
import {createRequire} from 'node:module';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {startServer} from '../products/finance-workspace/server/index.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../apps/community-platform/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
await mkdir(path.join(root,'artifacts'),{recursive:true});
const runtimeDir=await mkdtemp(path.join(root,'artifacts','finance-preview-'));
const service=await startServer({port:0,runtimeDir,autoCollect:false,autoBankSync:false});
const browser=await chromium.launch();
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(`http://127.0.0.1:${service.server.address().port}/#automation`);
  await page.locator('#load-example').click();
  await page.locator('aside.sidebar nav a[href="#home"]').click();
  await page.locator('#home-outlook').waitFor();
  await page.getByText('Example plan.',{exact:true}).waitFor();
  await mkdir(path.join(root,'assets'),{recursive:true});
  await page.screenshot({path:path.join(root,'assets','your-finances-preview.png'),fullPage:false});
  await page.setViewportSize({width:1280,height:360});
  await page.setContent(await readFile(path.join(root,'assets','hub-header.svg'),'utf8'));
  await page.locator('svg').screenshot({path:path.join(root,'artifacts','hub-header-preview.png')});
  console.log('Captured built-in fictional example at assets/your-finances-preview.png.');
} finally {await browser.close(); await service.close();}
