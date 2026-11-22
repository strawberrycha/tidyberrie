# Tidyberrie project plan

Tidyberrie is a pink, minimalist, cute, offline-first personal planner PWA for one user on Android and a laptop.

## Modules

- **Home** — Show a customizable dashboard and today's Day Theme badge at the top right.
- **Tasks** — Support title, description, dated and timed or all-day tasks, color, icon, tag, priority, and status. Add, edit, delete, and reorder subtasks inside a task and show progress. Repeat once (no recurrence), daily, on weekdays or weekends, on specific days, weekly, monthly, yearly, or at a custom interval. Support multiple reminders at the scheduled time or 5, 15, or 30 minutes, 1 hour, or 1 day before, with snooze. Include Today, Upcoming, Overdue, and Completed smart lists, templates, pinning, search, filters, Trash, and Undo.
- **Calendar** — Provide month, week, day, and agenda views. Show task summaries such as “3 tasks, 2 done,” color dots, and the Day Theme icon. Open a bottom sheet or a wide-screen side panel with quick add on date selection. Keep today's highlight current as the date changes.
- **Day Theme** — Set a default per weekday with a per-date override. Offer Study, Work, Deep Work, Rest, Self-care, Health, Errands, Travel, Celebration, Journal, Goals, Cleaning, Budget Day, and custom themes.
- **Budget (PHP)** — Ask for a Daily, Monthly, or Yearly view on first use. Track cash on hand and online accounts with name, color, icon, and balance. Track expected income (sahod, allowance, sales, gifts) with an expected date. Expected → Received credits the chosen account. Track current and planned expenses with dates, category, account, and recurrence. Planned → Paid debits the chosen account. Include automatic totals, category budgets, savings goals, an utang tracker, bill reminders, charts, what-if mode, and CSV export.
- **Settings** — Theme, avatar, currency (PHP), week start, dashboard card layout, backup reminder, backup/export/import, and optional App Lock.

### Account balances and status changes

- Derive each account balance as opening balance + received income − paid expenses + incoming transfers − outgoing transfers. Do not persist a mutable balance. Recalculate from current records so Undo, deletion, and restoration automatically correct balances. Exclude soft-deleted records.
- Transfers between the user's own accounts change the two account balances by equal and opposite amounts. Exclude transfers from income, expenses, and monthly net totals.
- Marking income Received or an expense Paid changes its status once and writes one `BudgetHistory` entry in the same transaction. Repeating an already applied action leaves the status and history unchanged.

### Budget quick cards

Let the user choose which cards to display. Include total now, upcoming income, now + upcoming, expenses paid, expenses planned, and safe-to-spend per day.

Money now is the sum of the derived account balances.

- **LEFT THIS MONTH** = money now + expected-but-not-yet-received income due this month − planned-but-not-yet-paid expenses due this month.
- **LEFT OVERALL** = money now + all expected unreceived income − all planned unpaid expenses.
- **NET THIS MONTH** (separate card) = all income (received + expected) this month − all expenses (paid + planned) this month.
- **SAFE TO SPEND PER DAY** = LEFT THIS MONTH ÷ days remaining in the period, or ÷ days until the next expected sahod when using that horizon.

## Data model

All records have `id` (UUID), `createdAt`, `updatedAt`, and nullable `deletedAt` for soft deletion. Store money in integer centavos, all-day values as plain dates, and timed values as ISO timestamps with timezone information.

- **Task** — `title`, `description`, `startAt`, `endAt`, `allDay`, `color`, `icon`, `tag`, `priority` (low/medium/high), `status` (todo/doing/done), `repeatRule` (RRULE string), `reminders[]`, `autoCompleteWhenSubtasksDone`, `pinned`.
- **Subtask** — `taskId`, `title`, `done`, `order`, optional `dueAt`, optional `reminder`. Subtasks live inside their parent task. Reset subtask checks per occurrence of a repeating task.
- **TaskException** — One record per affected occurrence of a repeating task. Fields are `taskId`, `date`, `action` (skipped/moved/completed), `movedTo`, and `subtaskStates`.
- **DayTheme** — Weekday or specific date, `name`, `icon`, `color`.
- **Account** — `name`, `type` (cash/online), `openingBalance` in integer centavos, `color`, `icon`. The current balance is derived.
- **Income** — `amount`, `source`, `expectedDate`, `status` (expected/received), `accountId`.
- **Expense** — `amount`, `category`, `date`, `status` (planned/paid), `recurrenceRule`, `accountId`.
- **Transfer** — `amount` in integer centavos, `date`, `fromAccountId`, `toAccountId`.
- **BudgetHistory** — `entityType`, `entityId`, `field`, `oldValue`, `newValue`, `changedAt`.
- **Goal**, **Debt** (utang), and **CategoryBudget** — Define their fields in Phase 5.
- **Settings** — `budgetView` (daily/monthly/yearly), `theme`, `avatar`, `currency` (PHP), `weekStart`, `dashboardCards` layout, and backup reminder.

## Roadmap and phase quality gates

A phase is complete only when its gate passes.

0. **Design** — Approve tokens, themes, avatar poses, and wireframes on a phone-size mockup.
1. **Foundation** — In the Phase 1 Dexie schema, store `Account.openingBalance` in integer centavos. Omit the mutable `balance` field and any balance index. Install on Android and laptop and verify operation in airplane mode.
2. **Tasks** — Pass repeat-rule tests, verify that deleted tasks can be restored from Trash, and test subtask behavior.
3. **Calendar and Home** — Verify month ends and leap years and smooth operation with 1,000+ tasks.
4. **Reminders** — Implement web reminders first, then Capacitor Android alarms. Verify that alarms fire with the app closed and after phone reboot.
5. **Budget** — Unit-test every budget rule and formula. Verify that paid expenses and received income are each counted once, a transfer changes both account balances without changing aggregate cash or income and expense totals, repeated status changes produce one history entry, Undo of a paid expense and deletion correct balances, and recurring expenses count each occurrence once according to its date and status. Test all four cards, including both safe-to-spend horizons. Verify integer centavos throughout and trace every change in history.
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
