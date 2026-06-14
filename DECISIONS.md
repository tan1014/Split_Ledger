# Architectural & Design Decisions (DECISIONS.md)

This document records the architectural decisions, database index optimizations, and SQL DDL schemas for the Shared Expense Management system.

---

## 1. Key Design Decisions

### 1.1 Double-Entry Ledger Pattern for Explainability (Rohan & Priya)
To satisfy Rohan's explainability requirement, we implemented a logical double-entry ledger database style. 
* Every expense logs a credit to the payer (increased balance) and debits to all participants matching the split details (decreased balance).
* Every settlement logs a credit to the sender and a debit to the receiver.
* Converting all amounts to INR using exchange rates at the moment of the expense transaction ensures consistent netting totals, while original amounts and rates are preserved in the DB to make all conversions traceable.

### 1.2 Local SQLite Fallback with PostgreSQL Swappability
* PostgreSQL is the production target. However, since no PostgreSQL service was running locally in the development workspace, we configured Prisma to use `sqlite` with a local `dev.db` database. 
* To swap to PostgreSQL in production, only the `datasource db` block in [schema.prisma](file:///c:/Users/hp/OneDrive/Desktop/hello/backend/prisma/schema.prisma#L1-L4) needs to be updated:
  ```prisma
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }
  ```
  And specify the connection URL inside the `.env` configuration file.

### 1.3 Client-Side CSV Reading
* To prevent Express backend server upload limits and multi-part boundary stream crashes, the React client reads the selected `.csv` spreadsheet locally using a `FileReader` API as a raw string text, and sends it to the API in the body of a JSON request. This is extremely robust and avoids file-system lockups on Windows hosts.

### 1.4 Native Node.js Testing Runner
* We used Node's built-in test runner (`node --test`) and assertion library (`node:assert`). This eliminates Node/npm bundler version conflicts (like Babel/Jest configs) on Windows and guarantees tests run in milliseconds.

---

## 2. PostgreSQL DDL Schema & Indexes

Below is the normalized relational schema SQL script matching our Prisma designs.

```sql
-- Create Users Table
CREATE TABLE "users" (
    "id" VARCHAR(36) PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Groups Table
CREATE TABLE "groups" (
    "id" VARCHAR(36) PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Group Memberships Table (Timeline history tracking)
CREATE TABLE "group_memberships" (
    "id" VARCHAR(36) PRIMARY KEY,
    "group_id" VARCHAR(36) NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
    "user_id" VARCHAR(36) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "left_at" TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_group_user_joined UNIQUE ("group_id", "user_id", "joined_at")
);

-- Create Expenses Table
CREATE TABLE "expenses" (
    "id" VARCHAR(36) PRIMARY KEY,
    "group_id" VARCHAR(36) NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
    "title" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(12, 2) NOT NULL,
    "currency" VARCHAR(5) DEFAULT 'INR' NOT NULL,
    "exchange_rate" DECIMAL(12, 6) NOT NULL,
    "amount_inr" DECIMAL(12, 2) NOT NULL,
    "paid_by_id" VARCHAR(36) NOT NULL REFERENCES "users"("id"),
    "split_type" VARCHAR(20) NOT NULL, -- EQUAL, PERCENTAGE, EXACT, SHARES, SETTLEMENT
    "expense_date" TIMESTAMP WITH TIME ZONE NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Expense Participants Table (Splits shares)
CREATE TABLE "expense_participants" (
    "id" VARCHAR(36) PRIMARY KEY,
    "expense_id" VARCHAR(36) NOT NULL REFERENCES "expenses"("id") ON DELETE CASCADE,
    "user_id" VARCHAR(36) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "share_amount" DECIMAL(12, 2) NOT NULL,
    "share_amount_inr" DECIMAL(12, 2) NOT NULL,
    "raw_split_value" DECIMAL(12, 2),
    CONSTRAINT uq_expense_user UNIQUE ("expense_id", "user_id")
);

-- Create Payments Table (Settlements tracking)
CREATE TABLE "payments" (
    "id" VARCHAR(36) PRIMARY KEY,
    "group_id" VARCHAR(36) NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
    "from_user_id" VARCHAR(36) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "to_user_id" VARCHAR(36) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "amount" DECIMAL(12, 2) NOT NULL,
    "currency" VARCHAR(5) DEFAULT 'INR' NOT NULL,
    "exchange_rate" DECIMAL(12, 6) NOT NULL,
    "amount_inr" DECIMAL(12, 2) NOT NULL,
    "payment_date" TIMESTAMP WITH TIME ZONE NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Exchange Rates Table
CREATE TABLE "exchange_rates" (
    "id" VARCHAR(36) PRIMARY KEY,
    "from_currency" VARCHAR(5) NOT NULL,
    "to_currency" VARCHAR(5) NOT NULL,
    "rate" DECIMAL(12, 6) NOT NULL,
    "effective_date" TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_currency_rate_date UNIQUE ("from_currency", "to_currency", "effective_date")
);

-- Indexes for Fast Sorting, Range Lookups & Netting Computations
CREATE INDEX idx_expenses_group_date ON expenses (group_id, expense_date);
CREATE INDEX idx_payments_group_date ON payments (group_id, payment_date);
CREATE INDEX idx_group_memberships_dates ON group_memberships (group_id, joined_at, left_at);
CREATE INDEX idx_exchange_rates_currency_date ON exchange_rates (from_currency, to_currency, effective_date);
```
