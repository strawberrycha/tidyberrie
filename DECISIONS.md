# Tidyberrie decision log

## 2026-11-22

- **Decision** — Accept any supported Node.js LTS (22, 24, or 26). Develop on v24.20.0 and declare `engines.node` as `>=22` when creating `package.json`.
- **Reason** — Node.js v24.20.0 satisfies the supported-LTS requirement and is already installed.

- **Decision** — Store `Account.openingBalance` in integer centavos in the Phase 1 Dexie schema. Derive current balances from received income, paid expenses, and transfers between the user's accounts. Keep transfers out of income and expense totals. Record each Received or Paid transition once in `BudgetHistory` in the same transaction. Use only outstanding items in the LEFT cards, show monthly net separately, and divide LEFT THIS MONTH by the days remaining in the period or until the next expected sahod for the daily card. Cover each rule in Phase 5 unit tests.
- **Reason** — Deriving balances lets undo and deletion correct totals automatically. Using outstanding items for projections prevents received income and paid expenses already reflected in current balances from being counted twice.

### Phase 1 foundation

- **Toolchain** — Added `@tailwindcss/vite` for the official Tailwind CSS Vite integration, `@vitejs/plugin-react` for React transforms and Fast Refresh, `@types/react`, `@types/react-dom`, and `@types/node` for strict type checking, and `@eslint/js` for ESLint's recommended JavaScript rules. The manifest declares Node `>=22` as requested. Use an up-to-date patch of a supported LTS line because the pinned development dependencies have narrower engine ranges.
- **Contrast** — Darkened Strawberry Milk primary to `#B4375B` and muted text to `#74525F`. Completed Sakura Night's semantic palette with dark on-primary text. WCAG relative-luminance checks for used slots give minimum text, muted text, and primary button label ratios of 8.78:1, 6.11:1, and 5.77:1 in Strawberry Milk and 8.88:1, 7.80:1, and 8.23:1 in Sakura Night. Focus rings reach at least 4.79:1 and 5.48:1 against used surrounding backgrounds. Control outlines against the surface reach 4.61:1 and 4.89:1.
- **Backup** — Version 1 exports all tables, including snapshots. Snapshot contents exclude other snapshots to avoid recursive growth. Merge uses the imported copy when records match, and Replace requires typing `REPLACE`. Imports use a 10 MiB limit and run in one transaction. Storage persistence is checked on this device after import.
- **Scope** — Home, Calendar, Tasks, and Budget use empty states. Settings exposes Phase 1 controls. Dexie v1 contains the ten requested tables. Transfer storage and balance calculations are deferred to Phase 5.
