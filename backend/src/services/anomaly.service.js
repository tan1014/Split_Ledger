import prisma from '../db/prisma.js';
import { CurrencyService } from './currency.service.js';

export class AnomalyService {
  /**
   * Run anomaly detection on parsed CSV rows.
   */
  static async detectAnomalies(groupId, parsedRows) {
    const anomalies = [];

    // 1. Fetch group members and their active ranges
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId },
      include: { user: true }
    });

    const members = memberships.map(m => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt
    }));

    // Helper to find a user by name or email in members
    const findMember = (identifier) => {
      if (!identifier) return null;
      const clean = identifier.trim().toLowerCase();
      return members.find(m => 
        m.name.toLowerCase() === clean || 
        m.email.toLowerCase() === clean
      );
    };

    // 2. Fetch existing expenses in group for duplicate checks
    const existingExpenses = await prisma.expense.findMany({
      where: { groupId },
      include: { payer: true }
    });

    // Cache of exchange rates to avoid redundant DB queries
    const exchangeRatesCache = {};

    const now = new Date();

    for (const row of parsedRows) {
      const { rowNumber, title, amount, currency, paidBy, expenseDate, splitType, participants, rawRowData } = row;
      const rowJson = JSON.stringify(row);

      // --- A. Negative / Zero Amount Check ---
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        anomalies.push({
          rowNumber,
          anomalyType: 'NEGATIVE_AMOUNT',
          severity: 'ERROR',
          description: `Row ${rowNumber}: Invalid amount "${amount}". Expense amount must be greater than zero.`,
          affectedRowsJson: rowJson,
          recommendedAction: 'EDIT_AMOUNT',
          userDecision: 'PENDING'
        });
        continue; // Heavy error, skip further evaluation of this row
      }

      // --- B. Date Checks ---
      const parsedDate = new Date(expenseDate);
      if (isNaN(parsedDate.getTime())) {
        anomalies.push({
          rowNumber,
          anomalyType: 'INVALID_DATE',
          severity: 'ERROR',
          description: `Row ${rowNumber}: Invalid date format "${expenseDate}". Expected YYYY-MM-DD.`,
          affectedRowsJson: rowJson,
          recommendedAction: 'EDIT_DATE',
          userDecision: 'PENDING'
        });
        continue;
      }

      if (parsedDate > now) {
        anomalies.push({
          rowNumber,
          anomalyType: 'FUTURE_DATE',
          severity: 'WARNING',
          description: `Row ${rowNumber}: Expense date "${expenseDate}" is in the future.`,
          affectedRowsJson: rowJson,
          recommendedAction: 'IGNORE',
          userDecision: 'PENDING'
        });
      }

      // --- C. Payer Checks ---
      const payer = findMember(paidBy);
      if (!payer) {
        anomalies.push({
          rowNumber,
          anomalyType: 'MISSING_PAYER',
          severity: 'ERROR',
          description: `Row ${rowNumber}: Payer "${paidBy}" not found in group members.`,
          affectedRowsJson: rowJson,
          recommendedAction: 'MAP_PAYER',
          userDecision: 'PENDING'
        });
      } else {
        // Payer membership timeline check (Sam's requirement)
        const activeOnDate = parsedDate >= payer.joinedAt && (!payer.leftAt || parsedDate <= payer.leftAt);
        if (!activeOnDate) {
          anomalies.push({
            rowNumber,
            anomalyType: 'PAYER_NOT_ACTIVE',
            severity: 'ERROR',
            description: `Row ${rowNumber}: Payer "${payer.name}" was not an active member on "${expenseDate}" (Joined: ${payer.joinedAt.toISOString().split('T')[0]}).`,
            affectedRowsJson: rowJson,
            recommendedAction: 'SHIFT_DATE_TO_JOIN',
            userDecision: 'PENDING'
          });
        }
      }

      // --- D. Currency Checks ---
      const curUpper = currency.toUpperCase();
      if (!exchangeRatesCache[curUpper]) {
        const rate = await CurrencyService.getExchangeRate(curUpper, parsedDate);
        exchangeRatesCache[curUpper] = rate;
      }

      if (exchangeRatesCache[curUpper] === null) {
        anomalies.push({
          rowNumber,
          anomalyType: 'UNSUPPORTED_CURRENCY',
          severity: 'ERROR',
          description: `Row ${rowNumber}: Unsupported currency or missing rate for "${currency}".`,
          affectedRowsJson: rowJson,
          recommendedAction: 'MANUAL_EXCHANGE_RATE',
          userDecision: 'PENDING'
        });
      }

      // --- E. Settlement Disguised as Expense Check ---
      const titleLower = title.toLowerCase();
      const isSettlementTitle = 
        titleLower.includes('settle') || 
        titleLower.includes('payment') || 
        titleLower.includes('refund') || 
        titleLower.includes('paid back') || 
        titleLower.includes('repay');
      
      const splitTypeUpper = splitType.toUpperCase();
      
      if (isSettlementTitle || splitTypeUpper === 'SETTLEMENT') {
        anomalies.push({
          rowNumber,
          anomalyType: 'SETTLEMENT_DISGUISED_AS_EXPENSE',
          severity: 'WARNING',
          description: `Row ${rowNumber}: Expense "${title}" looks like a debt settlement.`,
          affectedRowsJson: rowJson,
          recommendedAction: 'CONVERT_TO_SETTLEMENT',
          userDecision: 'PENDING'
        });
      }

      // --- F. Participant Checks and Membership active verification ---
      // Format of participants in CSV: e.g. "Aisha:30,Rohan:70" or "Aisha,Rohan,Priya"
      const participantItems = participants ? participants.split(',').map(p => p.trim()).filter(p => p !== '') : [];
      
      if (participantItems.length === 0) {
        anomalies.push({
          rowNumber,
          anomalyType: 'MALFORMED_SPLIT',
          severity: 'ERROR',
          description: `Row ${rowNumber}: No participants specified for expense.`,
          affectedRowsJson: rowJson,
          recommendedAction: 'EDIT_PARTICIPANTS',
          userDecision: 'PENDING'
        });
      } else {
        let hasMembershipAnomalies = false;
        let totalSplitValue = 0;
        const mappedParticipants = [];

        for (const partItem of participantItems) {
          const parts = partItem.split(':');
          const pName = parts[0].trim();
          const pVal = parts[1] ? parseFloat(parts[1]) : null;

          const pMember = findMember(pName);
          if (!pMember) {
            anomalies.push({
              rowNumber,
              anomalyType: 'MALFORMED_SPLIT',
              severity: 'ERROR',
              description: `Row ${rowNumber}: Participant "${pName}" not found in group members.`,
              affectedRowsJson: rowJson,
              recommendedAction: 'EDIT_PARTICIPANTS',
              userDecision: 'PENDING'
            });
            hasMembershipAnomalies = true;
            continue;
          }

          // Check membership date timeline (Sam requirement)
          const pActiveOnDate = parsedDate >= pMember.joinedAt && (!pMember.leftAt || parsedDate <= pMember.leftAt);
          if (!pActiveOnDate) {
            anomalies.push({
              rowNumber,
              anomalyType: 'MEMBER_NOT_ACTIVE_ON_EXPENSE_DATE',
              severity: 'ERROR',
              description: `Row ${rowNumber}: Participant "${pMember.name}" was not a member on "${expenseDate}" (Joined: ${pMember.joinedAt.toISOString().split('T')[0]}).`,
              affectedRowsJson: rowJson,
              recommendedAction: 'EXCLUDE_MEMBER_SPLIT',
              userDecision: 'PENDING'
            });
            hasMembershipAnomalies = true;
          }

          if (pVal !== null) {
            totalSplitValue += pVal;
          }
          mappedParticipants.push({ name: pMember.name, userId: pMember.userId, val: pVal });
        }

        // Split validation checks
        if (!hasMembershipAnomalies) {
          if (splitTypeUpper === 'PERCENTAGE' && totalSplitValue !== 100 && totalSplitValue > 0) {
            anomalies.push({
              rowNumber,
              anomalyType: 'IMPOSSIBLE_PERCENTAGES',
              severity: 'ERROR',
              description: `Row ${rowNumber}: Percentage split sum is ${totalSplitValue}%, must be 100%.`,
              affectedRowsJson: rowJson,
              recommendedAction: 'RESCALE_SPLIT',
              userDecision: 'PENDING'
            });
          } else if (splitTypeUpper === 'EXACT' && Math.abs(totalSplitValue - parsedAmount) > 0.05 && totalSplitValue > 0) {
            anomalies.push({
              rowNumber,
              anomalyType: 'MALFORMED_SPLIT',
              severity: 'ERROR',
              description: `Row ${rowNumber}: Exact amounts sum to ${totalSplitValue}, but expense amount is ${parsedAmount}.`,
              affectedRowsJson: rowJson,
              recommendedAction: 'RESCALE_SPLIT',
              userDecision: 'PENDING'
            });
          } else if (splitTypeUpper === 'SHARES' && totalSplitValue <= 0 && participantItems.some(item => item.includes(':'))) {
            anomalies.push({
              rowNumber,
              anomalyType: 'IMPOSSIBLE_SHARES',
              severity: 'ERROR',
              description: `Row ${rowNumber}: Shares split has invalid or missing shares values.`,
              affectedRowsJson: rowJson,
              recommendedAction: 'RESCALE_SPLIT',
              userDecision: 'PENDING'
            });
          }
        }
      }

      // --- G. Duplicate Check ---
      if (payer) {
        const dateString = parsedDate.toISOString().split('T')[0];
        const isDuplicate = existingExpenses.some(exp => 
          exp.title.toLowerCase() === title.toLowerCase() &&
          exp.amount.toString() === parsedAmount.toFixed(2) &&
          exp.paidById === payer.userId &&
          exp.expenseDate.toISOString().split('T')[0] === dateString
        );

        if (isDuplicate) {
          anomalies.push({
            rowNumber,
            anomalyType: 'DUPLICATE_EXPENSE',
            severity: 'WARNING',
            description: `Row ${rowNumber}: Expense "${title}" for amount ${parsedAmount} on ${dateString} is a duplicate.`,
            affectedRowsJson: rowJson,
            recommendedAction: 'SKIP',
            userDecision: 'PENDING'
          });
        }
      }
    }

    return anomalies;
  }
}
