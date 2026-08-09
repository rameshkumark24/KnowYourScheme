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
| `girl_child_count` | number | `children[]` where `child_gender` is `female` |
| `has_only_girl_children` | boolean | `child_count > 0` and `girl_child_count === child_count` |

`has_only_girl_children` is derived rather than asked because **rules compare a field to a
constant, never to another field**. The Girl Child Protection Scheme needs "all of your
children are girls", which is `girl_child_count === child_count` — not expressible as a rule.
Deriving the comparison into a boolean keeps the rule language small. If a second scheme needs
a different field-to-field comparison, derive that one too rather than extending the operators.

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
| `occupation` | enum | `farmer` · `daily_wage` · `self_employed` · `street_vendor` · `salaried` · `student` · `homemaker` · `unemployed` · `retired` |
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
| `disability_type` | enum | `intellectual` · `locomotor` · `visual` · `hearing` · `speech` · `muscular_dystrophy` · `leprosy_cured` · `multiple` · `other` |
| `ration_card_type` | enum | `aay` · `phh` · `nphh` · `none` |
| `owns_house` | boolean | |
| `is_destitute` | boolean | No regular means of support. Read by all three pension schemes. |
| `is_bpl` | boolean | From a below poverty line family |
| `immovable_property_value` | number | Rupees. `0` if none. |
| `household_has_lpg_connection` | boolean | Any LPG connection from any oil company in the household |
| `is_poor_household_declared` | boolean | Willing to sign the deprivation declaration in the prescribed format |
| `has_vending_certificate` | boolean | Certificate of Vending or ULB identity card |
| `has_vending_letter_of_recommendation` | boolean | Letter of Recommendation from a Block Development Office |
| `parent_sterilised` | boolean | Either parent has undergone sterilisation |
| `parent_sterilisation_age` | number | Age of that parent at the time |

The last two are read only by the Girl Child Protection Scheme. Ask them **inside that
scheme's flow**, not in the general wizard — see the note on sensitive fields below.

## Education and study

Read by Pudhumai Penn, Tamil Pudhalvan and the PM-USP scholarship. Ask these only when the
user says they are studying, or has a child who is.

| Field | Type | Values |
| --- | --- | --- |
| `school_type_6_to_12` | enum | `government` · `government_aided` · `private` · `mixed` |
| `school_medium` | enum | `tamil` · `english` · `other` |
| `current_course_type` | enum | `ug_degree` · `pg_degree` · `diploma` · `iti` · `none` |
| `course_mode` | enum | `regular` · `distance` · `correspondence` |
| `is_first_higher_education` | boolean | This is the first course taken after school |
| `class_12_percentile` | number | Percentile among successful candidates in the same stream and board — **not** a mark percentage |
| `receiving_other_scholarship` | boolean | Any other merit or state scholarship, fee waiver or reimbursement |

`class_12_percentile` is the one to be careful with. A student who reads the question quickly
will type their marks percentage, and a wrong answer here silently changes the verdict. Word
the question, and the help text under it, with that in mind.

## Sensitive circumstances

| Field | Type | Read by |
| --- | --- | --- |
| `is_orphan` | boolean | Marriage Assistance for Orphan Girls |
| `is_intercaste_marriage` | boolean | Inter-Caste Marriage Assistance |
| `has_disability`, `disability_percent` | boolean, number | Differently Abled Pension |
| `is_destitute` | boolean | All three pension schemes |

These follow the sensitive-field rules below. None goes in the general wizard.

`is_destitute` needs particular care in wording. "Are you destitute?" is a question that asks
someone to describe themselves in a word most people would not accept. Ask what the department
actually means — whether they have any regular means of support — and use the department's term
only in the explanation of the result.

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

**A rule may not reference a `child_*` field today.** The engine throws if one does.

Evaluating a rule once per child, and naming which child it applies to, is the intended
design — but it is not built. Until it is, a scheme that depends on a child's circumstances
has two options:

- **Derive an aggregate** over `children[]`, as `girl_child_count` and `has_only_girl_children` do.
  Cheap, but it loses which child qualified, so the card cannot say *"your younger daughter
  qualifies"*.
- **Model it on the student's own profile** if they are 18 or over. Pudhumai Penn and Tamil
  Pudhalvan both do this, because college students usually are.

Neither covers a scheme for a school-age child that must be claimed by the parent. That is
the case that needs real per-child evaluation, and it should be built before any such scheme
is curated — not worked around a third time.

**Do not compose two aggregates to fake it.** "Has a daughter in college" AND "has a daughter
who went to a government school" is true for a family whose daughter A is in college after
private school and whose daughter B went to a government school and is not in college. That
is a false positive, and false positives are the thing this product exists to avoid.

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

## Sensitive fields

Some schemes are gated on facts nobody should be asked casually. `parent_sterilised`,
`parent_sterilisation_age`, `is_orphan` and `is_intercaste_marriage` are the ones so far, and
there will be more — disability, widowhood and HIV status all appear in real eligibility rules.

Three rules for these:

1. **Never in the general wizard.** Ask only when the user has opened the scheme that needs it.
2. **Say why before asking.** "The Girl Child Protection Scheme asks this. You can skip it."
3. **Skipping is a first-class answer.** It produces `UNKNOWN`, which reads as *needs more
   info*, not *not eligible*.

The profile never leaves the browser, which is what makes asking acceptable at all. It does
not make asking in the wrong place acceptable.

## Adding a field

1. A rule in a real scheme must need it. Not "we might need it later".
2. Add the row here, in the right tier.
3. Add it to the form (step 6) — a rule may not reference a field the form does not collect.
4. Say in the pull request which scheme forced it.
