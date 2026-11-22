# Tidyberrie project rules

Tidyberrie is a private, offline Android APK for one phone, built with React, Vite, and Capacitor. The browser is for development and tests. The app has no public distribution, web/PWA build, sync, accounts, or analytics.

- Read AGENTS.md first. Read only the relevant sections of the other project docs. Work on one module at a time. The current focus is Task Organizer. Stay within the stated task.
- Use supported Node.js LTS and the pinned lockfile. Follow UI → hooks → services → repositories → Dexie. Validate external input with Zod in services. Use UUIDs and created, updated, and soft-delete timestamps for records. Add forward Dexie migrations, preserving existing data.
- Store money as integer centavos. Use plain local dates for all-day items and recurrence keys. Keep timezone information on timed values. Keep budget formulas in a pure module.
- Use design tokens for colors, spacing, and typography. Support WCAG AA, 48dp Android targets, 200% text, visible focus, and reduced motion. Pair color with accessible text or icons.
- Keep CSP strict and bundle all runtime assets in the APK. Retain local backups, snapshots, Trash, and Undo. Request Android permissions only when needed.
- Log each dependency and decision briefly in DECISIONS.md. Update existing docs in place. Create Markdown files only when explicitly asked.
- Run lint, typecheck, unit tests, and build before finishing. Keep tests meaningful. Remove tests for retired features only when their behavior has been removed. Run APK or browser checks as applicable.
- Commit locally in small conventional commits. Never push or handle credentials. Keep the project in OneDrive. Retry an EBUSY, EPERM, or file-lock failure once, then stop and report the failed command if it recurs.

Finish with what changed, files changed, how to run, manual test steps, limitations, and decisions needed.
