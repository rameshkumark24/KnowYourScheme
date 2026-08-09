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

> **React + Vite, plain JavaScript with JSDoc, plain CSS with custom properties, deployed as a
> static site to Cloudflare Pages. No backend, no database.**

Decided 9 Aug 2026, build step 1. **This does not change again.**

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React + Vite | Whatever Risvanth gets stuck on, help is one search away. One person owns the whole frontend and cannot afford to be blocked. |
| Language | JavaScript + JSDoc | No compile step, nothing new to learn. JSDoc still gives editor autocomplete on the trace shape. |
| Styling | Plain CSS + custom properties | Six screens do not need a framework. One file holds the colour and spacing system, checked against WCAG AA once. |
| Rule engine | Plain JavaScript, in the browser | `src/engine.js`. No framework dependency — it is imported, not wired in. |
| Scheme data | JSON in this repo | Shipped as a static bundle. Edited by pull request. |
| Backend | None | |
| Database | None | |
| Hosting | Cloudflare Pages | Edge locations inside India, so Tamil Nadu users hit a nearby server. Free, deploys on push. |
| Automation | GitHub Actions | The step 24 bot and the step 26 validator run on a schedule. Nothing of ours runs while a user is on the site. |

### The budget this buys you

React costs roughly 45KB gzipped before a line of your own code — about a third of the
under-three-seconds target on a mid-range Android over 4G. That is affordable, not free.
Three things protect it, and they are cheapest done from the first screen:

- **Code-split the screens.** The landing page and the profile wizard are the only things
  needed for a first result. Scheme detail, the document checklist and the question box load on demand.
- **Load the scheme bundle separately from the app.** It grows every time someone curates a scheme.
- **Add a service worker before the demo.** UX principles promise the app works offline once
  scheme data has loaded, and that promise needs one. `vite-plugin-pwa` is the usual way.

Measure it on a real phone on real 4G before Review 3 and put the number on a slide. No
competitor paper reports one.

---

## Running it

```bash
npm test                     # rule engine tests + schema validation
npm run test:engine          # engine only, no network needed

node run.js                  # answer questions, see the verdict and the trace
echo '{"owns_agricultural_land":true}' | node run.js
node run.js --profile some-profile.json
TRACE_JSON=1 node run.js --profile some-profile.json   # full trace as JSON
```

There is no build step and nothing to install to run the engine tests. `npm test` also
validates the scheme files against the JSON Schema, which pulls `ajv-cli` through `npx`
and therefore needs a network connection the first time.

---

## Repository layout

```
.
├── AGENTS.md                       Hard rules and conventions. Read this first.
├── README.md
├── package.json                    Test scripts. No dependencies to run the engine.
├── run.js                          Manual tester for the engine (development only)
├── src/
│   └── engine.js                   The rule engine
├── test/                           Engine tests, regression tests, schema validation
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
