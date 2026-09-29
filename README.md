# Homework Tracker

An offline-ready planner for school assignments and tests. Add assignments with
the **＋ Add Task** form (or press `N`), then track progress, grades, recurring
chores and study streaks across the Homework and Tests tabs.

Built as a **dependency-free static PWA** — no framework, no build step, no
server. All data lives in `localStorage`, and the only external asset is the
Google Fonts stylesheet.

## Running it

A local server is required: opening `index.html` from the file system (`file://`)
breaks the service worker.

```bash
npm install     # once — installs vitest only; the app itself has no runtime deps
npm start       # http://localhost:8123
```

On macOS you can also double-click **Homework Tracker.command**, which starts the
same server and opens the browser (falls back to `python3 -m http.server`).

Set `PORT` to change the port: `PORT=3000 npm start`.

## Development

```bash
npm test            # run the core test suite (vitest)
npm run test:watch  # re-run on change
npm run test:coverage
npm run icons       # regenerate the PNG app icons from scripts/generate-icons.mjs
```

The test suite (`tests/core.test.mjs`) boots every non-graphics file in `js/`
inside a Node `vm` sandbox with mocked browser globals, then exercises the core:
escaping helpers, date and grade math, storage round-trips, task
filtering/sorting, recurring resets, completion/undo, CSV/ICS export, plus
structural guards that keep `index.html`, `sw.js` and the CSP free of
third-party scripts.

## Layout

```
index.html          App shell: markup, CSP, script load order
manifest.json       PWA manifest
sw.js               Service worker (precache + offline navigation fallback)
css/                styles.css (base/theme), gamification.css, devmode.css
js/                 Plain scripts sharing one global scope
  state.js          Shared state, localStorage save/load, sample seeds
  util.js           Small helpers: escaping, dates, toast, confetti, tabs
  tasks.js          Task list, filters, add/edit modal, recurring resets
  tests.js          Tests/quizzes tab, countdown, flashcards
  gamification.js   Points, badges, starfield, streaks
  settings.js       Themes, subjects, export (CSV/ICS), settings modal
  command-palette.js Ctrl+K action launcher
  devmode.js        Hidden developer panel
  app.js            `App` facade, init, keyboard handling
tests/core.test.mjs Core test suite
scripts/            serve.mjs (dev server), generate-icons.mjs (PNG icons)
```

### Notes

- `js/*.js` are plain scripts loaded in order by `index.html` and share one
  global scope; **load order is load-bearing**. The service worker's
  `APP_SHELL` list must stay in sync with `index.html` (a test enforces this).
- Bump `CACHE_NAME` in `sw.js` after changing any cached asset.
- Everything is same-origin, so the app works fully offline after the first
  load — no CDN round-trip is required to boot.
