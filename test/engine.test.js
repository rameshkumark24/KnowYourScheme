import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { evaluate } from '../src/engine.js';

const __dirname = import.meta.dirname;

const pmKisan = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/schemes/central/pm-kisan.json'), 'utf8'));
const synthetic = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/synthetic-fixable-scheme.json'), 'utf8'));

test('Scenario 1: ELIGIBLE - 45yo farmer, owns land, no pension, no tax paid, not govt employee', (t) => {
  const profile = {
    age: 45,
    owns_agricultural_land: true,
    is_institutional_landholder: false,
    holds_constitutional_post: false,
    is_government_employee: false,
    government_employee_grade: 'not_applicable',
    monthly_pension_amount: 0,
    paid_income_tax_last_year: false,
    is_registered_professional: false
  };

  const trace = evaluate(profile, pmKisan, '2026-08-09');
  
  assert.strictEqual(trace.verdict, 'ELIGIBLE');
  assert.strictEqual(trace.counts.passed, 7);
  assert.strictEqual(trace.counts.failed, 0);
  assert.strictEqual(trace.counts.unknown, 0);
  assert.strictEqual(trace.blocking.length, 0);
  assert.strictEqual(trace.gap, null);

  // Assert nested group evaluates to PASS despite one child failing
  const govtEmpGroup = trace.checks.find(c => c.type === 'group' && c.children && c.children[0].field === 'is_government_employee');
  assert.ok(govtEmpGroup);
  assert.strictEqual(govtEmpGroup.result, 'PASS');
  
  // The first child (is_government_employee=false) is PASS
  assert.strictEqual(govtEmpGroup.children[0].result, 'PASS');
  
  // The second child (not_in 'group_d_mts') evaluated against 'not_applicable' is FAIL
  assert.strictEqual(govtEmpGroup.children[1].result, 'FAIL');
});

test('Scenario 2: ALMOST_ELIGIBLE - Same farmer, but paid income tax', (t) => {
  const profile = {
    age: 45,
    owns_agricultural_land: true,
    is_institutional_landholder: false,
    holds_constitutional_post: false,
    is_government_employee: false,
    government_employee_grade: 'not_applicable',
    monthly_pension_amount: 0,
    paid_income_tax_last_year: true,
    is_registered_professional: false
  };

  const trace = evaluate(profile, pmKisan, '2026-08-09');

  assert.strictEqual(trace.verdict, 'ALMOST_ELIGIBLE');
  assert.strictEqual(trace.counts.passed, 6);
  assert.strictEqual(trace.counts.failed, 1);
  assert.strictEqual(trace.counts.unknown, 0);
  
  assert.strictEqual(trace.blocking.length, 1);
  assert.strictEqual(trace.blocking[0], 'excluded-income-tax-payer');
  
  assert.ok(trace.gap);
  assert.strictEqual(trace.gap.criterion_id, 'excluded-income-tax-payer');
  assert.strictEqual(trace.gap.fixable, false);
  assert.strictEqual(trace.gap.fix_hint, null);
  assert.strictEqual(trace.gap.distance, null);
});

test('Scenario 3: NOT_ELIGIBLE - Failing 2+ criteria', (t) => {
  const profile = {
    age: 45,
    owns_agricultural_land: true,
    is_institutional_landholder: true, // Fail 1
    holds_constitutional_post: false,
    is_government_employee: false,
    government_employee_grade: 'not_applicable',
    monthly_pension_amount: 0,
    paid_income_tax_last_year: true, // Fail 2
    is_registered_professional: false
  };

  const trace = evaluate(profile, pmKisan, '2026-08-09');

  assert.strictEqual(trace.verdict, 'NOT_ELIGIBLE');
  assert.strictEqual(trace.counts.failed, 2);
});

test('Scenario 4: NEEDS_MORE_INFO - Missing optional answers', (t) => {
  const profile = {
    owns_agricultural_land: true // Only answered this one
  };

  const trace = evaluate(profile, pmKisan, '2026-08-09');

  assert.strictEqual(trace.verdict, 'NEEDS_MORE_INFO');
  assert.strictEqual(trace.counts.passed, 1);
  assert.strictEqual(trace.counts.failed, 0);
  assert.strictEqual(trace.counts.unknown, 6); // 6 top-level exclusion units are missing data
});

test('Scenario 5: Conflict resolution - 1 unknown AND 1 failed (NEEDS_MORE_INFO wins)', (t) => {
  const profile = {
    age: 45,
    owns_agricultural_land: true,
    is_institutional_landholder: false,
    holds_constitutional_post: false,
    is_government_employee: false,
    government_employee_grade: 'not_applicable',
    monthly_pension_amount: undefined, // UNKNOWN
    paid_income_tax_last_year: true, // FAIL
    is_registered_professional: false
  };

  const trace = evaluate(profile, pmKisan, '2026-08-09');

  assert.strictEqual(trace.counts.failed, 1);
  assert.strictEqual(trace.counts.unknown, 1);
  assert.strictEqual(trace.verdict, 'NEEDS_MORE_INFO');
});

test('Scenario 6: Synthetic fixable scheme with distance', (t) => {
  const profile = {
    annual_income: 280000
  };

  const trace = evaluate(profile, synthetic, '2026-08-09');

  assert.strictEqual(trace.verdict, 'ALMOST_ELIGIBLE');
  assert.strictEqual(trace.counts.failed, 1);
  assert.ok(trace.gap);
  assert.strictEqual(trace.gap.fixable, true);
  assert.strictEqual(trace.gap.fix_hint, 'Get a fresh income certificate.');
  assert.strictEqual(trace.gap.sentence, 'Your income is ₹2,80,000, above the ₹2,50,000 limit.');
  assert.deepStrictEqual(trace.gap.distance, {
    field: 'annual_income',
    user_value: 280000,
    threshold: 250000
  });
});
