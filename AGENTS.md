# Tidyberrie project rules

Work as a senior full-stack developer and UI/UX designer. Apply web app best practices, sound data structures and algorithms, careful spacing, hierarchy, contrast and accessibility, and secure, recoverable data handling.

## Toolchain

Node.js: any supported LTS (22, 24, or 26). Developed on v24.20.0. Declare engines in package.json as >=22.

Use React, Vite, strict TypeScript, Tailwind CSS, Dexie.js (IndexedDB), vite-plugin-pwa, date-fns, rrule, Zod, React Hook Form, React Router, Lucide icons, Vitest, Testing Library, fake-indexeddb, ESLint, and Prettier. Later phases may use Recharts, dnd-kit, Playwright, Capacitor for Android, and optional Firebase sync.

## Architecture and data

- Organize features under `src/features/` (tasks, calendar, budget, dayTheme, settings) and shared code under `src/shared/` (ui, db, utils, theme).
- Enforce UI → hooks → services → repositories → Dexie. Keep database access out of UI code.
- Give every record a UUID `id` and `createdAt`, `updatedAt`, and `deletedAt` fields. Use soft deletion.
- Store money as integer centavos. Store all-day items as plain date strings and timed items as ISO timestamps with timezone information.
- Store recurring tasks as an RRULE with occurrence exceptions. Expand only the visible date range.
- Keep all budget formulas in one pure, unit-tested module.

## Recoverability, security, and offline use

- Provide an Undo toast on destructive actions, Trash with 30-day restore, budget change history, automatic local snapshots, JSON export/import, and versioned schemas with migrations.
- Validate all external input with Zod, especially imports. Render user text as text. Enforce a strict Content Security Policy.
- Minimize dependencies, pin versions with a lockfile, keep secrets out of Git, and request only needed Android permissions when implementing native features.
- Support full offline use. Self-host fonts via @fontsource and avoid runtime dependencies on external CDNs or remote assets.

## UX and workflow

- Use an 8-pt spacing grid, 44px minimum touch targets, one primary action per screen, clear hierarchy, WCAG AA contrast, visible focus rings, helpful empty states, and consistent patterns. Pair color cues with text or icons and respect `prefers-reduced-motion`.
- Build one phase at a time and stay within its scope. Make small commits with clear messages and leave unrelated files alone.
- When a requirement is ambiguous, choose the safest simple option and log it in DECISIONS.md. Before installing a package outside the approved stack, list the package and reason there.
- For each implementation task, verify that the build, lint, typecheck, and tests pass. Verify offline behavior and accessibility, then write a change summary.
