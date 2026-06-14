import prisma from '../db/prisma.js';

export class BalanceService {
  /**
   * Calculates current net balances and optimized settlements for a group.
   */
  static async getGroupBalancesAndSettlements(groupId) {
    // 1. Fetch group members
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId },
      include: { user: true },
    });

    const members = memberships.map(m => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt,
    }));

    const memberMap = new Map(members.map(m => [m.id, m]));

    // Initialize balance sheet
    const balances = {};
    for (const member of members) {
      balances[member.id] = {
        userId: member.id,
        name: member.name,
        email: member.email,
        totalPaid: 0,
        totalOwed: 0,
        netBalance: 0,
      };
    }

    // 2. Fetch all expenses in the group
    const expenses = await prisma.expense.findMany({
      where: { groupId },
      include: {
        payer: true,
        participants: {
          include: { user: true }
        }
      }
    });

    // Process expenses
    for (const exp of expenses) {
      const amountInr = Number(exp.amountInr);
      const payerId = exp.paidById;

      // Credit payer (only if payer is currently in balances, e.g. group member)
      if (balances[payerId]) {
        balances[payerId].totalPaid += amountInr;
      }

      // Debit participants
      for (const part of exp.participants) {
        const participantId = part.userId;
        const shareInr = Number(part.shareAmountInr);
        if (balances[participantId]) {
          balances[participantId].totalOwed += shareInr;
        }
      }
    }

    // 3. Fetch all payments (settlements) in the group
    const payments = await prisma.payment.findMany({
      where: { groupId },
      include: {
        sender: true,
        receiver: true
      }
    });

    // Process payments
    for (const pay of payments) {
      const amountInr = Number(pay.amountInr);
      const senderId = pay.fromUserId;
      const receiverId = pay.toUserId;

      if (balances[senderId]) {
        balances[senderId].totalPaid += amountInr; // Sender paid out, reducing debt / increasing credit
      }
      if (balances[receiverId]) {
        balances[receiverId].totalOwed += amountInr; // Receiver got money, reducing credit / increasing debt
      }
    }

    // Calculate Net Balance for each user
    for (const id in balances) {
      const b = balances[id];
      b.netBalance = Number((b.totalPaid - b.totalOwed).toFixed(2));
    }

    // 4. Run Settlement Simplification (Greedy Netting Graph)
    const optimizedSettlements = this.simplifyDebts(Object.values(balances));

    return {
      balances: Object.values(balances),
      optimizedSettlements
    };
  }

  /**
   * Greedy debt netting algorithm
   */
  static simplifyDebts(userBalances) {
    // Filter users with non-zero balances (threshold 0.01)
    const debtors = [];
    const creditors = [];

    for (const ub of userBalances) {
      const bal = ub.netBalance;
      if (bal < -0.01) {
        debtors.push({ userId: ub.userId, name: ub.name, balance: bal });
      } else if (bal > 0.01) {
        creditors.push({ userId: ub.userId, name: ub.name, balance: bal });
      }
    }

    // Sort debtors ascending (most negative first)
    debtors.sort((a, b) => a.balance - b.balance);
    // Sort creditors descending (most positive first)
    creditors.sort((a, b) => b.balance - a.balance);

    const settlements = [];

    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const debtAmount = -debtor.balance;
      const creditAmount = creditor.balance;
      const settleAmount = Number(Math.min(debtAmount, creditAmount).toFixed(2));

      if (settleAmount > 0) {
        settlements.push({
          fromUserId: debtor.userId,
          fromUserName: debtor.name,
          toUserId: creditor.userId,
          toUserName: creditor.name,
          amount: settleAmount,
          currency: 'INR'
        });
      }

      debtor.balance += settleAmount;
      creditor.balance -= settleAmount;

      if (Math.abs(debtor.balance) < 0.01) {
        i++;
      }
      if (Math.abs(creditor.balance) < 0.01) {
        j++;
      }
    }

    return settlements;
  }

  /**
   * Returns a thorough explainability report for a user's balance.
   */
  static async getBalanceExplanation(groupId, userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user) throw new Error('User not found');

    // Fetch memberships to prove they were active on expense dates (Sam requirement)
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId, userId }
    });

    // Fetch all expenses in group where user is payer OR participant
    const paidExpenses = await prisma.expense.findMany({
      where: { groupId, paidById: userId },
      include: { payer: true, participants: { include: { user: true } } },
      orderBy: { expenseDate: 'asc' }
    });

    const participatedExpenses = await prisma.expense.findMany({
      where: {
        groupId,
        participants: { some: { userId } }
      },
      include: { payer: true, participants: { include: { user: true } } },
      orderBy: { expenseDate: 'asc' }
    });

    // Fetch payments sent
    const sentPayments = await prisma.payment.findMany({
      where: { groupId, fromUserId: userId },
      include: { receiver: true },
      orderBy: { paymentDate: 'asc' }
    });

    // Fetch payments received
    const receivedPayments = await prisma.payment.findMany({
      where: { groupId, toUserId: userId },
      include: { sender: true },
      orderBy: { paymentDate: 'asc' }
    });

    // Compile explanation components
    const paidItems = paidExpenses.map(exp => {
      // Find own share
      const ownPart = exp.participants.find(p => p.userId === userId);
      const ownShareInr = ownPart ? Number(ownPart.shareAmountInr) : 0;
      return {
        expenseId: exp.id,
        title: exp.title,
        date: exp.expenseDate,
        splitType: exp.splitType,
        originalAmount: Number(exp.amount),
        currency: exp.currency,
        exchangeRate: Number(exp.exchangeRate),
        amountInr: Number(exp.amountInr),
        ownShareInr,
        creditInr: Number(exp.amountInr) // User paid this whole expense
      };
    });

    const participatedItems = participatedExpenses.map(exp => {
      const part = exp.participants.find(p => p.userId === userId);
      return {
        expenseId: exp.id,
        title: exp.title,
        date: exp.expenseDate,
        splitType: exp.splitType,
        paidBy: exp.payer.name,
        originalAmount: Number(exp.amount),
        currency: exp.currency,
        exchangeRate: Number(exp.exchangeRate),
        amountInr: Number(exp.amountInr),
        shareAmount: Number(part.shareAmount),
        shareAmountInr: Number(part.shareAmountInr),
        rawSplitValue: part.rawSplitValue ? Number(part.rawSplitValue) : null,
        debitInr: Number(part.shareAmountInr) // User owes this share
      };
    });

    const sentPaymentItems = sentPayments.map(p => ({
      paymentId: p.id,
      toUser: p.receiver.name,
      date: p.paymentDate,
      originalAmount: Number(p.amount),
      currency: p.currency,
      exchangeRate: Number(p.exchangeRate),
      amountInr: Number(p.amountInr),
      creditInr: Number(p.amountInr) // Sent money increases credit
    }));

    const receivedPaymentItems = receivedPayments.map(p => ({
      paymentId: p.id,
      fromUser: p.sender.name,
      date: p.paymentDate,
      originalAmount: Number(p.amount),
      currency: p.currency,
      exchangeRate: Number(p.exchangeRate),
      amountInr: Number(p.amountInr),
      debitInr: Number(p.amountInr) // Received money decreases credit
    }));

    // Math aggregations
    const totalExpensePaidInr = paidItems.reduce((sum, item) => sum + item.creditInr, 0);
    const totalPaymentsSentInr = sentPaymentItems.reduce((sum, item) => sum + item.creditInr, 0);
    const totalPaidInr = totalExpensePaidInr + totalPaymentsSentInr;

    const totalExpenseOwedInr = participatedItems.reduce((sum, item) => sum + item.debitInr, 0);
    const totalPaymentsReceivedInr = receivedPaymentItems.reduce((sum, item) => sum + item.debitInr, 0);
    const totalOwedInr = totalExpenseOwedInr + totalPaymentsReceivedInr;

    const netBalance = Number((totalPaidInr - totalOwedInr).toFixed(2));

    return {
      userId,
      userName: user.name,
      membershipHistory: memberships.map(m => ({ joinedAt: m.joinedAt, leftAt: m.leftAt })),
      breakdown: {
        paidExpenses: paidItems,
        participatedExpenses: participatedItems,
        sentPayments: sentPaymentItems,
        receivedPayments: receivedPaymentItems
      },
      summary: {
        totalExpensePaidInr,
        totalPaymentsSentInr,
        totalPaidInr,
        totalExpenseOwedInr,
        totalPaymentsReceivedInr,
        totalOwedInr,
        netBalance
      },
      explanationText: `Net Balance = (Total Expenses Paid [₹${totalExpensePaidInr.toFixed(2)}] + Total Settlements Sent [₹${totalPaymentsSentInr.toFixed(2)}]) - (Total Expense Share [₹${totalExpenseOwedInr.toFixed(2)}] + Total Settlements Received [₹${totalPaymentsReceivedInr.toFixed(2)}]) = ₹${netBalance.toFixed(2)}`
    };
  }
}
