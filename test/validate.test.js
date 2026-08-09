import test from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const __dirname = import.meta.dirname;
const root = path.join(__dirname, '..');
const schemaPath = path.join(root, 'data/schema/scheme.schema.json');

/** Every scheme file in the corpus, plus the test fixtures. */
const schemeFiles = () => {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.json')) out.push(full);
    }
  };
  walk(path.join(root, 'data/schemes'));
  walk(path.join(__dirname, 'fixtures'));
  return out;
};

test('every scheme file validates against the schema', () => {
  const files = schemeFiles();
  assert.ok(files.length >= 5, `expected at least 5 scheme files, found ${files.length}`);

  const args = files.map((f) => `-d "${f}"`).join(' ');
  try {
    const output = execSync(
      `npx --yes -p ajv-cli -p ajv-formats ajv -s "${schemaPath}" ${args} -c ajv-formats`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    assert.ok(output.includes('valid'), `expected "valid" in output, got:\n${output}`);
  } catch (error) {
    assert.fail(`Schema validation failed:\n${error.stdout}\n${error.stderr}`);
  }
});

test('a scheme id matches its filename, and no id is used twice', () => {
  const seen = new Map();
  for (const file of schemeFiles()) {
    if (file.includes('fixtures')) continue;
    const scheme = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(
      scheme.id,
      path.basename(file, '.json'),
      `${path.basename(file)} declares id "${scheme.id}"`
    );
    assert.ok(!seen.has(scheme.id), `id "${scheme.id}" is used by two files`);
    seen.set(scheme.id, file);
  }
});

test('a state scheme sits in a state folder and a central scheme does not', () => {
  for (const file of schemeFiles()) {
    if (file.includes('fixtures')) continue;
    const scheme = JSON.parse(fs.readFileSync(file, 'utf8'));
    const inCentral = file.includes(`${path.sep}central${path.sep}`);
    assert.strictEqual(
      scheme.level === 'central',
      inCentral,
      `${path.basename(file)} is level "${scheme.level}" but ${inCentral ? 'is' : 'is not'} in data/schemes/central`
    );
  }
});
