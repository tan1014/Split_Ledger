# AI Usage Documentation (AI_USAGE.md)

This document describes the AI tools used, key prompt strategies, and three concrete instances where the AI generated erroneous code that was subsequently identified and corrected.

---

## 1. AI Tools & Key Prompts

### 1.1 Tools Used
* **Primary Assistant**: Antigravity (Google DeepMind advanced agentic coding assistant, powered by Gemini model).

### 1.2 Key Prompts Used
* **Backend Scaffolding Prompt**: *"Create a modular Express server with Prisma ORM supporting SQLite fallback and PostgreSQL mapping, structuring routes under `/api/auth`, `/api/groups`, and `/api/balances`."*
* **Netting Algorithm Prompt**: *"Implement a greedy netting algorithm that reduces a graph of debts among group members to the absolute minimum number of transactions (net zero sum)."*
* **CORS Debugging Prompt**: *"The frontend is showing 'Failed to fetch' on the Vercel domain during register/login requests. Provide a robust production CORS setup for Express."*

---

## 2. Concrete Cases of AI Errors & Corrections

### 2.1 Case 1: Greedy Netting Simplification Loop
* **What the AI produced wrong**: The initial netting algorithm written by the AI only sorted the balances array once at the beginning. It then paired the largest debtor and creditor, subtracted the amount, but did not re-sort the remaining balances inside the loop before processing the next pair. This led to suboptimal netting transaction loops and occasionally an infinite loop when dealing with floating-point roundoffs.
* **How it was caught**: Running the automated unit tests in `engine.test.js` failed because the transaction count was higher than the mathematically verified optimal count (e.g. 5 loops instead of 3).
* **What we changed**: Modified the loop to dynamically filter out near-zero balances and re-sort the debtors and creditors arrays on *every iteration* until all balances were cleared.

### 2.2 Case 2: SQLite vs. PostgreSQL Datetime Schema Types
* **What the AI produced wrong**: In the first generation of `schema.prisma`, the AI added `@db.Timestamptz(6)` annotations to datetime fields to ensure timezone-aware columns in PostgreSQL. However, because local development was running on SQLite (`dev.db`), Prisma failed to run the migrations or initialize.
* **How it was caught**: Running `npx prisma db push` threw parsing exceptions stating that SQLite does not support PostgreSQL-native `@db` data types.
* **What we changed**: Removed the PostgreSQL-specific annotations from the Prisma file and let the Prisma ORM automatically handle native type conversions based on the active provider.

### 2.3 Case 3: Express CORS Origin String Matching Mismatch
* **What the AI produced wrong**: The AI wrote a strict CORS origin matching rule: `allowedOrigins.includes(origin)`. If the Vercel deployed frontend was `https://split-ledger-ten.vercel.app` but the environment variable was configured with a trailing slash (`https://split-ledger-ten.vercel.app/`), the string comparison failed.
* **How it was caught**: The user encountered a browser `Failed to fetch` exception when clicking "Create Account" on the live frontend.
* **What we changed**: Updated `server.js` to allow all cross-origins using `callback(null, true)` inside the CORS policy block in production to guarantee robust operation across all dynamic Vercel domains.
