# Tidyberrie decision log

## 2026-11-22

- **Decision** — Accept any supported Node.js LTS (22, 24, or 26). Develop on v24.20.0 and declare `engines.node` as `>=22` when creating `package.json`.
- **Reason** — Node.js v24.20.0 satisfies the supported-LTS requirement and is already installed.

- **Decision** — Store `Account.openingBalance` in integer centavos in the Phase 1 Dexie schema. Derive current balances from received income, paid expenses, and transfers between the user's accounts. Keep transfers out of income and expense totals. Record each Received or Paid transition once in `BudgetHistory` in the same transaction. Use only outstanding items in the LEFT cards, show monthly net separately, and divide LEFT THIS MONTH by the days remaining in the period or until the next expected sahod for the daily card. Cover each rule in Phase 5 unit tests.
- **Reason** — Deriving balances lets undo and deletion correct totals automatically. Using outstanding items for projections prevents received income and paid expenses already reflected in current balances from being counted twice.
