# Setup and verification

Use a supported Node.js LTS, Java 21 and Android SDK 36. Install the locked dependencies with `npm ci`.

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npx cap sync android
# If JAVA_HOME is stale, point it to Android Studio's bundled Java 21 for this shell.
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
Set-Location android
.\gradlew.bat assembleDebug
```

Use `npm run dev` for development. Install Playwright Chromium with `npx playwright install chromium` or set `TIDY_CHROME_PATH` to an installed Chrome. The Android debug output is `android/app/build/outputs/apk/debug/app-debug.apk`. Install it on the test phone with Android Studio or adb.

## Phone smoke test

1. Open Home and Tasks in airplane mode. Check for developer text. At 200% text, confirm the greeting and quote stay beside the avatar and weekday labels stay legible.
2. Verify Home has one empty message and no progress bar at zero tasks. Tap + and check the task form opens directly. Add and complete tasks, use Undo, and check the pink progress track and fill.
3. Scroll Home and Tasks until the last row clears the FAB and tabs. Focus a text field and confirm the keyboard hides the FAB and the input stays visible.
4. Check the sticky chip row and each empty state. Open Search, type, clear, and use Android Back. Open Filter, apply and remove a chip, then Reset. Try the three-dot Sort menu.
5. Edit a task and try to leave without saving. Check the confirmation and the sticky Save and Cancel controls. Check AppBars, Back arrows, Trash, Backups, and Reminders.
6. Repeat in Sakura Night. Check Calendar and Budget placeholders and verify Day Theme stays hidden.
