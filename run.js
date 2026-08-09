/**
 * Manual tester for the rule engine. Development tool, not part of the product.
 *
 *   node run.js                        prompt for answers
 *   echo '{"owns_agricultural_land":true}' | node run.js
 *   node run.js --profile my.json
 *
 * A profile may leave any field out — the engine treats a missing field as UNKNOWN.
 */
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { evaluate, deriveProfile } from './src/engine.js';

const SCHEMES_DIR = path.join(import.meta.dirname, 'data/schemes');

const loadSchemes = () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.json')) files.push(full);
    }
  };
  walk(SCHEMES_DIR);
  return files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
};

const QUESTIONS = [
  ['owns_agricultural_land', 'bool', 'Does your family own agricultural land?'],
  ['is_institutional_landholder', 'bool', 'Is the land held by an institution rather than a person?'],
  ['holds_constitutional_post', 'bool', 'Do you hold, or have you held, a constitutional post?'],
  ['is_government_employee', 'bool', 'Are you a serving or retired government or PSU employee?'],
  ['government_employee_grade', 'text', "Employee grade? (group_a / group_b / group_c / group_d_mts / not_applicable)"],
  ['monthly_pension_amount', 'number', 'Monthly pension amount in rupees?'],
  ['paid_income_tax_last_year', 'bool', 'Did you pay income tax in the last assessment year?'],
  ['is_registered_professional', 'bool', 'Are you a registered practising professional (doctor, lawyer, CA)?']
];

const parseBool = (a) => {
  const s = a.trim().toLowerCase();
  if (s.startsWith('y')) return true;
  if (s.startsWith('n')) return false;
  return undefined; // blank -> UNKNOWN
};

const parseNumber = (a) => {
  const s = a.trim();
  if (!s) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n)) {
    console.error(`  "${s}" is not a number — recording it as unanswered.`);
    return undefined;
  }
  return n;
};

function reportScheme(scheme, trace) {
  console.log(`\n=== ${scheme.name} — ${trace.verdict} ===`);
  console.log(
    `${trace.counts.passed} passed, ${trace.counts.failed} failed, ${trace.counts.unknown} unanswered`
  );

  const mark = { PASS: '[ok]  ', FAIL: '[no]  ', UNKNOWN: '[?]   ' };
  for (const check of trace.checks) {
    const name = check.type === 'group' ? `${check.group_op} group` : check.criterion_id;
    console.log(`${mark[check.result]}${name}`);
    if (check.sentence) console.log(`        ${check.sentence}`);
  }

  if (trace.gap) {
    console.log(`--- ${trace.gap.fixable ? 'ONE STEP AWAY' : 'JUST MISSED'} ---`);
    console.log(`    ${trace.gap.sentence}`);
    if (trace.gap.fix_hint) console.log(`    How to fix: ${trace.gap.fix_hint}`);
  }
}

function report(storedProfile) {
  // The stored profile holds dob and children[]; rules read age and the child aggregates.
  const profile = deriveProfile(storedProfile);
  const schemes = loadSchemes();
  const results = [];

  for (const scheme of schemes) {
    const trace = evaluate(profile, scheme);
    if (trace === null) continue; // closed, or outside its application window
    results.push({ scheme, trace });
  }

  const order = ['ELIGIBLE', 'ALMOST_ELIGIBLE', 'NEEDS_MORE_INFO', 'NOT_ELIGIBLE'];
  results.sort((a, b) => order.indexOf(a.trace.verdict) - order.indexOf(b.trace.verdict));

  console.log(`\nChecked ${results.length} of ${schemes.length} schemes (the rest are not open today).`);
  for (const verdict of order) {
    const group = results.filter((r) => r.trace.verdict === verdict);
    if (group.length) console.log(`  ${verdict}: ${group.map((r) => r.scheme.name).join(', ')}`);
  }

  for (const { scheme, trace } of results) reportScheme(scheme, trace);

  if (process.env.TRACE_JSON) {
    console.log('\n' + JSON.stringify(results.map((r) => r.trace), null, 2));
  }
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (raw += c));
    process.stdin.on('end', () => resolve(raw));
    process.stdin.on('error', reject);
  });
}

async function interactive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // Without this, EOF leaves rl.question pending forever, the process exits 0, and the
  // caller sees no output and no error. Fail loudly instead.
  let closedEarly = false;
  rl.on('close', () => (closedEarly = true));

  const ask = (q) =>
    new Promise((resolve, reject) => {
      if (closedEarly) return reject(new Error('input ended before all questions were answered'));
      rl.question(q, resolve);
      rl.once('close', () => reject(new Error('input ended before all questions were answered')));
    });

  console.log('=== PM-KISAN tester ===');
  console.log("y = yes, n = no, blank = leave unanswered\n");

  const profile = {};
  for (let i = 0; i < QUESTIONS.length; i++) {
    const [field, kind, text] = QUESTIONS[i];
    const suffix = kind === 'bool' ? ' (y/n)' : '';
    const answer = await ask(`${i + 1}. ${text}${suffix}: `);
    if (kind === 'bool') profile[field] = parseBool(answer);
    else if (kind === 'number') profile[field] = parseNumber(answer);
    else profile[field] = answer.trim() || undefined;
  }

  rl.close();
  report(profile);
}

async function main() {
  const fileArg = process.argv.indexOf('--profile');
  if (fileArg !== -1) {
    const file = process.argv[fileArg + 1];
    if (!file) throw new Error('--profile needs a path to a JSON file');
    return report(JSON.parse(fs.readFileSync(file, 'utf8')));
  }

  if (!process.stdin.isTTY) {
    const raw = (await readStdin()).trim();
    if (!raw) throw new Error('nothing on stdin. Pass a JSON profile, or run in a terminal to be prompted.');
    return report(JSON.parse(raw));
  }

  return interactive();
}

main().catch((err) => {
  console.error(`\nrun.js: ${err.message}`);
  process.exit(1);
});
