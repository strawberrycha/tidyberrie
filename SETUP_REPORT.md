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

1. Open the app in airplane mode. Create a task with two subtasks. Complete it and use Undo.
2. Delete the task. Open Task Trash and restore it. Quit and reopen the app to verify persistence.
3. In Settings → Backups, export JSON and re-import it. Check the preview counts before merging. Check the daily snapshot list and try restoring using test data.
4. Enable App Lock, background the app beyond the configured delay, return, and unlock it.
5. Open Calendar and Budget and check the Coming soon placeholders. Return to Home and Settings and verify that Budget content and Day Theme controls are hidden.
6. Test an Android task reminder and inspect notification permissions if it does not fire.
