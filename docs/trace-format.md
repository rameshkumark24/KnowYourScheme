# The trace

> **Build step 5.** What the rule engine returns. The rule engine is not built yet — this is
> the contract it has to meet, agreed before anyone writes it.

The verdict is not the interesting part. **The trace is.** Gap analysis (step 8), the
explanation sentences (step 9) and the question box (step 23) all read the trace and nothing else.

---

## 1. One rule that removes all the confusion

**`PASS` always means good for the user. `FAIL` always means this blocks them.**

Inside a `none` group the engine inverts: if an exclusion condition is *true* of the user,
that is a `FAIL`. Nothing downstream ever has to reason about which kind of group it is in.

So `paid_income_tax_last_year = false` produces `result: "PASS"`, because not having paid
income tax is good for this user.

---

## 2. Shape

```json
{
  "scheme_id": "pm-kisan",
  "verdict": "ELIGIBLE",
  "evaluated_on": "2026-08-09",
  "checks": [ ... ],
  "counts": { "passed": 7, "failed": 0, "unknown": 0 },
  "blocking": [],
  "gap": null
}
```

### A leaf check

```json
{
  "criterion_id": "excluded-high-pension",
  "group": "none",
  "field": "monthly_pension_amount",
  "user_value": 4200,
  "op": "gte",
  "threshold": 10000,
  "result": "PASS",
  "fixable": false,
  "sentence": "Your monthly pension is ₹4,200, below the ₹10,000 cut-off for this exclusion."
}
```

`sentence` is the criterion's `pass_template` or `fail_template` with `{user_value}` and
`{threshold}` substituted. **Both values are copied from this check.** No number in a sentence
has any other source — that is why an explanation cannot be wrong.

The engine only groups digits (`280000` → `2,80,000`). Units and symbols come from the
template, because the field name does not say whether a number is rupees, acres or a
percentage. See [scheme-format.md](scheme-format.md).

### A nested group

A group inside `none` is **one** blocking unit, not one per child. "Government employee,
except Group D" is a single exclusion, and gap analysis must count it once — otherwise a
person blocked by that one thing would never qualify as almost eligible.

```json
{
  "type": "group",
  "group": "none",
  "group_op": "all",
  "result": "PASS",
  "sentence": "You are not a serving or retired government employee.",
  "children": [ ... leaf checks ... ]
}
```

**Convention:** a group's `sentence` is its **first child's** sentence, so write that child's
templates to explain the whole group including its carve-out. PM-KISAN is written that way.

---

## 3. Verdict

Checked in this order. First match wins.

| # | Condition | Verdict |
| --- | --- | --- |
| 0 | `scheme_status` is not `active`, or today is outside the window and `is_rolling` is false | not returned at all |
| 1 | `failed >= 2` | `NOT_ELIGIBLE` |
| 2 | `unknown >= 1` | `NEEDS_MORE_INFO` |
| 3 | `failed == 1` | `ALMOST_ELIGIBLE` |
| 4 | otherwise | `ELIGIBLE` |

Counts are over **blocking units**:

- each entry in top-level `all` is one unit — they are independent requirements
- each entry in top-level `none` is one unit — they are independent exclusions
- **the whole of top-level `any` is one unit** — "SC/ST *or* income below ₹X" is a single
  requirement, satisfied by any one member
- a nested group is one unit, however many children it has

Two things about this order:

- **Rule 1 runs before rule 2.** Once two things block you, no extra answer changes the outcome,
  so there is no point asking.
- **Rule 2 runs before rule 3.** One failure plus one unanswered question is *not* almost
  eligible — answering could make it two failures. Claiming "one step away" and then
  withdrawing it is worse than asking one more question.

`UNKNOWN` is the normal case, not an edge case: tiers 2 and 3 of the profile are optional
by design. `NEEDS_MORE_INFO` is a real results group, not an error — it reads as
*"answer 2 more questions to check this one"*.

---

## 4. The gap block

Present only when the verdict is `ALMOST_ELIGIBLE`.

```json
"gap": {
  "criterion_id": "income-below-limit",
  "label": "Annual income below ₹2,50,000",
  "sentence": "Your income is ₹2,80,000, above the ₹2,50,000 limit for this scheme.",
  "fixable": true,
  "fix_hint": "Income is assessed on the last financial year. If your income has fallen, a fresh income certificate from the e-Sevai centre will reflect it.",
  "distance": { "field": "annual_income", "user_value": 280000, "threshold": 250000 }
}
```

`distance` is filled only for numeric comparisons, so the card can say *how far off* they are.
Both numbers come from the check.

**`fixable` splits the results screen in two, and this is not cosmetic:**

- `fixable: true` → **"One step away"** — an action, with the fix named
- `fixable: false` → **"Just missed"** — honest, no action offered

Offering a fix for something nobody can change is a dead end pretending to be hope, and
UX principle 3 forbids it.

---

## 5. Worked example — eligible

Profile: 45, farmer, owns 3 acres, no pension, no income tax, not a government employee.

```json
{
  "scheme_id": "pm-kisan",
  "verdict": "ELIGIBLE",
  "evaluated_on": "2026-08-09",
  "counts": { "passed": 7, "failed": 0, "unknown": 0 },
  "blocking": [],
  "gap": null,
  "checks": [
    {
      "criterion_id": "owns-agricultural-land",
      "group": "all",
      "field": "owns_agricultural_land",
      "user_value": true,
      "op": "equals",
      "threshold": true,
      "result": "PASS",
      "fixable": false,
      "sentence": "Your family owns agricultural land, which is what this scheme is for."
    },
    {
      "criterion_id": "excluded-institutional-landholder",
      "group": "none",
      "field": "is_institutional_landholder",
      "user_value": false,
      "op": "equals",
      "threshold": true,
      "result": "PASS",
      "fixable": false,
      "sentence": "Your land is held in your own name, not by an institution."
    },
    {
      "type": "group",
      "group": "none",
      "group_op": "all",
      "result": "PASS",
      "sentence": "You are not a serving or retired government employee.",
      "children": [
        {
          "criterion_id": "excluded-government-employee",
          "field": "is_government_employee",
          "user_value": false,
          "op": "equals",
          "threshold": true,
          "result": "PASS",
          "fixable": false,
          "sentence": "You are not a serving or retired government employee."
        },
        {
          "criterion_id": "excluded-government-employee-grade",
          "field": "government_employee_grade",
          "user_value": "not_applicable",
          "op": "not_in",
          "threshold": ["group_d_mts"],
          "result": "FAIL",
          "fixable": false,
          "sentence": "Your grade falls under the government employee exclusion."
        }
      ]
    }
  ]
}
```

Note the group: one child `PASS`, one child `FAIL`, and the group is `PASS`. The exclusion
needed **both** conditions true to bite, and only one was. A child's result is never counted
on its own — only the group's.

*(The remaining four exclusions are omitted here for length; all four are `PASS`.)*

---

## 6. Worked example — almost eligible, and not fixable

Same farmer, but they paid income tax in the last assessment year.

```json
{
  "scheme_id": "pm-kisan",
  "verdict": "ALMOST_ELIGIBLE",
  "counts": { "passed": 6, "failed": 1, "unknown": 0 },
  "blocking": ["excluded-income-tax-payer"],
  "gap": {
    "criterion_id": "excluded-income-tax-payer",
    "label": "Paid income tax last assessment year",
    "sentence": "This scheme excludes anyone who paid income tax in the last assessment year.",
    "fixable": false,
    "fix_hint": null,
    "distance": null
  }
}
```

This lands in **"Just missed"**, not "One step away". Nobody can un-pay income tax.

**Worth knowing before step 3:** every criterion in PM-KISAN is `fixable: false`, so PM-KISAN
can never produce a "one step away" result. It is a poor demo of the feature the whole project
is built around. The other four hand-written schemes should include ones with income
thresholds and certificate requirements, where the gap is genuinely fixable.

---

## 7. Worked example — needs more info

Same farmer, but they have only answered tier 1 and 2. The exclusion screen is untouched.

```json
{
  "scheme_id": "pm-kisan",
  "verdict": "NEEDS_MORE_INFO",
  "counts": { "passed": 1, "failed": 0, "unknown": 6 },
  "blocking": [],
  "gap": null
}
```

The screen says *"Answer 6 quick questions to check this one"* and links to the exclusion
screen. It does **not** say not eligible.

---

## 8. What the engine must never do

- Never treat an unanswered field as a failure
- Never put a number in a sentence that is not in that check
- Never return `ALMOST_ELIGIBLE` while any check is `UNKNOWN`
- Never count a nested group's children as separate blocking units
- Never omit a check from the trace because it passed — the full trace is the evidence,
  and step 13 tests against it
