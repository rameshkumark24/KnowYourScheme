/**
 * Regression tests. Each one failed before the fix in the same commit.
 *
 * These use synthetic schemes on purpose — they exercise format features PM-KISAN happens
 * not to use, which is exactly where the bugs were hiding.
 */
import test from 'node:test';
import assert from 'node:assert';
import { evaluate, deriveProfile } from '../src/engine.js';

const scheme = (rules) => ({
  id: 'regression-fixture',
  name: 'Regression fixture',
  full_name: 'Regression fixture',
  level: 'state',
  state: 'TN',
  summary: 'TEST FIXTURE. Not real scheme data.',
  benefit_value: 1000,
  benefit_period: 'month',
  effort_level: 'EASY',
  official_fee: 0,
  is_rolling: true,
  application_start: null,
  application_end: null,
  scheme_status: 'active',
  application_url: 'https://example.gov.in/apply',
  source_url: 'https://example.gov.in/',
  documents: [],
  how_to_apply: [],
  common_pitfalls: [],
  rules,
  curation_status: 'draft',
  last_verified: null,
  verified_by: null,
  checked_by: null
});

const crit = (o) => ({
  id: o.id,
  field: o.field,
  op: o.op,
  value: o.value,
  label: o.label || o.id,
  fixable: false,
  fix_hint: null,
  pass_template: o.pass || 'ok',
  fail_template: o.fail || 'no',
  source_quote: 'test fixture'
});

const ANY_SCHEME = scheme({
  any: [
    crit({ id: 'is-sc-st', field: 'category', op: 'in', value: ['sc', 'st'] }),
    crit({ id: 'holds-aay-card', field: 'ration_card_type', op: 'equals', value: 'aay' })
  ]
});

test('top-level `any` is ONE blocking unit, satisfied by one member', () => {
  // Not SC/ST, but does hold an AAY card. The requirement is met.
  const trace = evaluate({ category: 'general', ration_card_type: 'aay' }, ANY_SCHEME, '2026-08-09');

  assert.strictEqual(trace.verdict, 'ELIGIBLE');
  assert.deepStrictEqual(trace.counts, { passed: 1, failed: 0, unknown: 0 });
  assert.strictEqual(trace.checks.length, 1, 'the whole any-bucket is a single check');
  assert.strictEqual(trace.checks[0].type, 'group');
  assert.strictEqual(trace.checks[0].group_op, 'any');
  assert.strictEqual(trace.checks[0].children.length, 2);
});

test('top-level `any` satisfied by no member counts as one failure, not several', () => {
  const trace = evaluate({ category: 'general', ration_card_type: 'nphh' }, ANY_SCHEME, '2026-08-09');

  assert.strictEqual(trace.counts.failed, 1);
  assert.strictEqual(trace.verdict, 'ALMOST_ELIGIBLE');
  assert.deepStrictEqual(trace.blocking, ['is-sc-st']);
});

test('a number is not assumed to be rupees', () => {
  const acres = scheme({
    all: [
      crit({
        id: 'land-under-5',
        field: 'land_holding_acres',
        op: 'lte',
        value: 5,
        fail: 'You farm {user_value} acres, above the {threshold} acre limit.'
      })
    ]
  });
  const trace = evaluate({ land_holding_acres: 8 }, acres, '2026-08-09');

  assert.strictEqual(trace.checks[0].sentence, 'You farm 8 acres, above the 5 acre limit.');
  assert.ok(!trace.checks[0].sentence.includes('₹'));
});

test('large numbers still group the Indian way', () => {
  const income = scheme({
    all: [
      crit({
        id: 'income-limit',
        field: 'annual_income',
        op: 'lt',
        value: 250000,
        fail: 'Your income is ₹{user_value}, above the ₹{threshold} limit.'
      })
    ]
  });
  const trace = evaluate({ annual_income: 280000 }, income, '2026-08-09');

  assert.strictEqual(trace.checks[0].sentence, 'Your income is ₹2,80,000, above the ₹2,50,000 limit.');
});

test('a placeholder used twice is filled every time', () => {
  const twice = scheme({
    all: [
      crit({
        id: 'twice',
        field: 'annual_income',
        op: 'lt',
        value: 250000,
        fail: 'Your income is ₹{user_value}. Get it below ₹{threshold} — ₹{user_value} is too high.'
      })
    ]
  });
  const trace = evaluate({ annual_income: 280000 }, twice, '2026-08-09');

  assert.ok(!trace.checks[0].sentence.includes('{'), 'no placeholder may reach the screen');
  assert.strictEqual(
    trace.checks[0].sentence,
    'Your income is ₹2,80,000. Get it below ₹2,50,000 — ₹2,80,000 is too high.'
  );
});

test('a rule group using more than one of all/any/none throws instead of dropping rules', () => {
  const ambiguous = scheme({
    none: [
      {
        all: [crit({ id: 'a', field: 'is_government_employee', op: 'equals', value: true })],
        none: [crit({ id: 'b', field: 'paid_income_tax_last_year', op: 'equals', value: true })]
      }
    ]
  });

  assert.throws(
    () => evaluate({ is_government_employee: false, paid_income_tax_last_year: true }, ambiguous, '2026-08-09'),
    /exactly one of all\/any\/none/
  );
});

test('the default evaluation date is today in India, not in UTC', () => {
  const istToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const trace = evaluate({ annual_income: 1 }, scheme({ all: [crit({ id: 'x', field: 'annual_income', op: 'lt', value: 2 })] }));

  assert.strictEqual(trace.evaluated_on, istToday);
});

test('a scheme past its deadline is not returned at all', () => {
  const expired = scheme({ all: [crit({ id: 'x', field: 'annual_income', op: 'lt', value: 2 })] });
  expired.is_rolling = false;
  expired.application_start = '2026-06-01';
  expired.application_end = '2026-08-31';

  assert.strictEqual(evaluate({ annual_income: 1 }, expired, '2026-09-01'), null);
  assert.strictEqual(evaluate({ annual_income: 1 }, expired, '2026-05-31'), null);
  assert.ok(evaluate({ annual_income: 1 }, expired, '2026-08-31'), 'the last day is still open');
});

test('a closed scheme is not returned at all', () => {
  const closed = scheme({ all: [crit({ id: 'x', field: 'annual_income', op: 'lt', value: 2 })] });
  closed.scheme_status = 'closed';

  assert.strictEqual(evaluate({ annual_income: 1 }, closed, '2026-08-09'), null);
});

test('deriveProfile computes age from dob, including the not-yet-had-a-birthday case', () => {
  assert.strictEqual(deriveProfile({ dob: '1984-03-12' }, '2026-08-09').age, 42);
  assert.strictEqual(deriveProfile({ dob: '1984-12-12' }, '2026-08-09').age, 41);
  assert.strictEqual(deriveProfile({ dob: '1984-08-09' }, '2026-08-09').age, 42, 'birthday today');
  assert.strictEqual(deriveProfile({ dob: '1984-08-10' }, '2026-08-09').age, 41, 'birthday tomorrow');
});

test('deriveProfile counts children and answers has_only_girl_children', () => {
  const twoGirls = deriveProfile({
    children: [{ child_gender: 'female' }, { child_gender: 'female' }]
  });
  assert.strictEqual(twoGirls.child_count, 2);
  assert.strictEqual(twoGirls.girl_child_count, 2);
  assert.strictEqual(twoGirls.has_only_girl_children, true);

  const mixed = deriveProfile({ children: [{ child_gender: 'female' }, { child_gender: 'male' }] });
  assert.strictEqual(mixed.girl_child_count, 1);
  assert.strictEqual(mixed.has_only_girl_children, false);

  const none = deriveProfile({ children: [] });
  assert.strictEqual(none.has_only_girl_children, false, 'no children is not "only girls"');
});

test('deriveProfile leaves a profile without dob or children alone', () => {
  const out = deriveProfile({ gender: 'female' });
  assert.strictEqual(out.age, undefined);
  assert.strictEqual(out.child_count, undefined);
  assert.strictEqual(out.gender, 'female');
});

test('a rule reading a child_* field throws instead of silently returning UNKNOWN', () => {
  const childRule = scheme({
    all: [crit({ id: 'child-in-college', field: 'child_education_stage', op: 'equals', value: 'college' })]
  });

  assert.throws(
    () => evaluate({ children: [{ child_education_stage: 'college' }] }, childRule, '2026-08-09'),
    /Per-child rule evaluation is not implemented/
  );
});

test('a false or zero answer is answered, not unknown', () => {
  const s = scheme({
    none: [crit({ id: 'excluded-tax', field: 'paid_income_tax_last_year', op: 'equals', value: true })],
    all: [crit({ id: 'pension-nil', field: 'monthly_pension_amount', op: 'lt', value: 10000 })]
  });
  const trace = evaluate({ paid_income_tax_last_year: false, monthly_pension_amount: 0 }, s, '2026-08-09');

  assert.strictEqual(trace.counts.unknown, 0, 'false and 0 are real answers');
  assert.strictEqual(trace.verdict, 'ELIGIBLE');
});
