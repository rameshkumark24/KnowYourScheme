const test = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');
const path = require('path');

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
