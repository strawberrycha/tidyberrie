# Tidyberrie project plan

Tidyberrie is a personal Android APK. Data and assets stay on the phone. Work on one module at a time and verify it before moving on.

## Roadmap

1. Task Organizer
2. Navigation shell and Home (in progress)
3. Calendar
4. Budget
5. Meals, Events, and routine layer
6. Insights and hardening

## Task Organizer scope

- Editable category entities with defaults for Sleep, Meals, Hygiene, Chores, Academics and Learning, Fitness, Pageant, Leisure, Faith, and Events/Others.
- To do, In progress, Done, Skipped, and Postponed. Skipping an optional task does not count as a failure.
- Estimated versus actual time, duplicate task, and one-tap Move to today or tomorrow from Overdue.
- Selection and bulk actions, search, filter, sort, and group.
- List and Day timeline views. Swipe right to mark Done, swipe left to reschedule, and long-press to select.
- Share one reminder engine with snooze and mark-done actions. Treat a native alarm mode as a later stretch step.

## Home spec

Five bottom tabs keep their own navigation and scroll state. More groups utilities and settings. Home leads with a live clock, greeting, and week strip, followed by a short actionable plan and a three-day preview. The quick-add button opens the task form directly while Budget is disabled. Show reminder health only when needed.

## Backlog

Day Theme is hidden. Its code and data remain available for future work. Calendar and Budget tabs keep their place in the shell and show placeholders until enabled.
