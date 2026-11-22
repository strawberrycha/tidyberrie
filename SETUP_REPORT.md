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

## Reminder test on Xiaomi HyperOS

1. Update the installed app using the debug APK, or use `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`. Open More → Reminders and Alarms. Checking should resolve within three seconds. Follow the permission explanation if shown. If notifications were already allowed, expect no system prompt. Confirm Retry checks updates the rows after returning from Android settings.
2. Tap **Send test reminder in 10 seconds**. Check the scheduled count and upcoming time. Run separate tests in the app, after leaving the app from Recents, and with the phone locked. Wait for each test before starting the next. Repeat in airplane mode.
3. Create a task starting in three minutes with an **At scheduled time** reminder. Leave the app and wait for the alert. Schedule another far enough ahead to restart and unlock the phone before it is due. Restart without reopening Tidyberrie. Report whether it arrives. Note if you used Android Force stop, which can cancel reminders.
4. If delivery fails, enable Autostart, set Battery saver to **No restrictions**, lock Tidyberrie in Recents, set **Task reminders** to Alert with sound, and turn off Do Not Disturb and silent mode. Use the shortcuts under **Not ringing?** and repeat the tests. If Android denies notifications, confirm Home links to the fix. On Android 12/12L also test exact alarm denial where the switch is available.
5. Tap **Copy diagnostics** and send the pasted text with the expected time, actual delivery time or no delivery, and whether the app was open, closed, locked or restarted. The copy omits task titles.
6. Check quick date chips and past-date errors in Add task. Edit the title on an overdue task without changing its date. Scroll Home, Tasks, and Reminders in both themes and confirm no content enters the status bar.
