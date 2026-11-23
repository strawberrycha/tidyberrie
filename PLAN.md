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

- Named weekday schedules, active date ranges, pause, duplication and a timed task list. Today supports By schedule and By time. Independent tasks remain available.
- To do, In progress, Done, Skipped and Postponed. Optional overdue tasks stay out of badges and bulk overdue moves.
- T2 continues on the shared row. Long-press selects, swipe right completes or reopens, swipe left reschedules, and Overdue offers Today and Tomorrow. Bulk actions have one Undo.
- Home opens Missed and Upcoming reminders. Use More → Reminders and Alarms for device settings and diagnostics.
- Next work includes alarm mode, T3 name sorting, more grouping and a Day timeline view, then templates and quotas.

## Home spec

Five bottom tabs keep their own navigation and scroll state. More groups utilities and settings. Home leads with the app name and reminders bell, followed by the greeting, week strip, up to three compact Plan rows and a three-day preview. The quick-add button opens the task form directly while Budget is disabled. Show reminder health only when needed.

## Backlog

Day Theme is hidden. Its code and data remain available for future work. Calendar and Budget tabs keep their place in the shell and show placeholders until enabled.
