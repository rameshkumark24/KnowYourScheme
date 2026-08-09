import test from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import path from 'node:path';

const __dirname = import.meta.dirname;

test('Schema validation: pm-kisan.json', (t) => {
  const schemaPath = path.join(__dirname, '../data/schema/scheme.schema.json');
  const dataPath = path.join(__dirname, '../data/schemes/central/pm-kisan.json');
  
  try {
    const output = execSync(`npx --yes -p ajv-cli -p ajv-formats ajv -s "${schemaPath}" -d "${dataPath}" -c ajv-formats`, { encoding: 'utf8' });
    assert.ok(output.includes('valid'), 'Expected validation output to contain "valid"');
  } catch (error) {
    assert.fail(`Schema validation failed:\n${error.stdout}\n${error.stderr}`);
  }
});

test('Schema validation: synthetic-fixable-scheme.json', (t) => {
  const schemaPath = path.join(__dirname, '../data/schema/scheme.schema.json');
  const dataPath = path.join(__dirname, 'fixtures/synthetic-fixable-scheme.json');
  
  try {
    const output = execSync(`npx --yes -p ajv-cli -p ajv-formats ajv -s "${schemaPath}" -d "${dataPath}" -c ajv-formats`, { encoding: 'utf8' });
    assert.ok(output.includes('valid'), 'Expected validation output to contain "valid"');
  } catch (error) {
    assert.fail(`Schema validation failed:\n${error.stdout}\n${error.stderr}`);
  }
});
