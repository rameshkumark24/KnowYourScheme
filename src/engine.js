/**
 * Welfare Scheme Eligibility Checker - Rule Engine
 */

/**
 * Renders a value for display. Digit grouping only — no unit is added.
 *
 * The unit belongs in the template text ("₹{user_value}", "{user_value} acres"), because
 * only the person who read the official page knows what the number means. Guessing the unit
 * from the field name is how "8 acres" becomes "₹8".
 */
const formatValue = (val) => {
  if (typeof val === 'number') return val.toLocaleString('en-IN');
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
};

// split/join, not replace: a template may use a placeholder more than once, and a string
// replacement would also interpret $& / $' in the value.
const fill = (text, token, value) => text.split(token).join(formatValue(value));

const formatSentence = (template, userValue, threshold) => {
  if (!template) return null;
  return fill(fill(template, '{user_value}', userValue), '{threshold}', threshold);
};

const GROUP_KEYS = ['all', 'any', 'none'];

/**
 * A rule group must use exactly one of all / any / none.
 *
 * Throwing is deliberate. Picking the first key and ignoring the rest would drop real
 * eligibility rules with no visible symptom — the site would keep working and quietly give
 * the wrong answer. The validation script (step 26) catches this before merge; this is the
 * backstop that should never fire.
 */
const groupOpOf = (node) => {
  const present = GROUP_KEYS.filter((k) => Array.isArray(node[k]));
  if (present.length === 1) return present[0];
  if (present.length === 0) {
    throw new Error(`Rule node has neither a field nor a rule group: ${JSON.stringify(node).slice(0, 120)}`);
  }
  throw new Error(
    `A rule group must use exactly one of all/any/none — found ${present.join(', ')}. Nest them instead.`
  );
};

const evaluateOp = (userVal, op, threshold) => {
  switch (op) {
    case 'equals': return userVal === threshold;
    case 'not_equals': return userVal !== threshold;
    case 'lt': return userVal < threshold;
    case 'lte': return userVal <= threshold;
    case 'gt': return userVal > threshold;
    case 'gte': return userVal >= threshold;
    case 'in': return Array.isArray(threshold) && threshold.includes(userVal);
    case 'not_in': return Array.isArray(threshold) && !threshold.includes(userVal);
    case 'includes': return Array.isArray(userVal) && userVal.includes(threshold);
    default: return false;
  }
};

/**
 * Evaluates a node (leaf or group) and returns its logical state (isMatch)
 * state: "TRUE" | "FALSE" | "UNKNOWN"
 * 
 * TRUE: Condition matched
 * FALSE: Condition not matched
 * UNKNOWN: Missing data
 */
const evaluateCondition = (node, profile) => {
  if (node.field) {
    // Leaf node
    const userVal = profile[node.field];
    if (userVal === undefined || userVal === null) {
      return { state: 'UNKNOWN', userVal };
    }
    const isMatch = evaluateOp(userVal, node.op, node.value);
    return { state: isMatch ? 'TRUE' : 'FALSE', userVal };
  }

  // Group node
  const groupOp = groupOpOf(node);

  const children = node[groupOp].map(child => {
    const evaluated = evaluateCondition(child, profile);
    return { node: child, ...evaluated };
  });

  const states = children.map(c => c.state);
  let state = 'UNKNOWN';

  if (groupOp === 'all') {
    if (states.includes('FALSE')) state = 'FALSE';
    else if (states.includes('UNKNOWN')) state = 'UNKNOWN';
    else state = 'TRUE';
  } else if (groupOp === 'any') {
    if (states.includes('TRUE')) state = 'TRUE';
    else if (states.includes('UNKNOWN')) state = 'UNKNOWN';
    else state = 'FALSE';
  } else if (groupOp === 'none') {
    if (states.includes('TRUE')) state = 'FALSE';
    else if (states.includes('UNKNOWN')) state = 'UNKNOWN';
    else state = 'TRUE';
  }

  return { state, children };
};

const resolveResult = (state, contextGroup) => {
  if (state === 'UNKNOWN') return 'UNKNOWN';
  if (contextGroup === 'none') {
    // For exclusions, if condition is TRUE, the user FAILS
    return state === 'TRUE' ? 'FAIL' : 'PASS';
  } else {
    // For all/any, if condition is TRUE, the user PASSES
    return state === 'TRUE' ? 'PASS' : 'FAIL';
  }
};

const buildTraceNode = (node, evalCtx, contextGroup) => {
  const result = resolveResult(evalCtx.state, contextGroup);

  if (node.field) {
    // Leaf
    let sentence = null;
    if (result === 'PASS') sentence = formatSentence(node.pass_template, evalCtx.userVal, node.value);
    if (result === 'FAIL') sentence = formatSentence(node.fail_template, evalCtx.userVal, node.value);

    return {
      criterion_id: node.id,
      group: contextGroup,
      field: node.field,
      user_value: evalCtx.userVal !== undefined ? evalCtx.userVal : null,
      op: node.op,
      threshold: node.value,
      result,
      fixable: node.fixable,
      fix_hint: node.fix_hint || null,
      sentence,
      _label: node.label // Included internally for gap block generation
    };
  }

  // Group
  const groupOp = groupOpOf(node);
  const traceChildren = evalCtx.children.map(childCtx => buildTraceNode(childCtx.node, childCtx, contextGroup));
  
  // Convention: group's sentence is its first child's sentence.
  const firstChildWithSentence = traceChildren.find(c => c.sentence);
  const sentence = firstChildWithSentence ? firstChildWithSentence.sentence : null;

  return {
    type: 'group',
    group: contextGroup,
    group_op: groupOp,
    result,
    sentence,
    children: traceChildren
  };
};

const getFirstLeaf = (traceNode) => {
  if (traceNode.type === 'group') {
    return getFirstLeaf(traceNode.children[0]);
  }
  return traceNode;
};

// Today in India, not in UTC. Between 00:00 and 05:30 IST the UTC date is still yesterday,
// which would keep a scheme open for one extra night past its deadline.
const todayInIndia = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

const evaluate = (profile, scheme, evaluated_on = todayInIndia()) => {
  const checks = [];
  const counts = { passed: 0, failed: 0, unknown: 0 };
  const blocking = [];

  // 0. Initial active / date check
  if (scheme.scheme_status !== 'active') return null;
  if (!scheme.is_rolling) {
    if (scheme.application_start && evaluated_on < scheme.application_start) return null;
    if (scheme.application_end && evaluated_on > scheme.application_end) return null;
  }

  // Evaluate top-level units.
  //
  // `all` and `none` list independent requirements, so each entry is its own blocking unit.
  // `any` is a SINGLE requirement satisfied by any one member ("SC/ST or income below X"),
  // so the whole bucket is one unit. Counting its members separately would report a user who
  // satisfies the requirement as almost eligible, and one who satisfies none of it as failing
  // several things at once.
  for (const groupKey of GROUP_KEYS) {
    const bucket = scheme.rules[groupKey];
    if (!bucket) continue;

    const units = groupKey === 'any' ? [{ any: bucket }] : bucket;

    for (const rule of units) {
      const evalCtx = evaluateCondition(rule, profile);
      const traceNode = buildTraceNode(rule, evalCtx, groupKey);
      
      checks.push(traceNode);

      if (traceNode.result === 'PASS') counts.passed++;
      if (traceNode.result === 'FAIL') {
        counts.failed++;
        const firstLeaf = getFirstLeaf(traceNode);
        if (firstLeaf && firstLeaf.criterion_id) {
          blocking.push(firstLeaf.criterion_id);
        }
      }
      if (traceNode.result === 'UNKNOWN') counts.unknown++;
    }
  }

  // Verdict evaluation order (first match wins)
  let verdict = 'ELIGIBLE';
  if (counts.failed >= 2) {
    verdict = 'NOT_ELIGIBLE';
  } else if (counts.unknown >= 1) {
    verdict = 'NEEDS_MORE_INFO';
  } else if (counts.failed === 1) {
    verdict = 'ALMOST_ELIGIBLE';
  }

  // Gap analysis
  let gap = null;
  if (verdict === 'ALMOST_ELIGIBLE') {
    const failedNode = checks.find(c => c.result === 'FAIL');
    if (failedNode) {
      const getFirstFailedLeaf = (node) => {
        if (node.type === 'group') {
          for (const child of node.children) {
            if (child.result === 'FAIL') {
              const result = getFirstFailedLeaf(child);
              if (result) return result;
            }
          }
          return getFirstLeaf(node);
        }
        return node;
      };

      const gapLeaf = getFirstFailedLeaf(failedNode);
      
      let distance = null;
      const numOps = ['lt', 'lte', 'gt', 'gte'];
      if (numOps.includes(gapLeaf.op) && typeof gapLeaf.user_value === 'number' && typeof gapLeaf.threshold === 'number') {
        distance = {
          field: gapLeaf.field,
          user_value: gapLeaf.user_value,
          threshold: gapLeaf.threshold
        };
      }

      gap = {
        criterion_id: gapLeaf.criterion_id,
        label: gapLeaf._label || gapLeaf.criterion_id,
        sentence: gapLeaf.sentence || failedNode.sentence,
        fixable: gapLeaf.fixable,
        fix_hint: gapLeaf.fix_hint,
        distance
      };
    }
  }

  // Clean up _label from checks before returning
  const stripInternal = (node) => {
    if (node._label) delete node._label;
    if (node.children) node.children.forEach(stripInternal);
  };
  checks.forEach(stripInternal);

  // The output must match the exact JSON shape in docs/trace-format.md
  //   "scheme_id": "pm-kisan",
  //   "verdict": "ELIGIBLE",
  //   "evaluated_on": "2026-08-09",
  //   "checks": [ ... ],
  //   "counts": { "passed": 7, "failed": 0, "unknown": 0 },
  //   "blocking": [],
  //   "gap": null

  return {
    scheme_id: scheme.id,
    verdict,
    evaluated_on,
    checks,
    counts,
    blocking,
    gap
  };
};

export { evaluate };
