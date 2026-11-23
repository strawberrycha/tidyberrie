# Setup and verification

Use a supported Node.js LTS, Java 21 and Android SDK 36. Install the locked dependencies with `npm ci`.

```powershell
npm run lint
npm run typecheck
npm test
npm run android:prepare
# If JAVA_HOME is stale, point it to Android Studio's bundled Java 21 for this shell.
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
Set-Location android
.\gradlew.bat assembleDebug
```

Use `npm run dev` for development. Install Playwright Chromium with `npx playwright install chromium` or set `TIDY_CHROME_PATH` to an installed Chrome. The Android debug output is `android/app/build/outputs/apk/debug/app-debug.apk`. Install it on the test phone with Android Studio or adb.

## Schedules and reminders phone check

1. Update the app in place with `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` or Android Studio. Confirm existing independent tasks still appear.
2. In Tasks, try the Monday example. Open More → Organize → Schedules, add timed tasks, change days and duplicate Monday to Tuesday. Pause and resume the copy. Delete it and check Trash and Undo.
3. Compare Today By schedule and By time. Expand and collapse subtasks, check one off, and undo. Skip one occurrence and confirm another day remains available. Try long-press selection, swipe, and Overdue moves.
4. Enable Notify on a schedule task due in a few minutes. Check its time and schedule in Home → Reminders → Upcoming. Leave the app and lock the phone. Verify delivery. Repeat with another occurrence, skip it before it is due, and check that it is removed from Upcoming and stays silent.
5. Leave an alert unhandled and check the Home badge and Missed tab. Try Open, Snooze and Done. Confirm the Home clock is gone and that More → Reminders and Alarms links to the inbox. Disable notifications and check the warning icon and settings link.
6. Check both themes at 200% text, TalkBack, and swipe near Android’s back-gesture edges. If delivery fails on Xiaomi, check Autostart, Battery saver, alert-channel sound and Do Not Disturb. Copy diagnostics and note the expected time and whether the app was open, closed or locked.
