import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Route imports
import authRouter from './routes/auth.routes.js';
import groupRouter from './routes/group.routes.js';
import expenseRouter from './routes/expense.routes.js';
import balanceRouter from './routes/balance.routes.js';
import importRouter from './routes/import.routes.js';
import auditRouter from './routes/audit.routes.js';

// Middleware imports
import { errorHandler } from './middleware/error.middleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS: Allow local dev and the deployed Vercel frontend
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL || 'https://split-ledger.vercel.app']
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins to prevent CORS errors with Vercel domains/previews
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Standard healthcheck route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/groups', groupRouter);
app.use('/api/audit', auditRouter);

// Nested group resources
app.use('/api/groups/:groupId/expenses', expenseRouter);
app.use('/api/groups/:groupId/balances', balanceRouter);
app.use('/api/groups/:groupId/import', importRouter);

// Global Error Handler (Must be mounted last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`[SERVER RUNNING]: Server is listening on http://localhost:${PORT}`);
});
