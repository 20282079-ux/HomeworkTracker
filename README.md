# Homework Tracker

An offline-ready planner for school assignments. Add assignments with
the **＋ Add Task** form (or press `N`), then track progress with stats,
pinning, subjects and themes.

Built as a **Vite + React PWA**. All data lives in `localStorage`, and the
only external asset is the Google Fonts stylesheet.

## Running it

```bash
npm install     # installs React, Vite and vitest
npm run dev     # dev server (uses PORT env var when set, otherwise 5173)
npm run build   # production build → dist/
npm run preview # serve the production build locally
```

## Development

```bash
npm test            # run the core test suite (vitest + jsdom)
npm run test:watch  # re-run on change
npm run test:coverage
npm run icons       # regenerate the PNG app icons from scripts/generate-icons.mjs
```

The test suite (`tests/core.test.mjs`) exercises the framework-free logic
modules (`src/tasks.js`, `src/storage.js`, `src/theme.js`, `src/commands.js`)
directly — date math, stats, task filtering/sorting, storage round-trips with
legacy-key purging, theme presets and command fuzzy matching — plus structural
guards that keep the Vite+React shell intact and removed features (tests tab,
starfield, dev mode, templates, subtasks, recurring, export) gone.

## Layout

```
index.html           Vite entry: shell markup, PWA meta
public/              Static files served verbatim: manifest, sw.js, icons
vite.config.js       Vite + React plugin config (0.0.0.0 host, PORT aware)
src/
  main.jsx           React entry: mounts the app, registers the service worker
  App.jsx            Root component: state, persistence, keyboard shortcuts
  storage.js         localStorage persistence, seeds, legacy key cleanup
  tasks.js           Pure task helpers: date math, stats, filter/sort
  theme.js           Theme presets applied as CSS-variable style objects
  commands.js        Command registry + fuzzy scoring for the palette
  sound.js           Task-completion click (WebAudio)
  confetti.js        Canvas confetti burst
  components/        TaskCard, TaskModal, SettingsModal, CommandPalette, Toasts
  index.css          Global stylesheet (ported from the legacy css/styles.css)
tests/core.test.mjs  Core test suite
scripts/             generate-icons.mjs (PWA icon generation)
```

### Notes

- Theme presets are applied as a style object of CSS variables on the app
  root; `html.theme-*` classes drive the light-theme card elevation rules.
- The service worker (`public/sw.js`) precaches the static shell and caches
  the hashed Vite bundles on demand (stale-while-revalidate). Bump
  `CACHE_NAME` after changing any cached asset.
- Everything is same-origin, so the app works fully offline after the first
  load — no CDN round-trip is required to boot.
