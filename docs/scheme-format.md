# The scheme JSON format

> **Build step 2.** Everything downstream reads this format. Changing it later means
> re-curating every scheme, so it is worth arguing about now.

One scheme per file, at `data/schemes/<level>/<id>.json`.

---

## 1. Why this differs from the sketch in AGENTS.md

The sketch in AGENTS.md was a starting point. Writing one real scheme against it surfaced
five things it could not express. Each change below exists because a real scheme needed it.

| # | Problem | Change |
| --- | --- | --- |
| 1 | PM-KISAN has almost no inclusion rules — it is defined by six **exclusions**. `all` cannot say "none of these". | `rules` gains **`none`** and **`any`** alongside `all` |
| 2 | "Government employee, **except** Group D" is one exclusion with a carve-out. | Rule groups **nest** — a group can contain another group |
| 3 | Step 8 must name the missing thing **and say whether it can be fixed**. Nothing in the file said which criteria are fixable. | Every criterion carries **`fixable`** and an optional **`fix_hint`** |
| 4 | Step 9 builds sentences from checks. Deriving English from a field name is guesswork. | Every criterion carries **`pass_template`** and **`fail_template`** |
| 5 | A scheme drafted but not yet cross-checked looked identical to a verified one. | **`curation_status`**, plus `verified_by` and `checked_by` |

Two smaller additions: `source_quote` on each criterion (the words on the official page that
the rule came from — this is what makes a pull-request diff reviewable in 30 seconds), and
`benefit_note` (so "three instalments of ₹2,000" can be shown without any code inventing it).

---

## 2. Top-level fields

### Identity

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | kebab-case, unique, matches the filename. Never reused. |
| `name` | string | Short name users recognise: `"PM-KISAN"` |
| `full_name` | string | Official full name |
| `level` | `"central"` \| `"state"` | |
| `state` | string \| null | `"TN"` for state schemes, `null` for central |
| `summary` | string | One plain sentence. Shown on the card. |

### Benefit and effort

| Field | Type | Notes |
| --- | --- | --- |
| `benefit_value` | number \| null | Rupees. `null` only for non-cash benefits. |
| `benefit_period` | `"year"` \| `"month"` \| `"one_time"` | Used by ranking to normalise |
| `benefit_type` | `"grant"` \| `"loan"` \| `"subsidy"` \| `"insurance"` \| `"in_kind"` | See below |
| `benefit_note` | string \| null | Free text for detail that is not a single number |

**`benefit_type` exists because ranking would otherwise lie.** PM SVANidhi's first tranche is
₹15,000 and PM-KISAN is ₹6,000 a year. Sorted on the number alone, a loan the user has to pay
back in twelve months outranks a grant they keep — and it would sit at the top of the results
screen looking like the best thing available.

Ranking rules by type:

- `grant`, `subsidy` — rank on `benefit_value` as-is
- `loan` — never ranked above a grant on value. It is money borrowed, not money received.
- `insurance`, `in_kind` — a cover amount is not cash in hand; rank below grants of the same figure
| `effort_level` | `"EASY"` \| `"MEDIUM"` \| `"HARD"` | Fixed rubric, see below |
| `official_fee` | number | `0` for free. Shown so users can spot someone overcharging. |

**Effort rubric — assigned during curation, never by feel:**

- `EASY` — fully online, about 30 minutes, no office visit
- `MEDIUM` — online, but one document must be collected first
- `HARD` — needs one or more in-person office visits

Ranking is `benefit_value` normalised to a monthly figure, divided by effort. A deadline
within 15 days jumps to the top. **Every matched scheme is shown** — top 3 large, the rest below.

### Availability

| Field | Type | Notes |
| --- | --- | --- |
| `is_rolling` | boolean | `true` = always open, skip the window check |
| `application_start` | date \| null | `YYYY-MM-DD`. `null` when rolling. |
| `application_end` | date \| null | `YYYY-MM-DD`. `null` when rolling. |
| `scheme_status` | `"active"` \| `"closed"` \| `"superseded"` | |

Dates handle **expiry** — a scheme stops showing when its window closes, with no script involved.
The auto-update bot (step 24) is a separate mechanism that handles **changes** to a live page.
We have both.

### Applying

| Field | Type | Notes |
| --- | --- | --- |
| `application_url` | url | Where the user actually applies |
| `source_url` | url | The official page every rule was copied from |
| `documents` | string[] | Canonical names from `data/documents.json` |
| `how_to_apply` | string[] | Plain general steps. Not screen-by-screen — a portal redesign must not break them. |
| `official_video_url` | url \| null | Official channel only. We never film our own. |
| `common_pitfalls` | string[] | General to the scheme. **Never a diagnosis of one person's rejection.** |

### Curation

| Field | Type | Notes |
| --- | --- | --- |
| `curation_status` | `"draft"` \| `"verified"` | The validation script rejects `draft` on `main` |
| `last_verified` | date | The day a **human** last read the official page |
| `verified_by` | string | Initials of whoever wrote it |
| `checked_by` | string \| null | Initials of the second person. Required for `verified`. |
| `curation_notes` | string[] | Anything the next person needs to know |

`last_verified` and `source_url` are shown to the user on every card. A visibly dated record
is more trustworthy than a silently stale one.

---

## 3. Rules

```json
"rules": {
  "all":  [ ... ],   // every one must pass
  "any":  [ ... ],   // at least one must pass
  "none": [ ... ]    // none may pass — this is how exclusions are written
}
```

All three keys are optional. Each array holds **either a criterion or another group**, so
groups nest to any depth.

### A criterion

```json
{
  "id": "income-below-limit",
  "field": "annual_income",
  "op": "lt",
  "value": 250000,
  "label": "Annual income below ₹2,50,000",
  "fixable": false,
  "fix_hint": null,
  "pass_template": "Your income is ₹{user_value}, below the ₹{threshold} limit.",
  "fail_template": "Your income is ₹{user_value}, above the ₹{threshold} limit for this scheme.",
  "source_quote": "annual family income should not exceed Rs. 2,50,000"
}
```

| Key | Required | Notes |
| --- | --- | --- |
| `id` | yes | Unique **within the scheme**. Stable — the trace and gap analysis refer to it. |
| `field` | yes | Must exist in [profile-fields.md](profile-fields.md). The validation script enforces this. |
| `op` | yes | See operators below |
| `value` | yes | The threshold |
| `label` | yes | Short human phrase, used in checklists and the gap summary |
| `fixable` | yes | Can the user realistically change this? See below. |
| `fix_hint` | if fixable | One sentence saying how |
| `pass_template` | yes | Sentence shown when it passes |
| `fail_template` | yes | Sentence shown when it fails |
| `source_quote` | yes | The wording on the official page this came from |

### Operators

`equals` · `not_equals` · `lt` · `lte` · `gt` · `gte` · `in` · `not_in` · `includes`

`includes` is for array profile fields (does this list contain the value). Adding a new
operator means an engine change **and** a test — do not add one casually.

### Placeholders in templates

Only two are allowed: `{user_value}` and `{threshold}`. Both are filled from the trace,
never generated. Either may appear more than once in a sentence.

**The unit belongs in the template, not in the engine.** Write `₹{user_value}`,
`{user_value} acres`, `{user_value}%`. The engine only groups digits the Indian way
(`280000` → `2,80,000`); it never adds a symbol.

This is not a style preference. An engine that guesses the unit from the field name renders
a five-acre limit as "₹5", and the only person who knows what the number means is whoever
read the official page — which is the same reason we store `source_quote`.

**This is the mechanism that makes an explanation impossible to get wrong.** If a number is
not in the trace, it cannot appear in a sentence.

### Polarity inside `none`

Write `pass_template` and `fail_template` in terms of **what is good or bad for the user**,
not whether the condition is true.

For an exclusion, the criterion "passes" when the exclusion does *not* apply to them:

```
paid_income_tax_last_year = false
  → pass_template: "You did not pay income tax in the last assessment year."

paid_income_tax_last_year = true
  → fail_template: "This scheme excludes anyone who paid income tax in the last assessment year."
```

The engine handles the inversion. Nothing downstream ever has to know which group a
criterion came from. See [trace-format.md](trace-format.md).

**A nested group's sentence is its first child's sentence**, so write that child's templates
to explain the whole group including its carve-out.

### `fixable` — the field step 8 depends on

`fixable: true` means the user could plausibly change this and come back:

- no bank account yet → open one
- no income certificate → apply at the e-Sevai centre
- land not recorded in their name → get the record updated

`fixable: false` means they cannot:

- age, gender, category, district
- paid income tax last year
- holds a constitutional post

**`fixable` is not "can this change" — it is "would we tell someone to change it".**

The Girl Child Protection Scheme requires that a parent has been sterilised before turning 40.
That is technically an action a person could take. It is marked `fixable: false`, and it always
will be. The `fix_hint` is shown to the user as a suggestion, and there are things this product
must never suggest.

When the two readings disagree, `fixable` follows the second one.

**Gap analysis must show these differently.** "You are one document away" is useful.
"You are one unchangeable fact away" is a dead end dressed up as hope, and UX principle 3
says never a dead end. A non-fixable near-miss is reported honestly as a near-miss with no
route, not as an action.

---

## 4. Worked example

`data/schemes/central/pm-kisan.json` is the reference file. Read it next to this document.

Note what it demonstrates:

- one inclusion criterion, six exclusions
- two exclusions that nest a group inside `none` to express a carve-out
- `fixable: false` on every criterion — PM-KISAN is a weak showcase for gap analysis,
  which is worth knowing when picking the other four schemes for step 3

---

## 5. Rules for changing this format

1. A format change is a pull request that updates: this document, `data/schema/scheme.schema.json`,
   **and every existing scheme file**. There is no partial migration.
2. Never rename a `field` without updating `profile-fields.md` in the same commit.
3. Never delete a scheme `id`. Set `scheme_status` to `closed` or `superseded` instead — the
   date fields already stop it being shown.
