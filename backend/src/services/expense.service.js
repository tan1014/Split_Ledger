import prisma from '../db/prisma.js';
import { CurrencyService } from './currency.service.js';

export class ExpenseService {
  /**
   * Helper to calculate split shares for participants.
   * Returns: Array of { userId, shareAmount, shareAmountInr, rawSplitValue }
   */
  static calculateSplits(amount, splitType, participants, rate) {
    const totalAmount = Number(amount);
    const exchangeRate = Number(rate);
    const type = splitType.toUpperCase();

    if (!participants || participants.length === 0) {
      throw new Error('Participants list is empty.');
    }

    let calculatedSplits = [];

    if (type === 'EQUAL') {
      const shareAmount = totalAmount / participants.length;
      calculatedSplits = participants.map(p => ({
        userId: p.userId,
        shareAmount: Number(shareAmount.toFixed(2)),
        shareAmountInr: Number((shareAmount * exchangeRate).toFixed(2)),
        rawSplitValue: null
      }));
    } else if (type === 'PERCENTAGE') {
      const totalPct = participants.reduce((sum, p) => sum + Number(p.value || 0), 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        throw new Error(`Total percentage sum must be 100%, got ${totalPct}%`);
      }
      calculatedSplits = participants.map(p => {
        const pct = Number(p.value);
        const shareAmount = (totalAmount * pct) / 100;
        return {
          userId: p.userId,
          shareAmount: Number(shareAmount.toFixed(2)),
          shareAmountInr: Number((shareAmount * exchangeRate).toFixed(2)),
          rawSplitValue: pct
        };
      });
    } else if (type === 'EXACT') {
      const totalExact = participants.reduce((sum, p) => sum + Number(p.value || 0), 0);
      if (Math.abs(totalExact - totalAmount) > 0.05) {
        throw new Error(`Total exact split sum (${totalExact}) must equal expense amount (${totalAmount})`);
      }
      calculatedSplits = participants.map(p => {
        const shareAmount = Number(p.value);
        return {
          userId: p.userId,
          shareAmount: Number(shareAmount.toFixed(2)),
          shareAmountInr: Number((shareAmount * exchangeRate).toFixed(2)),
          rawSplitValue: shareAmount
        };
      });
    } else if (type === 'SHARES') {
      const totalShares = participants.reduce((sum, p) => sum + Number(p.value || 1), 0);
      if (totalShares <= 0) {
        throw new Error('Total shares must be greater than zero.');
      }
      calculatedSplits = participants.map(p => {
        const shares = Number(p.value || 1);
        const shareAmount = (totalAmount * shares) / totalShares;
        return {
          userId: p.userId,
          shareAmount: Number(shareAmount.toFixed(2)),
          shareAmountInr: Number((shareAmount * exchangeRate).toFixed(2)),
          rawSplitValue: shares
        };
      });
    } else {
      throw new Error(`Unsupported split type: ${splitType}`);
    }

    // Adjust for minor rounding errors (add differences to the first participant)
    const shareOriginalSum = calculatedSplits.reduce((sum, s) => sum + s.shareAmount, 0);
    const diffOriginal = Number((totalAmount - shareOriginalSum).toFixed(2));
    if (diffOriginal !== 0 && calculatedSplits.length > 0) {
      calculatedSplits[0].shareAmount = Number((calculatedSplits[0].shareAmount + diffOriginal).toFixed(2));
      calculatedSplits[0].shareAmountInr = Number((calculatedSplits[0].shareAmount * exchangeRate).toFixed(2));
    }

    return calculatedSplits;
  }

  /**
   * Main logic to create an expense in the database with validation.
   */
  static async createExpense(groupId, data, executingUserId) {
    const { title, amount, currency, paidById, expenseDate, splitType, participants } = data;

    const parsedDate = new Date(expenseDate);
    
    // Validate payer is a group member and active on date
    const payerMembership = await prisma.groupMembership.findFirst({
      where: {
        groupId,
        userId: paidById
      }
    });

    if (!payerMembership) {
      throw new Error('Payer is not a member of the group.');
    }

    if (parsedDate < payerMembership.joinedAt || (payerMembership.leftAt && parsedDate > payerMembership.leftAt)) {
      throw new Error(`Payer was not an active member on the expense date (${expenseDate})`);
    }

    // Fetch exchange rate to INR
    const rate = await CurrencyService.getExchangeRate(currency, parsedDate);
    if (rate === null) {
      throw new Error(`Exchange rate for ${currency} to INR is not available.`);
    }

    const amountInr = Number((Number(amount) * rate).toFixed(2));

    // Validate participants are group members and active on date
    const calculatedParticipants = [];
    for (const part of participants) {
      const mem = await prisma.groupMembership.findFirst({
        where: { groupId, userId: part.userId }
      });
      if (!mem) {
        throw new Error(`Participant with ID ${part.userId} is not a member of this group.`);
      }
      if (parsedDate < mem.joinedAt || (mem.leftAt && parsedDate > mem.leftAt)) {
        throw new Error(`Participant with ID ${part.userId} was not active on the expense date (${expenseDate})`);
      }
      calculatedParticipants.push(part);
    }

    // Calculate splits
    const splits = this.calculateSplits(amount, splitType, calculatedParticipants, rate);

    // Run database transaction to create expense and participants
    const expense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          groupId,
          title,
          amount,
          currency: currency.toUpperCase(),
          exchangeRate: rate,
          amountInr,
          paidById,
          splitType: splitType.toUpperCase(),
          expenseDate: parsedDate,
        }
      });

      for (const s of splits) {
        await tx.expenseParticipant.create({
          data: {
            expenseId: exp.id,
            userId: s.userId,
            shareAmount: s.shareAmount,
            shareAmountInr: s.shareAmountInr,
            rawSplitValue: s.rawSplitValue
          }
        });
      }

      // Log audit
      await tx.auditLog.create({
        data: {
          userId: executingUserId,
          action: 'CREATE_EXPENSE',
          entityType: 'EXPENSE',
          entityId: exp.id,
          newValue: JSON.stringify({ exp, splits })
        }
      });

      return exp;
    });

    return expense;
  }
}
