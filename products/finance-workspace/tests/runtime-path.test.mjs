import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {resolveRuntimeDir} from '../server/runtime-path.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'finance-paths-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  return root;
}

test('portable source keeps its data in its own folder', async t => {
  const root = await fixture(t);
  assert.equal(resolveRuntimeDir({root, env: {}}), path.join(root, 'runtime'));
});

test('installed app and optional helpers share data outside replaceable files', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'installed.json'), JSON.stringify({product: 'cfh-finance-workspace', installed: true}));
  const local = path.join(root, 'user-data');
  const expected = path.join(local, 'CFH', 'Your finances', 'runtime');
  assert.equal(resolveRuntimeDir({root, env: {LOCALAPPDATA: local}}), expected);
  assert.throws(() => resolveRuntimeDir({root, env: {}}), /application data folder/);
});

test('invalid installed marker fails instead of silently creating another database', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'installed.json'), '{"installed":true,"product":"another-product"}');
  assert.throws(() => resolveRuntimeDir({root, env: {LOCALAPPDATA: root}}), /configuration is invalid/);
  await writeFile(path.join(root, 'installed.json'), 'broken JSON');
  assert.throws(() => resolveRuntimeDir({root, env: {LOCALAPPDATA: root}}), SyntaxError);
});

test('explicit runtime overrides keep isolated tests and integrations isolated', async t => {
  const root = await fixture(t);
  const selected = path.join(root, 'isolated-test-data');
  assert.equal(resolveRuntimeDir({root, env: {FINANCE_RUNTIME_DIR: selected}}), selected);
});
