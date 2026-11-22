# Tidyberrie setup report

## Tool versions

- Node.js v24.20.0, accepted under the supported-LTS requirement
- npm 11.3.0
- Git 2.55.0.windows.5

## Files created

- `.gitignore` — Excludes dependencies, builds, environment files, coverage, OS and editor files, and Playwright artifacts.
- `AGENTS.md` — Project rules, approved stack, architecture, and definition of done.
- `PLAN.md` — Modules, data model, phase gates, alarm reliability, quality, UX, and privacy.
- `DESIGN.md` — Theme proposals, tokens, typography, layout, illustration, and components.
- `DECISIONS.md` — Records the Node.js decision.
- `SETUP_REPORT.md` — Records setup and verification.

## Scope and open items

All required setup tools are available. App scaffolding, a package manifest, and npm installation are deferred. Build, lint, typecheck, tests, offline operation, and accessibility checks apply once there is an app to verify. Phase 0 still needs contrast checks and phone-size design approval. Phase 4 needs real Android tests for closed-app and post-reboot alarms. Phase 5 needs explicit budget formula inputs to avoid double-counting paid expenses.

The existing `design-source/` reference assets are outside the documentation commit.

## Verify the initial documentation commit from PowerShell

```powershell
node -v
npm -v
git --version
git status --short
git show --oneline --name-only a07caf0
git show --check a07caf0
```

The initial commit is named `chore: add project rules, plan, and design docs` and contains the six files listed above. `git status --short` may report the existing untracked `design-source/` directory.

## Phase 1 foundation

- `package.json`, `package-lock.json`, `index.html`, and the Vite, TypeScript, and ESLint configs define the pinned toolchain, scripts, manifest, and production CSP.
- `src/features/` contains the route placeholders and Settings controls. `src/shared/` contains theme and toast providers, PWA status, the Dexie migrations, repositories, import validation, snapshots, integer-centavo utilities, and seven foundation tests.
- `public/` contains placeholder PNG icons at 192px and 512px, including a maskable 512px icon. Existing `design-source/` assets remain untouched.

### Run and verify

```powershell
npm ci
npm run dev
```

Open `http://localhost:5173` for development. Stop with Ctrl+C.

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run preview -- --port 4173 --strictPort
```

Open `http://localhost:4173` for PWA verification. Wait for “Ready to work offline.” In Chrome DevTools, confirm the active worker under Application → Service Workers. Set Network to Offline and reload a route such as `/calendar`. If Chrome offers installation, install the app and repeat the check from the installed app. Restore network access and stop preview with Ctrl+C.

The Phase 1 run passed lint, typecheck, all seven Vitest tests, and the production build. Headless Chrome verified service-worker control on first load, the initial system-dark preference, saved theme selection, Undo, 44px desktop navigation targets, keyboard focus on the skip link, the 390px phone layout, and a direct Calendar load with the network disabled.

### Android installation and airplane-mode test

1. Start the production preview on port 4173 using the command above. On Android, enable Developer options and USB debugging, connect the phone over USB, and accept the debugging prompt.
2. Open `chrome://inspect/#devices` on laptop Chrome. Enable Discover USB devices. In Port forwarding, map Android port `4173` to laptop `localhost:4173` and enable port forwarding. [Chrome USB port forwarding guide](https://developer.chrome.com/docs/devtools/remote-debugging/local-server/)
3. Visit `http://localhost:4173` in Chrome on the phone. Wait for the offline-ready message, then use Chrome's Install app or Add to Home screen option.
4. Unplug USB, enable airplane mode, and reopen from the launcher. Open Calendar and Settings. Change the theme, close and reopen the app, and confirm the choice persists. Try the Undo sample.
5. For an HTTPS alternative, serve `dist/` from the root of an HTTPS static host with SPA fallback to `index.html` for non-file routes. Serve `sw.js` and static assets as files. Set a same-origin CSP response header matching the preview policy in `vite.config.ts` to enforce `frame-ancestors`. Visit the HTTPS origin on Android and repeat the install and airplane-mode test. Storage is separate for each origin.

### Audit and limitations

`npm audit` reported four moderate findings through `vite-plugin-pwa → workbox-build → glob/minimatch`. npm proposes a breaking downgrade with `npm audit fix --force`. The pinned toolchain was retained. `npm audit --omit=dev --offline` reported zero production dependency findings.

Backups are unencrypted JSON in Phase 1. An export above the 10 MiB import limit cannot be reimported in this phase. Local snapshots share the browser's storage with live data and are captured once per local day while the app is open. Real Android and laptop installation checks remain manual.

## Phase 2 tasks

The Tasks route now provides task and subtask CRUD, repeat rules and occurrence exceptions, six smart lists, filters, sorting, Undo, and Trash. Settings links to Task Trash and lets you choose the week start. Dexie upgrades in place to v2 while preserving v1 records. Reminder choices are stored for Phase 4.

Lint, strict typecheck, all 28 tests, and the production build passed. The 12 recurrence tests also passed in `America/Los_Angeles`. Headless Chrome verified the mobile sheet and validation, task creation and editing, an occurrence-only edit, completion and reopening, Undo, Trash restore, reload persistence, and creation with the network disabled. The production bundle excludes the development seed.

### Manual test

1. Run `npm ci` and `npm run dev`, then open `http://localhost:5173/tasks`. Select the floating **Add task** button. Submit with an empty title to see validation. Press Escape to close, then reopen and check that Title has focus.
2. Create a task for today with two subtasks. Press Enter in the first subtask to add the second, reorder them with the arrow buttons, and enable auto-completion. Expand the saved card, check both items, then reopen the task by unchecking one in Completed.
3. Create a daily repeat. Complete today's occurrence and check that tomorrow's card in Upcoming has unchecked subtasks. Edit tomorrow with **This occurrence only** and move it forward a day. Use **All occurrences** to edit the series title in a separate repeat.
4. Delete a task, choose Undo, and delete it again. In **Settings → Task Trash**, confirm that its subtasks are listed and restore it. To try permanent deletion, use a disposable sample task and confirm the prompt.
5. For offline testing, run `npm run build` and `npm run preview -- --port 4173 --strictPort`. Open `http://localhost:4173/tasks`, wait for the service worker to activate, then disable the network in DevTools. Reload, create a task offline, and reload again to confirm it persists. Stop preview with Ctrl+C.

## Phase 3 Calendar, Home, and Day Themes

Calendar provides Month, Week, Day, and Agenda views. Home shows the resolved theme, progress, next task, today’s list, and overdue link. Settings manages custom Day Themes and weekday/date assignments. The existing Tasks form handles quick add and the Budget card is a Phase 5 placeholder.

Lint, strict typecheck, the 35-test suite, and the production build passed. Headless Chrome checked all four views, keyboard date navigation, Day Theme precedence, prefilled quick add, completion and progress, phone and laptop panels, and offline persistence across reloads. The 1,000-task Month and Week timings are in DECISIONS.md.

### Manual test

1. Run `npm run dev` and open the URL printed by Vite. In **Settings → Day Themes**, set a weekday default and add a custom theme.
2. Open **Calendar**, Tab into the Month grid, use the arrow keys to move, and press Enter to open a date. Override its Day Theme, add a task from the date panel, and confirm the count changes. Switch to Week and Agenda and check the same date.
3. Select **Today → Day**, choose an empty hour, and confirm that the form prefills the date and time. Check the current-time line. On Home, complete a task and verify that progress updates. The overdue link should open the Overdue list directly.
4. Run `npm run build` and `npm run preview -- --port 4173 --strictPort`. Open `http://localhost:4173` and wait for the service worker to activate. Set DevTools Network to Offline, reload, and create a task from Calendar. Reload again and confirm the task and Day Theme persist. Stop preview with Ctrl+C.

## Phase 3B sticker and avatar assets

The pipeline validates individual transparent PNGs, generates two optimized WebPs per key, writes the typed manifest, and prints missing keys and cache weight. The current artwork source folder is absent. With the current checkout all illustration slots use Lucide.

Headless Chrome verified a separate build with four temporary sticker inputs, including image loading, Lucide fallback, keyboard picker selection, and persistence of task and Day Theme choices after an offline reload. The shipped manifest remains empty. The asset script is covered by tests for deterministic generation, missing sources, and invalid PNGs.

### Manual test

1. Run `npm ci` and `npm run assets` to see the missing keys. To add artwork, place a transparent square PNG at least 256px wide in `design-source/stickers/`, for example `study.png` or `avatar-happy.png`, then rerun `npm run assets`. Source PNGs stay local. Commit the generated manifest and WebPs when adding actual art.
2. Run `npm run dev`. Open a task form, expand **More options**, and search for **Study**. Try Tab, arrow keys, Home, and End with the picker unfiltered. Choose an icon and save. Edit the task again to confirm the choice persisted. Repeat in **Settings → Day Themes** with a custom theme.
3. Run `npm run build` and `npm run preview -- --port 4173 --strictPort`. Open the preview and wait until the service worker is active. Disable network in DevTools and reload. Check Home’s avatar and assigned theme badge. Reopen the task picker and confirm the saved selection and the cached illustration or Lucide fallback.
