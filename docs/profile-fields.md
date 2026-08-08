# Profile fields

> The complete list of fields a rule is allowed to reference. The validation script (step 26)
> rejects any scheme whose rules mention a field that is not on this list.
>
> **If no rule reads a field, we do not collect it.** Adding a row here is a decision, not a habit.

---

## Storage rules

- The whole profile lives in **browser local storage**. It is never sent anywhere.
- **`dob` is stored. `age` is never stored** — it is computed at evaluation time.
- **Aadhaar numbers are never collected.** Not in any field, for any reason. Some schemes
  require an Aadhaar *card* as a document; that is a line in a checklist, not a number we hold.
- District is stored (rules read it). Precise location is used once for the e-Sevai lookup
  and never stored.

---

## Derived fields

Computed at evaluation time from stored fields. Rules may reference them; the form never asks for them.

| Field | Type | Derived from |
| --- | --- | --- |
| `age` | number | `dob` |
| `child_count` | number | `children[]` |

---

## Tier 1 — the first questions

The wizard asks these before showing any result. Keep this list short; it is the single
biggest cause of abandonment.

| Field | Type | Values |
| --- | --- | --- |
| `dob` | date | `YYYY-MM-DD`. 18+ only. |
| `gender` | enum | `male` · `female` · `transgender` · `prefer_not_to_say` |
| `annual_income` | number | Rupees, family income |
| `category` | enum | `general` · `obc` · `sc` · `st` · `mbc` · `dnc` |
| `district` | string | Tamil Nadu district name, or `other` |
| `occupation` | enum | `farmer` · `daily_wage` · `self_employed` · `salaried` · `student` · `homemaker` · `unemployed` · `retired` |
| `residence_type` | enum | `rural` · `urban` |

## Tier 2 — asked after the first results, to unlock more schemes

| Field | Type | Values |
| --- | --- | --- |
| `owns_agricultural_land` | boolean | |
| `land_holding_acres` | number | `0` if none |
| `education_level` | enum | `none` · `primary` · `secondary` · `higher_secondary` · `diploma` · `graduate` · `postgraduate` |
| `marital_status` | enum | `single` · `married` · `widowed` · `divorced` · `separated` |
| `has_bank_account` | boolean | |
| `has_disability` | boolean | |
| `disability_percent` | number | `0`–`100` |
| `ration_card_type` | enum | `aay` · `phh` · `nphh` · `none` |
| `owns_house` | boolean | |

## Tier 3 — the exclusion screen

Six of PM-KISAN's rules read these, and most central schemes reuse them. Ask them as **one
screen with checkboxes** ("Do any of these apply to you or your spouse?"), not seven separate
questions.

| Field | Type | Values |
| --- | --- | --- |
| `paid_income_tax_last_year` | boolean | |
| `is_government_employee` | boolean | Serving or retired, self or spouse |
| `government_employee_grade` | enum | `group_a` · `group_b` · `group_c` · `group_d_mts` · `not_applicable` |
| `monthly_pension_amount` | number | `0` if not a pensioner |
| `holds_constitutional_post` | boolean | Serving or former MP, MLA, Mayor, District Panchayat Chairperson |
| `is_registered_professional` | boolean | Practising doctor, engineer, lawyer, CA, architect registered with a professional body |
| `is_institutional_landholder` | boolean | Land held by a trust, society or company rather than a person |

## Family — how child and student schemes are reached

A minor never has a profile. The parent lists their children, and the children's schemes
appear in the parent's results.

`children` is an array. Each entry:

| Field | Type | Values |
| --- | --- | --- |
| `child_dob` | date | `YYYY-MM-DD` |
| `child_gender` | enum | `male` · `female` · `transgender` |
| `child_education_stage` | enum | `not_in_school` · `primary` · `middle` · `secondary` · `higher_secondary` · `college` |
| `child_class_or_year` | number | Class 1–12, or year of college |
| `child_school_type` | enum | `government` · `aided` · `private` |

A rule that reads a `child_*` field is evaluated **once per child**, and the result names
which child it applies to.

---

## Unanswered fields

Any field the user has not answered is `undefined`, and every check against it returns
**`UNKNOWN`** — never `FAIL`.

This matters more than it looks. Tier 2 and tier 3 are optional by design, so most profiles
will have unanswered fields most of the time. If an unanswered field counted as a failure,
the results screen would quietly tell people they do not qualify for schemes they do qualify
for — which is the exact problem this project exists to solve.

See [trace-format.md](trace-format.md) for how `UNKNOWN` changes the verdict.

---

## Adding a field

1. A rule in a real scheme must need it. Not "we might need it later".
2. Add the row here, in the right tier.
3. Add it to the form (step 6) — a rule may not reference a field the form does not collect.
4. Say in the pull request which scheme forced it.
