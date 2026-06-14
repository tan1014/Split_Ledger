import express from 'express';
import prisma from '../db/prisma.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// List all exchange rates in DB
router.get('/rates', authenticateToken, async (req, res, next) => {
  try {
    const rates = await prisma.exchangeRate.findMany({
      orderBy: { effectiveDate: 'desc' }
    });
    res.json(rates);
  } catch (error) {
    next(error);
  }
});

// List all system audit logs for compliance auditing
router.get('/logs', authenticateToken, async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50 // cap at latest 50 logs for readability
    });
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

export default router;
