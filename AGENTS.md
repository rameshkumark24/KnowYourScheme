# Welfare Scheme Eligibility Checker

> Final year project. Team of 3: Rameshkumar (data + testing), Niranjana (rule engine + backend), Risvanth (UI + frontend).

## What we are building

A website where someone enters a few personal details and sees:

1. **Schemes they qualify for** — with a plain sentence explaining why
2. **Schemes they ALMOST qualify for** — with the single missing thing named
3. **What to do next** — documents needed, deadline, effort level, link to apply

Number 2 is the differentiator. No competitor does it (myScheme, Haqdarshak, YojanaSetu all only show what you already qualify for).

Coverage: 20–25 government schemes, Tamil Nadu heavy, plus Central schemes.

---

## HARD RULES — never break these

1. **The rule engine decides eligibility. No AI or ML model is involved in any decision.**
   Eligibility is defined by law, not learned from data. Rules are plain JSON logic evaluated by plain code.

2. **No AI model anywhere in the product.** No LLM, no SLM, no Ollama, no cloud API, no embeddings, no RAG.
   Explanations are built from fill-in-the-blank templates using values from the rule trace.

3. **Nothing about the user is stored on a server.** No login, no accounts, no user database.
   The profile lives in browser local storage only. No analytics that capture profile fields.

4. **Never collect or store an Aadhaar number.** In any form, for any reason.

5. **Never auto-write or auto-modify an eligibility rule.** A script may detect that a page changed
   and open a pull request, but a human always reviews the diff before merge.

6. **Never log in to a government portal on the user's behalf.** Link them there. No credential handling.

7. **No government logos, emblems, or lookalike branding.** A visible line states this is not a government website.

8. **18+ only.** Child schemes are reached through the parent's profile (children listed as attributes),
   never by creating a profile for a minor.

9. **Every scheme record shows `last_verified` and links to its official source page.**

10. **Never invent a number.** Every amount, date, age and threshold shown to a user must come from
    the curated scheme JSON or the rule trace. If it is not in the data, do not display it.

---

## Architecture

```
Profile (browser)  →  Rule engine  →  Verdict + trace  →  Templates  →  Screen
```

- **Rule engine** — pure functions. Takes a profile and a scheme, returns a verdict plus a
  per-criterion trace (which field, user value, threshold, operator, pass/fail).
- **Trace** — the trace is the important output, not just the verdict. Everything downstream reads it.
- **Gap analysis** — a scheme failing exactly ONE criterion, with nothing unanswered, is
  "almost eligible". Name that criterion, and say whether it can be fixed. An unanswered
  field is `UNKNOWN`, never a failure. See [docs/trace-format.md](docs/trace-format.md).
- **Templates** — turn each trace line into a sentence. The number in the sentence is copied
  from the trace, never generated. This is why the explanation can never be wrong.

Runs client-side. Scheme corpus is a static JSON bundle. No application server.

---

## Scheme JSON shape

**The format is specified in [docs/scheme-format.md](docs/scheme-format.md)**, validated by
`data/schema/scheme.schema.json`, and demonstrated in `data/schemes/central/pm-kisan.json`.
That document is the source of truth — the sketch below is orientation only.

```json
{
  "id": "example-scheme",
  "name": "Example Scheme",
  "level": "state",
  "state": "TN",
  "benefit_value": 1000,
  "benefit_period": "month",
  "effort_level": "MEDIUM",
  "is_rolling": false,
  "application_start": "2026-06-01",
  "application_end": "2026-08-31",
  "scheme_status": "active",
  "official_fee": 0,
  "application_url": "https://...",
  "source_url": "https://...",
  "documents": ["income_certificate", "bank_passbook"],
  "common_pitfalls": ["Often returned for an expired income certificate"],
  "rules": {
    "all": [
      {
        "id": "income-below-limit",
        "field": "annual_income",
        "op": "lt",
        "value": 250000,
        "label": "Annual income below ₹2,50,000",
        "fixable": true,
        "fix_hint": "Get a fresh income certificate from the e-Sevai centre.",
        "pass_template": "Your income is {user_value}, below the {threshold} limit.",
        "fail_template": "Your income is {user_value}, above the {threshold} limit.",
        "source_quote": "annual family income should not exceed Rs. 2,50,000"
      }
    ],
    "none": [ ]
  },
  "curation_status": "draft",
  "last_verified": null,
  "verified_by": null,
  "checked_by": null
}
```

Four things that are easy to get wrong:

- `rules` has **`all`, `any` and `none`**, and groups nest. Exclusions go in `none` — many
  central schemes are defined almost entirely by exclusions.
- Every criterion carries **`fixable`**. Gap analysis (step 8) cannot work without it, and
  it cannot be added later without re-reading every official page.
- Every criterion carries **`source_quote`** — the words on the official page the rule came
  from. This is what makes a bot's pull request reviewable in 30 seconds.
- A scheme stays **`curation_status: "draft"`** until a second person has checked it.
  `documents` uses canonical ids from `data/documents.json` so the checklist de-duplicates.

---

## Effort badges — fixed rubric, assigned during curation

- `EASY` — fully online, about 30 minutes, no office visit
- `MEDIUM` — online, but one document must be collected first
- `HARD` — needs one or more in-person office visits

Results are ranked by benefit ÷ effort. A ₹3,000/month EASY scheme ranks above a ₹4,000/month HARD one.
A deadline within 15 days jumps to the top.

**Show every matched scheme.** Top 3 large, the rest below. Never hide a scheme someone qualifies for —
that is the exact problem this project exists to solve.

---

## Code conventions

- Nobody pushes to `main`. Every change goes through a pull request reviewed by one of the other two.
- Scheme JSON is validated by a script before merge: required fields present, dates real,
  rules only reference fields the profile form actually collects.
- Rule engine changes require a test. Assert both the verdict AND the trace contents.
- Keep the profile form to fields a rule actually consumes. If no rule reads it, do not collect it.
- Store `dob`, compute age live. Never store `age`.

---

## UI principles

- Plain language, the way a helpful neighbour speaks. Not government-portal legalese.
- Modern and clean. Deliberately unlike an existing government site.
- Works on a mid-range Android over slow 4G.
- Accessibility floor: WCAG AA contrast, 44px touch targets, keyboard navigation, ARIA labels,
  layout survives 200% text scaling.
- "Not eligible" is never a dead end. Every negative result carries a reason, and a fix if one exists.

---

## Things we deliberately did NOT build

Say these out loud in reviews — deliberate exclusions with reasons score better than
features attempted badly.

| Excluded | Why |
| --- | --- |
| Scraper that writes rules | A misread "₹2.5 lakh" as "₹2.5" silently tells the wrong people the wrong thing |
| Any AI/ML model | Eligibility is legal fact, not a prediction. A model can be wrong and cannot explain itself |
| OCR / document upload | Highest-sensitivity data, and OCR accuracy drops badly on real scanned documents |
| Pre-filled application forms | A wrong pre-fill submitted unread is a false declaration by our user |
| Benefit stacking optimiser | Scheme exclusivity rules are not documented anywhere reliable |
| Rejection diagnosis for an individual | Being wrong costs a real person an application cycle |
| Aadhaar numbers | No rule needs the number itself. Pure downside |
| Our own how-to videos | Weeks of filming that breaks on the next portal redesign. Embed official videos |

---

## When working on this project

- Read the current build step before starting. Steps are numbered and ordered.
- Do not add a feature that is not in the build steps without asking.
- Do not introduce an AI model, an auth system, or a server-side database.
- If a change would make any HARD RULE above untrue, stop and flag it instead.
