# Personal Study Tool

A browser-based Quizlet Learn clone. No accounts, no server, no install —
open the link, paste flashcards, study until mastered.

- Live site: `https://crinsp.github.io/personalstudytool/` (after first deploy)
- Local use: just open `index.html` in any modern browser

## How to use

1. **Generate flashcards with Claude.** Paste your study material into Claude
   along with the prompt below. Claude will output one flashcard per line in
   the format the app expects.
2. **Open the site**, click **+ New set**, and paste Claude's output. Give
   the set a name.
3. **Review & edit.** Every parsed card appears in an editable table. Fix
   typos, delete junk rows, or add missing cards before saving.
4. **Study.** Click a set to enter Learn mode. It plays out exactly like
   Quizlet: multiple-choice rounds for new cards, typed answers once you're
   learning them, two correct in a row to master. Progress persists in your
   browser.

## The Claude prompt

Paste this into Claude together with your study material:

> Take the study material below and output tab-separated flashcards, one per
> line. Format: `TERM<TAB>DEFINITION`. No headers, numbering, markdown, or
> surrounding prose. Keep definitions concise but complete.
>
> Study material:
> <your notes here>

The app also accepts these fallback separators per line, so slightly
malformed output still parses:
`term - definition`, `term — definition`, `term: definition`.

## Learn mode behavior

- **Rounds of ~7 cards**, weighted toward cards you don't know yet.
- **Multiple choice** for not-started cards; 4 options with distractors
  pulled randomly from other cards' terms.
- **Typed answer** once a card is being learned. Case-insensitive, tolerant
  of small typos (Levenshtein distance ≤ 1 for short answers, ≤ 2 for
  longer). An **Override: I was right** button covers near-misses the
  grader got wrong.
- **Two correct typed answers in a row** moves a card to Mastered.
- **Wrong answers re-queue** at a random position later in the current
  round, so you see them again before moving on.
- **Randomized everywhere** — card order, option positions, distractors,
  and re-queue positions are re-shuffled every time.
- **Progress bar** with Not started / Learning / Mastered buckets.
- **Direction toggle** — flip between "see definition, type term" (default)
  and "see term, type definition".

## Data

Sets and progress live in `localStorage`, keyed per-browser. Use the
**Export** button on any set to download it as JSON; drag a JSON file back
in with **Import JSON** to restore it on another device.

## Deployment

The site deploys automatically to GitHub Pages on every push to `main`
via `.github/workflows/pages.yml`. To enable it the first time:

1. Push to `main`.
2. In repo **Settings → Pages**, set **Source** to **GitHub Actions**.
3. The next push (or re-run of the workflow) publishes the site.

## Structure

```
index.html          library / upload / edit
study.html          Learn mode
css/style.css
js/app.js           library + upload + editor
js/storage.js       localStorage CRUD
js/parser.js        TSV parsing with fallbacks
js/study.js         Learn controller
js/learn/engine.js  rounds, grading, mastery (pure functions)
js/learn/ui.js      DOM rendering helpers
```

No build, no dependencies. Any change takes effect as soon as you reload.
