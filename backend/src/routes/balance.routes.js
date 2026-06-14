import express from 'express';
import prisma from '../db/prisma.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { BalanceService } from '../services/balance.service.js';
import { CurrencyService } from '../services/currency.service.js';

const router = express.Router({ mergeParams: true });

// Get group balances and simplified settlements (Aisha requirement)
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const result = await BalanceService.getGroupBalancesAndSettlements(groupId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Explain a specific user's balance in detail (Rohan requirement)
router.get('/explain/:userId', authenticateToken, async (req, res, next) => {
  try {
    const { groupId, userId } = req.params;
    const explanation = await BalanceService.getBalanceExplanation(groupId, userId);
    res.json(explanation);
  } catch (error) {
    next(error);
  }
});

// Create / Log a settlement payment (Debt settlement tracking)
router.post('/settle', authenticateToken, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { fromUserId, toUserId, amount, currency, paymentDate } = req.body;

    if (!fromUserId || !toUserId || !amount) {
      return res.status(400).json({ error: 'Sender (fromUserId), receiver (toUserId), and amount are required.' });
    }

    const parsedDate = paymentDate ? new Date(paymentDate) : new Date();

    // Verify both are group members
    const senderMem = await prisma.groupMembership.findFirst({ where: { groupId, userId: fromUserId } });
    const receiverMem = await prisma.groupMembership.findFirst({ where: { groupId, userId: toUserId } });

    if (!senderMem || !receiverMem) {
      return res.status(400).json({ error: 'Both payment sender and receiver must be members of the group.' });
    }

    const payCurrency = currency ? currency.toUpperCase() : 'INR';
    const rate = await CurrencyService.getExchangeRate(payCurrency, parsedDate);

    if (rate === null) {
      return res.status(400).json({ error: `Exchange rate for currency ${payCurrency} is not available.` });
    }

    const amountInr = Number((Number(amount) * rate).toFixed(2));

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          groupId,
          fromUserId,
          toUserId,
          amount,
          currency: payCurrency,
          exchangeRate: rate,
          amountInr,
          paymentDate: parsedDate
        },
        include: {
          sender: { select: { id: true, name: true } },
          receiver: { select: { id: true, name: true } }
        }
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'RECORD_SETTLEMENT',
          entityType: 'PAYMENT',
          entityId: p.id,
          newValue: JSON.stringify(p)
        }
      });

      return p;
    });

    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
});

export default router;
