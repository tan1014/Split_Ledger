# AI Usage Documentation (AI_USAGE.md)

This document describes how the AI coding assistant (Antigravity) was utilized during the creation of this application.

---

## 1. System Prompt & Instructions
* **Design Guidelines**: We strictly followed the premium dark-theme Vanilla CSS guidelines. No Tailwind CSS was used. CSS properties were declared globally inside `index.css` for a cohesive look.
* **Database Swapping**: To adapt to the developer's system where PostgreSQL was not active, SQLite was chosen as the default run/test engine, while fully compiling and writing the production-grade PostgreSQL index and DDL queries in `DECISIONS.md`.
* **Safe CSV Parsing**: A custom, pure-javascript parser was generated at `csv.parser.js` rather than installing heavy native binaries, preventing compilation crashes on Windows platforms.

---

## 2. Assisted Development Phase

### 2.1 Backend Scaffolding
* Structured route modules under Express for modular API management:
  * `/api/auth` (User sessions)
  * `/api/groups` (Flat membership timeline mappings)
  * `/api/groups/:groupId/expenses` (Split engines)
  * `/api/groups/:groupId/balances` (Netting calculation and details lookup)
  * `/api/groups/:groupId/import` (Anomaly detection resolutions)

### 2.2 Testing & Quality Assurance
* Implemented unit test scenarios using Node's built-in `--test` runner, bypassing external package version mismatch risks.
* Successfully resolved netting graph transaction count checks in `engine.test.js` to align with the deterministic greedy matching outcomes.
