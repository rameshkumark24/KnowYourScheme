/**
 * Welfare Scheme Eligibility Checker - Rule Engine
 */

const formatValue = (field, val) => {
  if (typeof val === 'number') {
    if (field === 'age' || field.includes('age_')) return val.toString();
    return '₹' + val.toLocaleString('en-IN');
  }
  if (typeof val === 'boolean') {
    return val ? 'Yes' : 'No';
  }
  if (Array.isArray(val)) {
    return val.join(', ');
  }
  return String(val);
};

const formatSentence = (template, field, userValue, threshold) => {
  if (!template) return null;
  return template
    .replace('{user_value}', formatValue(field, userValue))
    .replace('{threshold}', formatValue(field, threshold));
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
  const groupOp = node.all ? 'all' : node.any ? 'any' : node.none ? 'none' : null;
  if (!groupOp) throw new Error("Invalid group node");

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
    if (result === 'PASS') sentence = formatSentence(node.pass_template, node.field, evalCtx.userVal, node.value);
    if (result === 'FAIL') sentence = formatSentence(node.fail_template, node.field, evalCtx.userVal, node.value);
    
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
  const groupOp = node.all ? 'all' : node.any ? 'any' : node.none ? 'none' : null;
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

const evaluate = (profile, scheme, evaluated_on = new Date().toISOString().split('T')[0]) => {
  const checks = [];
  const counts = { passed: 0, failed: 0, unknown: 0 };
  const blocking = [];

  // 0. Initial active / date check
  if (scheme.scheme_status !== 'active') return null;
  if (!scheme.is_rolling) {
    if (scheme.application_start && evaluated_on < scheme.application_start) return null;
    if (scheme.application_end && evaluated_on > scheme.application_end) return null;
  }

  // Evaluate top-level units
  for (const groupKey of ['all', 'any', 'none']) {
    if (!scheme.rules[groupKey]) continue;

    for (const rule of scheme.rules[groupKey]) {
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

module.exports = {
  evaluate
};
