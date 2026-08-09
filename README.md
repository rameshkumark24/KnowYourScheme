# KnowYourScheme

A website where someone enters a few details and sees which government welfare schemes
they qualify for, which ones they are **one step away** from qualifying for, and what to do next.

> Existing systems tell you what you qualify for. None of them tell you what you are one
> document away from qualifying for — and none of them report how often they are right. We do both.

**This is not a government website.** It is an independent guidance tool. Final eligibility
is always decided by the issuing department.

---

## How it works

```
Profile (browser)  →  Rule engine  →  Verdict + trace  →  Templates  →  Screen
```

- The profile lives in the browser. Nothing is sent to a server. There is no login and no database.
- A rule engine evaluates plain JSON rules and returns a verdict **plus a trace** of every check.
- Explanations are fill-in-the-blank sentences whose numbers are copied from the trace.
- **No AI model is involved in any decision, or in any sentence shown to a user.**

The trace is the important output, not the verdict. Gap analysis, explanations and the
question box all read the trace.

---

## Tech stack

> **Build step 5 (Rule Engine) is now complete.** Decided so far:
>
> - **No backend, no database.** Static hosting (GitHub Pages / Netlify / Cloudflare Pages).
> - **Rule engine is plain JavaScript running in the browser.** (Located in `src/engine.js`)
> - **Scheme data is JSON in this repo**, shipped as a static bundle.
> - The auto-update bot (step 24) and the validation script (step 26) run as **scheduled
>   GitHub Actions**. Nothing of ours runs while a user is on the site.
>
> The frontend framework is not chosen yet. For now, you can test the rule engine interactively by running `node run.js`.

---

## Repository layout

```
.
├── AGENTS.md                       Hard rules and conventions. Read this first.
├── README.md
├── run.js                          Interactive CLI to test the rule engine
├── src/
│   └── engine.js                   The core rule engine logic
├── test/                           Rule engine and schema validation tests
├── docs/
│   ├── scheme-format.md            The scheme JSON format  ← step 2 deliverable
│   ├── trace-format.md             What the rule engine must emit
│   └── profile-fields.md           Every field a rule is allowed to reference
└── data/
    ├── documents.json              Canonical document names (for de-duplication)
    ├── schema/
    │   └── scheme.schema.json      JSON Schema used by the validation script
    └── schemes/
        ├── central/                Central government schemes
        └── tamil-nadu/             Tamil Nadu state schemes
```

---

## Working on scheme data

One scheme per file, named `<id>.json`, in the folder for its level.

Two rules that matter more than the rest:

1. **Copy every rule from the official page. Never guess a number.** If the official page does
   not state it, it does not go in the file.
2. **A scheme is not finished until a second person has checked it.** Set `curation_status`
   to `verified` only after that check, and record both names.

See [docs/scheme-format.md](docs/scheme-format.md) for the full format and a worked example.

---

## Team

| Person | Owns |
| --- | --- |
| Niranjana | Rule engine — the part that decides eligibility |
| Risvanth | Website — forms, screens, how it looks |
| Rameshkumar | Scheme data, testing, keeping everyone moving |

Everyone writes scheme data. Nobody pushes to `main` — every change goes through a pull
request reviewed by one of the other two.
