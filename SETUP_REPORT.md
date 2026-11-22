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

## Phase 4 reminders and Android

Web testing uses `npm run dev` or a production preview. For offline testing run `npm run build` and `npm run preview -- --port 4173 --strictPort`. Open **Settings → Reminders**. Deny browser notifications, set the one-minute test, and check that it appears in **Due reminders**. Snooze it, disable DevTools network, reload, and confirm it appears only after the snooze expires. Enable site notifications through your browser and repeat the test with Tidyberrie open.

Web verification passed lint, strict typecheck, the production build, and all 45 tests. Headless Chrome used an accelerated page clock and verified denial fallback, persisted snooze, reload in offline mode, and acceptance of the notification by the service worker. The Android debug Java compile passed without signing an APK. The merged manifest contains the notification and exact-alarm permissions and the plugin’s boot receiver. Windows notification toasts and physical-phone delivery remain unverified.

### Windows Android setup

1. Install Android Studio 2025.2.1 or newer. In SDK Manager install Android SDK Platform 36, Build-Tools 36.0.0, and Platform-Tools. Use Studio’s bundled JDK 21 as the Gradle JDK. For command-line Gradle, set `JAVA_HOME` to Studio’s `jbr` directory and `ANDROID_HOME` to the SDK path shown in SDK Manager. [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup)
2. From the Tidyberrie project folder, run:

   ```powershell
   npm ci
   npm run build
   npx cap sync android
   npx cap open android
   ```

3. Enable Developer options and USB debugging on your phone. Connect by USB, accept the debugging prompt, select the phone in Android Studio, and click **Run**. Install your manufacturer’s Windows USB driver if Studio cannot see the phone.
4. With Android Studio’s local debug signing configured, build a debug APK from the repository root using:

   ```powershell
   Push-Location android
   .\gradlew.bat :app:assembleDebug
   Pop-Location
   ```

   The APK is at `android/app/build/outputs/apk/debug/app-debug.apk`. Local signing material and build outputs stay outside Git.

### Phone test checklist

1. **App closed:** Allow notifications and exact alarms in Settings → Reminders. Schedule the one-minute test, leave the app and swipe it from Recents. Check for one system notification. Android **Force stop** is a separate OS condition.
2. **Phone locked:** Schedule another test, lock the screen, and check the notification and lock-screen privacy setting. Allow time for Android’s idle alarm throttling.
3. **Restart:** Create a timed task several minutes ahead with an at-time offset. Restart the phone, unlock it once, and leave Tidyberrie closed. Check that the alert is restored and appears once.
4. **Airplane mode:** Repeat the locked-screen test while offline. Open the app afterward and check Due reminders.
5. **Notification permission denied:** Turn off notifications in Android app settings. Reopen Tidyberrie, schedule the test, and check **Due reminders** after one minute.
6. **Exact alarms denied:** Leave notifications enabled, turn exact alarms off, and reopen Tidyberrie. Schedule another test. Check the reported denial and Due reminders. Android may deliver the inexact system notification late.
7. **Edits and cancellation:** Schedule an alert, change its task time, and confirm the old time is quiet. Repeat after completing, skipping, or deleting an occurrence. Snooze a due alert and reload to check persistence.

Android restores the existing queue after the first unlock following reboot. Reopen Tidyberrie periodically to extend the 14-day queue. OEM battery restrictions, Doze, force-stop, and exact-alarm settings can affect delivery. Web reminders require a running Tidyberrie page.

## Phase 5A budget core

From the project folder, run `npm run dev` and open **Budget**. Use `npm run build` followed by `npm run preview -- --port 4173 --strictPort` to test the offline production build.

Lint, strict typecheck, all 53 tests, and the production build passed. Headless Chrome verified onboarding, inline validation, both settlement transitions, the unchanged projection during settlement, Undo, Trash restore, customizing cards, and a transfer saved offline and retained after reload. Home showed the saved custom card while offline. The development seed benchmark is recorded in DECISIONS.md.

### Manual test

1. Choose **Monthly**. Add a cash account with opening balance **100.00** and an online account with **0**. Add expected sahod of **40.25** and a planned expense of **15.50** dated this month. Money now is **₱100.00** and Left this month is **₱124.75**.
2. Mark the expense paid and choose the cash account. Money now becomes **₱84.50**, while Left this month stays **₱124.75**. Select **Undo**, then receive the income. Money now becomes **₱140.25** and Upcoming income becomes **₱0.00**. Move **10.00** from cash to online and check that total cash stays the same.
3. Add a recurring expense with a three-occurrence limit. Pay one occurrence from the period list. Inspect **History** for the new settlement. Delete a disposable expense, then open **Budget Trash** and restore it.
4. Open **Customize cards**. Change a card label or order and choose which cards appear on Home. Test the date, account, status and category filters. Switch between Daily, Monthly, and Yearly in the header.
5. In production preview, wait for the service worker to activate. Disable the network, add a transfer, and reload. Check that both balances and the Home card choices persisted.

Amounts use period dates entered on records. Future recurring projections cover the next 90 days in the list. A series without an end displays open-ended lifetime projections, while month and year calculations remain finite.

## Phase 5B budget extras

Run `npm run dev`, then open **Budget → Category limits, goals & utang** or **Monthly summary**.

Lint, strict typecheck, all 61 tests, and the production build passed. Headless Chrome verified the category warning, goal contribution and projection, a partial debt payment, a read-only what-if preview, CSV download content, bill and utang reminders, and offline reload persistence. It opened the monthly summary tables and all three lazy-loaded charts with the network disabled.

### Manual test

1. Set a Food monthly limit. Add a planned Food expense and pay an occurrence of a second Food expense. Check that both figures appear in the progress card and that the warning changes as you cross the limit.
2. Create a savings goal and contribute from Cash. Check the linked savings balance, projected finish, and unchanged Money now. Try Undo.
3. Create an **I owe them** debt, record a partial payment, and check that Budget shows a paid expense. Repeat for **They owe me** and confirm received income. For **Between my accounts**, verify the payment appears as a transfer. Check that overpayment is rejected and Undo corrects the remaining balance.
4. Enable a reminder on a planned bill or open utang, with a due date falling in the Phase 4 reminder window. Check **Settings → Reminders**. Pay one recurring bill occurrence and check that the other occurrences still have reminders.
5. Preview a purchase and close the dialog. The saved budget and history should retain their original values. Open **Monthly summary** and compare the chart with the tables. Export transactions and check the CSV’s amount column is in centavos.
6. For offline verification, run `npm run build` and `npm run preview -- --port 4173 --strictPort`. After the service worker activates, disable the network, reload Budget extras and Monthly summary, and check your saved records and charts.

### Phase 6 manual checks

Use a fresh browser profile with sample data. Run `npm run build` and `npm run preview` for the production CSP and offline cache. To run the browser suite, install Playwright Chromium with `npx playwright install chromium` or set `TIDY_CHROME_PATH` to a local Chrome executable, then run `npm run test:e2e`.

1. Create a repeated task with a subtask. Complete today’s occurrence, move the series to Trash, and restore it. Switch between Strawberry Milk and Sakura Night. Try tabbing through Settings and using the Calendar arrow keys.
2. Open Settings → Backups and export JSON and CSV. Try importing a corrupt JSON file and verify the current data remains intact. Select the valid backup, check preview counts, then try Merge and Replace. Replace requires `REPLACE`.
3. Create a record after a daily snapshot. Restore the daily snapshot and verify the record disappears. Restore the safety snapshot and verify the record returns.
4. Export encrypted JSON with a test passphrase. Try a wrong passphrase, then the correct one. Check that valid input shows a preview before any writes occur.
5. Enable App Lock, select “Any time away”, then switch tabs and return. Reload, enter three wrong PINs to check throttling, wait for the displayed retry delay, then unlock with the correct PIN.
6. After the PWA is ready, go offline and reload. Verify theme and tasks persist. On a supported browser try Install Tidyberrie. On Android, also verify the PIN gate after switching away and reopening the wrapper.
7. At 200% text size, inspect labels and buttons across screens. With reduced motion enabled, complete a task and verify there is no animation. In the test profile only, choose Delete all data, use the export option first, and type `DELETE` to verify that app records and snapshots clear.

**Automated results.** Lint, typecheck, production build, 65 unit tests, and seven Playwright tests passed. Axe WCAG A/AA checks and 200% text reflow passed on Home, Calendar, Tasks, Budget, Budget extras, Monthly summary, Settings, and Reminders in both active themes. The browser suite checked manifest metadata and offline reload with a restored backup.

Lighthouse 13.6.0 on the production Home route measured Performance/Accessibility/Best Practices of 100/100/100 on desktop and 95/100/100 on the standalone mobile rerun. The run immediately after the Playwright suite scored 61/100/100 on mobile. Lighthouse has no PWA category in this version. The manual script covers Android resume and the operating system install prompt.

### Phase 7 sync

With no Firebase environment variables, use `npm run dev` for local development or `npm run build` and `npm run preview` for the offline PWA. The Sync page will show that cloud sync is unavailable. No account is required.

To test locally with Firebase emulators, use Java 21 or newer. Run the following from PowerShell. The demo project uses synthetic identities. Never enter a real Google login in the emulator.

```powershell
$env:FIREBASE_EMULATORS_PATH = Join-Path (Get-Location).Path '.firebase/emulators'
npm run test:rules
$env:VITE_SYNC_EMULATOR = 'true'
npm run build
npx playwright install chromium
npm run test:sync
```

For a hands-on test, keep the emulator flag set in both shells. Run `npm run emulators` in one and `npm run preview` in the other. Use two separate browser profiles with the preview URL.

1. In Settings → Sync, sign in with the same synthetic account in both profiles. Turn on sync and, for an encrypted run, choose encryption before enabling the first profile. Enter the same passphrase in the second.
2. Create a shared task in profile A, use Sync now in A and B, and confirm the task appears in B. Take both profiles offline after the service worker is ready.
3. Edit the shared task and add a new task in A. Delete the shared task in B after A's edit and add a different task. Reload A offline and check that its edits are still there.
4. Reconnect B and sync first. Reconnect A, unlock the encrypted sync session if prompted, and sync. Confirm the deletion and conflict message in A. Sync B again and verify that both independent tasks appear in both profiles.
5. Turn off sync in B and then sign out. Confirm both tasks remain available, even after reload. If testing reminders, verify that each device schedules reminders from the merged records once.

For a real Firebase project, configure Google Authentication, authorize the hosting domain, and install the repository’s Firestore rules and indexes before enabling sync. Use `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_API_KEY`, and `VITE_FIREBASE_APP_ID` in an ignored local environment file or in the build environment. Tidyberrie uses the project's standard `<project>.firebaseapp.com` auth domain. Send the configured production CSP from the host, including the frame restriction. Leave the emulator flag unset. Service account files and administrative credentials are unnecessary for the app. Real Google authentication and Firebase deployment were outside local verification.

**Verification.** Lint, typecheck, production build, 70 unit tests, and two Firestore emulator rules tests passed. The default build passed seven Playwright regressions including offline reload and Axe checks on Sync. A separate two-profile Playwright test passed against the Auth and Firestore emulators with encrypted payloads, concurrent offline edits, a tombstone, offline reload, and local retention after sign-out.
