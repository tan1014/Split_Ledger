import prisma from '../db/prisma.js';
import { AnomalyService } from './anomaly.service.js';
import { ExpenseService } from './expense.service.js';
import { CurrencyService } from './currency.service.js';
import { parseCSV } from '../utils/csv.parser.js';

export class ImportService {
  /**
   * Step 1 & 2: Create Import Job, parse CSV, and detect anomalies.
   */
  static async uploadAndAnalyzeCSV(groupId, userId, fileName, rawText) {
    const parsedRows = parseCSV(rawText);

    // Create a database ImportJob record
    const job = await prisma.importJob.create({
      data: {
        groupId,
        uploadedById: userId,
        status: 'PENDING',
        fileName,
        rowCount: parsedRows.length
      }
    });

    // Run anomaly detection
    const anomalies = await AnomalyService.detectAnomalies(groupId, parsedRows);

    // Save detected anomalies to database
    for (const anom of anomalies) {
      await prisma.importAnomaly.create({
        data: {
          jobId: job.id,
          rowNumber: anom.rowNumber,
          anomalyType: anom.anomalyType,
          severity: anom.severity,
          description: anom.description,
          affectedRowsJson: anom.affectedRowsJson,
          recommendedAction: anom.recommendedAction,
          userDecision: 'PENDING'
        }
      });
    }

    return {
      jobId: job.id,
      rowCount: parsedRows.length,
      anomaliesFound: anomalies.length,
      parsedRows
    };
  }

  /**
   * Step 4 & 5: Resolve anomalies and apply imports.
   */
  static async resolveAndImport(jobId, decisions, executingUserId) {
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
      include: { group: true }
    });
    if (!job) throw new Error('Import job not found');
    if (job.status !== 'PENDING') throw new Error('Import job has already been processed');

    // 1. Update all decisions in db
    for (const d of decisions) {
      await prisma.importAnomaly.update({
        where: { id: d.anomalyId },
        data: {
          userDecision: d.decision, // e.g. APPROVE_FIX, IGNORE, SKIP, EDIT
          resolvedValueJson: d.resolvedValue ? JSON.stringify(d.resolvedValue) : null
        }
      });
    }

    // Fetch updated anomalies
    const anomalies = await prisma.importAnomaly.findMany({
      where: { jobId }
    });

    const anomaliesByRow = {};
    for (const anom of anomalies) {
      if (!anomaliesByRow[anom.rowNumber]) {
        anomaliesByRow[anom.rowNumber] = [];
      }
      anomaliesByRow[anom.rowNumber].push(anom);
    }

    // 2. Fetch all members of group to resolve participant usernames/emails to IDs
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId: job.groupId },
      include: { user: true }
    });

    const members = memberships.map(m => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt
    }));

    const findMemberId = (nameOrEmail) => {
      if (!nameOrEmail) return null;
      const clean = nameOrEmail.trim().toLowerCase();
      const match = members.find(m => 
        m.name.toLowerCase() === clean || 
        m.email.toLowerCase() === clean
      );
      return match ? match.userId : null;
    };

    // 3. Process every row in the import file
    // To reconstruct original parsed rows, we can retrieve them from the affectedRowsJson of anomalies,
    // or just re-read the CSV. But wait! We can fetch the raw CSV from anomalies or simply reconstruct from JSON.
    // Actually, each anomaly contains the full row data in affectedRowsJson. We can use that to rebuild the row data!
    // What if a row has NO anomalies?
    // Let's retrieve all rows. Since we saved all anomalies, let's look at how we parse the CSV.
    // In our design, we can reconstruct the parsed CSV from the anomalies or we can keep the parsed rows.
    // Wait, since we don't save the full CSV file in the database (which is fine), we can let the frontend send the full parsed rows back
    // along with decisions, OR we can fetch them. Sending the parsedRows with the resolution request is extremely clean, 
    // or we can reconstruct them. Let's make it so the caller passes the `parsedRows` array to the API in the body, 
    // or we can parse the `affectedRowsJson` from the anomalies. Let's reconstruct them from the anomalies where possible, 
    // but the most robust way is to pass `parsedRows` back from the client, or store the original rows in the `ImportJob`?
    // Yes! Let's reconstruct the rows from the anomalies or allow the frontend to pass the list of rows to import.
    // Wait, if a row had NO anomalies, it wouldn't have any `ImportAnomaly` entries! So it's best to have the client send back the parsed rows,
    // or store the parsed rows in the job under a field (but SQLite/PostgreSQL doesn't need to bloat).
    // Let's pass the original `parsedRows` in the POST request body of `/resolve`, which is very simple and guarantees we have the full data!
    // Yes! Let's define the payload to include: `{ decisions: [...], parsedRows: [...] }`.

    let rowsProcessed = 0;
    let rowsImported = 0;
    let rowsSkipped = 0;
    const actionsTaken = [];

    // Run inside database transaction
    await prisma.$transaction(async (tx) => {
      for (const row of decisions.parsedRows || []) {
        rowsProcessed++;
        const rowAnomalies = anomaliesByRow[row.rowNumber] || [];

        // Check if any anomaly for this row was skipped or unresolved
        let shouldSkip = false;
        let convertToPayment = false;
        let excludeParticipants = [];
        let manualPayerId = null;
        let manualExchangeRate = null;

        for (const anom of rowAnomalies) {
          if (anom.userDecision === 'SKIP') {
            shouldSkip = true;
          }
          if (anom.anomalyType === 'DUPLICATE_EXPENSE' && anom.userDecision === 'PENDING') {
            // Unresolved duplicates skip by default
            shouldSkip = true;
          }
          if (anom.anomalyType === 'SETTLEMENT_DISGUISED_AS_EXPENSE' && anom.userDecision === 'APPROVE_FIX') {
            convertToPayment = true;
          }
          if (anom.anomalyType === 'MEMBER_NOT_ACTIVE_ON_EXPENSE_DATE' && anom.userDecision === 'APPROVE_FIX') {
            // Extract the inactive member's name from description or raw data
            // We'll exclude the user who was inactive on the date.
            // Let's find which participant is inactive:
            const rowData = JSON.parse(anom.affectedRowsJson);
            const parts = rowData.participants.split(',');
            for (const part of parts) {
              const pName = part.split(':')[0].trim();
              const pMem = members.find(m => m.name.toLowerCase() === pName.toLowerCase());
              if (pMem) {
                const parsedDate = new Date(rowData.expenseDate);
                const active = parsedDate >= pMem.joinedAt && (!pMem.leftAt || parsedDate <= pMem.leftAt);
                if (!active) {
                  excludeParticipants.push(pMem.userId);
                }
              }
            }
          }
          if (anom.anomalyType === 'MISSING_PAYER') {
            if (anom.userDecision === 'EDIT' && anom.resolvedValueJson) {
              const resolvedVal = JSON.parse(anom.resolvedValueJson);
              manualPayerId = resolvedVal.payerId;
            } else if (anom.userDecision === 'APPROVE_FIX') {
              // Map to default admin (e.g. Aisha)
              const defaultAdmin = members.find(m => m.name.toLowerCase() === 'aisha') || members[0];
              manualPayerId = defaultAdmin.userId;
            }
          }
          if (anom.anomalyType === 'UNSUPPORTED_CURRENCY' && anom.userDecision === 'EDIT' && anom.resolvedValueJson) {
            const resolvedVal = JSON.parse(anom.resolvedValueJson);
            manualExchangeRate = parseFloat(resolvedVal.exchangeRate);
          }
        }

        if (shouldSkip) {
          rowsSkipped++;
          actionsTaken.push(`Row ${row.rowNumber} skipped by user decision.`);
          continue;
        }

        // Prepare row data
        const title = row.title;
        const amount = parseFloat(row.amount);
        const currency = row.currency.toUpperCase();
        const date = new Date(row.expenseDate);

        // Resolve Payer
        const payerId = manualPayerId || findMemberId(row.paidBy);
        if (!payerId) {
          rowsSkipped++;
          actionsTaken.push(`Row ${row.rowNumber} skipped: Payer could not be resolved.`);
          continue;
        }

        // Fetch / Use rate
        let rate = manualExchangeRate;
        if (rate === null) {
          rate = await CurrencyService.getExchangeRate(currency, date);
        }
        if (rate === null) {
          rowsSkipped++;
          actionsTaken.push(`Row ${row.rowNumber} skipped: Currency rate for "${currency}" is missing.`);
          continue;
        }

        const amountInr = Number((amount * rate).toFixed(2));

        if (convertToPayment) {
          // It's a settlement! It must have exactly 2 participants: the payer and the receiver.
          // Parse participants to find the receiver
          const partsList = row.participants.split(',').map(p => p.trim().split(':')[0]);
          const receiverName = partsList.find(p => p.toLowerCase() !== row.paidBy.toLowerCase());
          const receiverId = findMemberId(receiverName);

          if (!receiverId) {
            rowsSkipped++;
            actionsTaken.push(`Row ${row.rowNumber} skipped: Settlement receiver "${receiverName}" could not be resolved.`);
            continue;
          }

          // Create payment
          const payment = await tx.payment.create({
            data: {
              groupId: job.groupId,
              fromUserId: payerId, // The person who paid
              toUserId: receiverId, // The person who received it
              amount,
              currency,
              exchangeRate: rate,
              amountInr,
              paymentDate: date
            }
          });

          await tx.auditLog.create({
            data: {
              userId: executingUserId,
              action: 'IMPORT_PAYMENT',
              entityType: 'PAYMENT',
              entityId: payment.id,
              newValue: JSON.stringify(payment)
            }
          });

          rowsImported++;
          actionsTaken.push(`Row ${row.rowNumber} imported as Settlement Payment (₹${amountInr.toFixed(2)}) from ${row.paidBy} to ${receiverName}.`);
        } else {
          // Standard Expense
          // Parse participants
          const rawParticipants = row.participants.split(',').map(p => {
            const parts = p.trim().split(':');
            return {
              name: parts[0].trim(),
              value: parts[1] ? parseFloat(parts[1]) : null
            };
          });

          // Filter out excluded participants (active date check)
          const filteredParts = rawParticipants.filter(p => {
            const pId = findMemberId(p.name);
            return pId && !excludeParticipants.includes(pId);
          });

          const participantList = filteredParts.map(p => ({
            userId: findMemberId(p.name),
            value: p.value
          }));

          if (participantList.length === 0) {
            rowsSkipped++;
            actionsTaken.push(`Row ${row.rowNumber} skipped: No active participants on date.`);
            continue;
          }

          // Compute splits
          const splits = ExpenseService.calculateSplits(amount, row.splitType, participantList, rate);

          // Create expense
          const exp = await tx.expense.create({
            data: {
              groupId: job.groupId,
              title,
              amount,
              currency,
              exchangeRate: rate,
              amountInr,
              paidById: payerId,
              splitType: row.splitType.toUpperCase(),
              expenseDate: date,
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

          await tx.auditLog.create({
            data: {
              userId: executingUserId,
              action: 'IMPORT_EXPENSE',
              entityType: 'EXPENSE',
              entityId: exp.id,
              newValue: JSON.stringify({ exp, splits })
            }
          });

          rowsImported++;
          actionsTaken.push(`Row ${row.rowNumber} imported as Expense "${title}" (₹${amountInr.toFixed(2)}).`);
        }
      }

      // 4. Mark job as COMPLETED
      await tx.importJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED' }
      });
    });

    return {
      jobId,
      rowsProcessed,
      rowsImported,
      rowsSkipped,
      actionsTaken
    };
  }
}
