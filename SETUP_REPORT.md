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

1. Open Home in airplane mode. Check the clock, greeting, week strip, and first task card.
2. Tap +, then enter and save a task. Confirm the first tap opens its form directly. Select another weekday, change weeks, and press Today. Add four open tasks, complete one and use Undo, then check Show more.
3. Set a Tasks chip and filter, scroll, switch tabs, and return. Check that the chip, filter, and scroll survive. Re-tap the active tab to go to its root and top.
4. Open More → Appearance, set a name and 24-hour time, and check Home. Inspect Trash, Reminders and Alarms, Backup and Restore, Security, About, and disabled Meals.
5. From a More detail screen, press hardware Back to More, then Back to Home. Verify a first Back shows the exit prompt and a second within two seconds exits.
6. Open Calendar and Budget and verify their placeholders. Verify that Home has no Budget card and the phone has no Day Theme controls.
