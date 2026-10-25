import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const execute = promisify(execFile);
const helper = fileURLToPath(new URL('../Finance-Paths.ps1', import.meta.url));
const windowsOnly = {skip: process.platform !== 'win32'};

async function directory(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'finance-launch-port-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  return root;
}
async function select(runtime, port = 4318, automatic = false) {
  const command = "$ErrorActionPreference='Stop'; . $env:FINANCE_TEST_HELPER; $options=@{Runtime=$env:FINANCE_TEST_RUNTIME;InstallationId='finance-launch-test';Port=[int]$env:FINANCE_TEST_PORT;Automatic=($env:FINANCE_TEST_AUTO -eq '1')}; Resolve-FinanceLaunchPort @options | ConvertTo-Json -Compress";
  const {stdout} = await execute('powershell.exe', ['-NoLogo', '-NoProfile', '-Command', command], {
    windowsHide: true,
    env: {...process.env, FINANCE_TEST_HELPER: helper, FINANCE_TEST_RUNTIME: runtime, FINANCE_TEST_PORT: String(port), FINANCE_TEST_AUTO: automatic ? '1' : '0'},
  });
  return JSON.parse(stdout);
}
async function service(t, installationId, port = 0) {
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({storage: 'sqlite', installationId}));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return server;
}

test('explicit port reuses only the matching installation and rejects another live service', windowsOnly, async t => {
  const runtime = await directory(t);
  const matching = await service(t, 'finance-launch-test');
  const matched = await select(runtime, matching.address().port);
  assert.deepEqual(matched, {Ready: true, Port: matching.address().port});
  const other = await service(t, 'another-installation');
  await assert.rejects(select(runtime, other.address().port), /belongs to another service/);
  assert.equal(other.listening, true);
});

test('automatic selection ignores invalid saved ports and selects an available loopback port', windowsOnly, async t => {
  const runtime = await directory(t);
  await writeFile(path.join(runtime, 'service.port'), '70000');
  const selected = await select(runtime, 4318, true);
  assert.equal(selected.Ready, false);
  assert.ok(selected.Port >= 4318 && selected.Port <= 4338);
  const listener = await service(t, 'unrelated-service', selected.Port);
  const next = await select(runtime, 4318, true);
  assert.notEqual(next.Port, selected.Port);
  assert.equal(listener.listening, true);
});

test('automatic selection reuses the matching service at its persisted port', windowsOnly, async t => {
  const runtime = await directory(t);
  const selected = await select(runtime, 4318, true);
  await service(t, 'finance-launch-test', selected.Port);
  await writeFile(path.join(runtime, 'service.port'), String(selected.Port));
  assert.deepEqual(await select(runtime, 4318, true), {Ready: true, Port: selected.Port});
});
