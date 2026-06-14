# Shared Expense Management Application

A production-grade, relational-database-driven Shared Expense Management system built with **Node.js, Express, Prisma ORM, and React (Vite)**, utilizing a premium custom dark Vanilla CSS design. It helps flatmates track shared expenses, imports CSV statements safely with anomaly checking, and optimizes settling debts using a netting algorithm.

---

## Repository Structure

```
hello/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # SQLite database definition (configured for postgres mapping)
│   │   └── seed.js              # Database seed script for test accounts (Aisha, Rohan, etc.)
│   ├── src/
│   │   ├── controllers/         # Express API controllers
│   │   ├── middleware/          # Security and error catching middlewares
│   │   ├── routes/              # Express REST routing endpoints
│   │   ├── services/            # Core business engines (Balance, CSV Importer, Anomalies)
│   │   ├── utils/               # Safe CSV parsing utility
│   │   ├── tests/               # Automated unit/integration test runner
│   │   └── server.js            # Express application entrypoint
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable React components
│   │   ├── pages/               # Application view modules (Dashboard, Balances, etc.)
│   │   ├── utils/               # Fetch API client
│   │   ├── App.jsx              # Routing configurations
│   │   ├── index.css            # Vanilla CSS tokens and styles
│   │   └── main.jsx             # React entrypoint
│   ├── package.json
│   └── vite.config.js
├── SCOPE.md                     # Traceability matrix mapping requirements to code
├── DECISIONS.md                 # Technical design justifications
└── AI_USAGE.md                  # Development support logs
```

---

## Installation & Local Setup

Ensure you have **Node.js v20+** and **npm** installed.

### 1. Database Setup & Seeding (Backend)
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Initialize the local database:
   ```bash
   npx prisma db push
   ```
4. Seed the database with the required mock users (**Aisha, Rohan, Priya, Meera, Dev, Sam**) and initial currency conversion indices:
   ```bash
   npm run db:seed
   ```
5. Run the automated business logic test suite:
   ```bash
   npm test
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build production assets (optional):
   ```bash
   npm run build
   ```

---

## Starting Development Servers

To run the application locally, you will start the API backend and the React frontend.

1. **Start Backend Server** (Port `5000`):
   ```bash
   cd backend
   ```
   ```bash
   npm run dev
   ```
2. **Start Frontend Server** (Port `5173`):
   ```bash
   cd frontend
   ```
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to `http://localhost:5173`.
4. Log in with any of the seeded accounts using their email and the default password:
   * **Aisha**: `aisha@example.com`
   * **Rohan**: `rohan@example.com`
   * **Priya**: `priya@example.com`
   * **Meera**: `meera@example.com`
   * **Dev**: `dev@example.com`
   * **Sam**: `sam@example.com`
   * **Password**: `password`
