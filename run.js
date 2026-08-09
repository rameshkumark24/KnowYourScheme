const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { evaluate } = require('./src/engine');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (question) => new Promise(resolve => rl.question(question, resolve));

async function run() {
  console.log("=== PM-KISAN Interactive Tester ===");
  console.log("Answer 'y' for Yes, 'n' for No. Leave blank for UNKNOWN.\n");

  const parseBool = (answer) => {
    if (answer.toLowerCase().startsWith('y')) return true;
    if (answer.toLowerCase().startsWith('n')) return false;
    return undefined; // Maps to UNKNOWN in the engine
  };

  const profile = {};

  let ans = await ask("1. Does your family own agricultural land? (y/n): ");
  profile.owns_agricultural_land = parseBool(ans);

  ans = await ask("2. Is the land held by an institution? (y/n): ");
  profile.is_institutional_landholder = parseBool(ans);

  ans = await ask("3. Do you hold or have you held a constitutional post? (y/n): ");
  profile.holds_constitutional_post = parseBool(ans);

  ans = await ask("4. Are you a serving or retired government/PSU employee? (y/n): ");
  profile.is_government_employee = parseBool(ans);

  ans = await ask("5. What is your employee grade? (e.g., type 'group_d_mts' or 'not_applicable'): ");
  profile.government_employee_grade = ans.trim() || undefined;

  ans = await ask("6. What is your monthly pension amount? (enter number or leave blank): ");
  profile.monthly_pension_amount = ans.trim() ? parseInt(ans, 10) : undefined;

  ans = await ask("7. Did you pay income tax in the last assessment year? (y/n): ");
  profile.paid_income_tax_last_year = parseBool(ans);

  ans = await ask("8. Are you a registered practising professional (doctor, lawyer, etc)? (y/n): ");
  profile.is_registered_professional = parseBool(ans);

  rl.close();

  console.log("\nEvaluating profile against PM-KISAN...");
  const pmKisan = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/schemes/central/pm-kisan.json'), 'utf8'));
  const trace = evaluate(profile, pmKisan);

  console.log("\n=== VERDICT ===");
  console.log(trace.verdict);

  console.log("\n=== GAP ANALYSIS ===");
  console.log(JSON.stringify(trace.gap, null, 2));

  console.log("\n=== FULL TRACE OUTPUT ===");
  console.log(JSON.stringify(trace.checks, null, 2));
}

run();
