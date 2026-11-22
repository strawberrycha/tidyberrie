# Tidyberrie project plan

Tidyberrie is a pink, minimalist, cute, offline-first personal planner PWA for one user on Android and a laptop.

## Modules

- **Home** — Show a customizable dashboard and today's Day Theme badge at the top right.
- **Tasks** — Support title, description, dated and timed or all-day tasks, color, icon, tag, priority, and status. Add, edit, delete, and reorder subtasks inside a task and show progress. Repeat once (no recurrence), daily, on weekdays or weekends, on specific days, weekly, monthly, yearly, or at a custom interval. Support multiple reminders at the scheduled time or 5, 15, or 30 minutes, 1 hour, or 1 day before, with snooze. Include Today, Upcoming, Overdue, and Completed smart lists, templates, pinning, search, filters, Trash, and Undo.
- **Calendar** — Provide month, week, day, and agenda views. Show colored dots, short date summaries such as “3 tasks, 1 event,” and the Day Theme icon on each date. Open a bottom sheet with quick add on date selection. Keep today's highlight current as the date changes.
- **Day Theme** — Set a default per weekday with a per-date override. Offer Study, Work, Deep Work, Rest, Self-care, Health, Errands, Travel, Celebration, Journal, Goals, Cleaning, Budget Day, and custom themes.
- **Budget (PHP)** — Ask for a Daily, Monthly, or Yearly view on first use. Track cash on hand and online accounts with name, color, icon, and balance. Track expected income (sahod, allowance, sales, gifts) with an expected date. Expected → Received credits the chosen account. Track current and planned expenses with dates, category, account, and recurrence. Planned → Paid debits the chosen account. Include automatic totals, category budgets, savings goals, an utang tracker, bill reminders, charts, what-if mode, and CSV export.
- **Settings** — Theme, avatar, currency (PHP), week start, dashboard card layout, backup reminder, backup/export/import, and optional App Lock.

### Budget quick cards

Let the user choose which cards to display. Include total now, upcoming income, now + upcoming, expenses paid, expenses planned, and safe-to-spend per day.

- **LEFT THIS MONTH** = (money now + upcoming income this month) − expenses this month.
- **LEFT OVERALL** = (money now + all upcoming income) − all expenses, including future expenses.

Before Phase 5 implementation, define the expense inputs against current balances to prevent paid expenses from being counted twice. Define the safe-to-spend calculation and cover both decisions with unit tests.

## Data model

All records have `id` (UUID), `createdAt`, `updatedAt`, and nullable `deletedAt` for soft deletion. Store money in integer centavos, all-day values as plain dates, and timed values as ISO timestamps with timezone information.

- **Task** — `title`, `description`, `startAt`, `endAt`, `allDay`, `color`, `icon`, `tag`, `priority` (low/medium/high), `status` (todo/doing/done), `repeatRule` (RRULE string), `reminders[]`, `autoCompleteWhenSubtasksDone`, `pinned`.
- **Subtask** — `taskId`, `title`, `done`, `order`, optional `dueAt`, optional `reminder`. Subtasks live inside their parent task. Reset subtask checks per occurrence of a repeating task.
- **TaskException** — One record per affected occurrence of a repeating task. Fields are `taskId`, `date`, `action` (skipped/moved/completed), `movedTo`, and `subtaskStates`.
- **DayTheme** — Weekday or specific date, `name`, `icon`, `color`.
- **Account** — `name`, `type` (cash/online), `balance` in centavos, `color`, `icon`.
- **Income** — `amount`, `source`, `expectedDate`, `status` (expected/received), `accountId`.
- **Expense** — `amount`, `category`, `date`, `status` (planned/paid), `recurrenceRule`, `accountId`.
- **BudgetHistory** — `entityType`, `entityId`, `field`, `oldValue`, `newValue`, `changedAt`.
- **Goal**, **Debt** (utang), and **CategoryBudget** — Define their fields in Phase 5.
- **Settings** — `budgetView` (daily/monthly/yearly), `theme`, `avatar`, `currency` (PHP), `weekStart`, `dashboardCards` layout, and backup reminder.

## Roadmap and phase quality gates

A phase is complete only when its gate passes.

0. **Design** — Approve tokens, themes, avatar poses, and wireframes on a phone-size mockup.
1. **Foundation** — Install on Android and laptop and verify operation in airplane mode.
2. **Tasks** — Pass repeat-rule tests, verify that deleted tasks can be restored from Trash, and test subtask behavior.
3. **Calendar and Home** — Verify month ends and leap years and smooth operation with 1,000+ tasks.
4. **Reminders** — Implement web reminders first, then Capacitor Android alarms. Verify that alarms fire with the app closed and after phone reboot.
5. **Budget** — Unit-test all formulas, verify integer centavos throughout, and trace every change in history.
6. **Backup, polish, and accessibility** — Reject corrupt imports safely, reach the Lighthouse targets, and pass the accessibility review.
7. **Optional Firebase sync** — Use Firestore, Google sign-in, and strict per-user security rules. Verify that offline edits merge correctly across both devices.

## Android alarm reliability

Use Capacitor Local Notifications. Request notification permission on Android 13+ and handle exact-alarm permission on Android 12+. Battery optimization can prevent reminders from firing, so guide the user through the relevant settings. Schedule within a rolling window and reschedule after edits and phone reboot. Test on a real phone with the app closed and again after restarting the phone.

## Quality targets

- Aim for Lighthouse scores of 90+ in Performance and Accessibility and 90+ on a Lighthouse PWA audit where available. Verify installability and offline operation directly.
- Lazy-load heavy features such as charts. Virtualize or paginate long lists.
- Unit-test repeat rules, date edge cases (month ends, leap years, timezones), and budget math. Add a few end-to-end tests for core flows and manually test offline use on a real Android phone.

## UX principles

- Show quick add first and let users expand advanced options. Follow Hick's law by keeping choices per screen few and patterns consistent.
- Give clear feedback for every action. Disable impossible dates, warn when the budget would go negative, and provide helpful empty states.
- Scale text with system font size, support keyboard navigation on laptop, and provide screen-reader labels.

## Privacy

- Keep data on the device by default and exclude tracking and analytics.
- Offer an optional App Lock with PIN or biometric unlock. Explain that a PIN only blocks casual access.
- Offer optional passphrase-encrypted backups using Web Crypto AES-GCM. Warn that a forgotten passphrase cannot be recovered.
- Confirm destructive actions. Require typing a confirmation word to delete all data.
