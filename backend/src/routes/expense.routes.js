import express from 'express';
import prisma from '../db/prisma.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { ExpenseService } from '../services/expense.service.js';

// Use mergeParams so we can read :groupId from the parent router mounting
const router = express.Router({ mergeParams: true });

// Get all expenses for a group
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const expenses = await prisma.expense.findMany({
      where: { groupId },
      include: {
        payer: {
          select: { id: true, name: true, email: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      },
      orderBy: { expenseDate: 'desc' }
    });

    res.json(expenses);
  } catch (error) {
    next(error);
  }
});

// Create Expense
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    
    // Create the expense using our service which contains validation and splits math
    const expense = await ExpenseService.createExpense(groupId, req.body, req.user.id);
    
    res.status(201).json(expense);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete Expense
router.delete('/:expenseId', authenticateToken, async (req, res, next) => {
  try {
    const { groupId, expenseId } = req.params;

    const exp = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { participants: true }
    });

    if (!exp) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    if (exp.groupId !== groupId) {
      return res.status(400).json({ error: 'Expense does not belong to this group.' });
    }

    await prisma.$transaction(async (tx) => {
      // Delete expense participants first due to cascade / foreign key constraints
      await tx.expenseParticipant.deleteMany({
        where: { expenseId }
      });

      // Delete the expense
      await tx.expense.delete({
        where: { id: expenseId }
      });

      // Log audit
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'DELETE_EXPENSE',
          entityType: 'EXPENSE',
          entityId: expenseId,
          oldValue: JSON.stringify(exp)
        }
      });
    });

    res.json({ message: 'Expense deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;
