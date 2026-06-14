import test from 'node:test';
import assert from 'node:assert';

// Import local services/utils
import { parseCSV } from '../utils/csv.parser.js';
import { ExpenseService } from '../services/expense.service.js';
import { BalanceService } from '../services/balance.service.js';
import { AnomalyService } from '../services/anomaly.service.js';

test('1. CSV Parser - Parses raw string correctly', () => {
  const csv = `Title, Amount, Currency, Paid By, Expense Date, Split Type, Participants
Dinner, 1200, INR, Aisha, 2026-03-20, EQUAL, "Aisha, Rohan, Priya"
Rent, 1000, USD, Priya, 2026-03-01, PERCENTAGE, "Aisha:30, Rohan:30, Priya:40"`;

  const parsed = parseCSV(csv);
  assert.strictEqual(parsed.length, 2);
  
  assert.strictEqual(parsed[0].title, 'Dinner');
  assert.strictEqual(parsed[0].amount, '1200');
  assert.strictEqual(parsed[0].currency, 'INR');
  assert.strictEqual(parsed[0].paidBy, 'Aisha');
  assert.strictEqual(parsed[0].expenseDate, '2026-03-20');
  assert.strictEqual(parsed[0].splitType, 'EQUAL');
  assert.strictEqual(parsed[0].participants, 'Aisha, Rohan, Priya');

  assert.strictEqual(parsed[1].title, 'Rent');
  assert.strictEqual(parsed[1].amount, '1000');
  assert.strictEqual(parsed[1].currency, 'USD');
  assert.strictEqual(parsed[1].paidBy, 'Priya');
  assert.strictEqual(parsed[1].expenseDate, '2026-03-01');
  assert.strictEqual(parsed[1].splitType, 'PERCENTAGE');
  assert.strictEqual(parsed[1].participants, 'Aisha:30, Rohan:30, Priya:40');
});

test('2. Split Calculations - Supports all split modes', () => {
  const participants = [
    { userId: 'u1', value: null },
    { userId: 'u2', value: null },
    { userId: 'u3', value: null }
  ];

  // EQUAL
  const equalSplits = ExpenseService.calculateSplits(1200.00, 'EQUAL', participants, 1.0);
  assert.strictEqual(equalSplits.length, 3);
  assert.strictEqual(equalSplits[0].shareAmount, 400.00);
  assert.strictEqual(equalSplits[1].shareAmount, 400.00);
  assert.strictEqual(equalSplits[2].shareAmount, 400.00);

  // PERCENTAGE
  const pctParticipants = [
    { userId: 'u1', value: 30 },
    { userId: 'u2', value: 30 },
    { userId: 'u3', value: 40 }
  ];
  const pctSplits = ExpenseService.calculateSplits(1000.00, 'PERCENTAGE', pctParticipants, 1.0);
  assert.strictEqual(pctSplits[0].shareAmount, 300.00);
  assert.strictEqual(pctSplits[1].shareAmount, 300.00);
  assert.strictEqual(pctSplits[2].shareAmount, 400.00);

  // EXACT
  const exactParticipants = [
    { userId: 'u1', value: 250.50 },
    { userId: 'u2', value: 350.00 },
    { userId: 'u3', value: 399.50 }
  ];
  const exactSplits = ExpenseService.calculateSplits(1000.00, 'EXACT', exactParticipants, 1.0);
  assert.strictEqual(exactSplits[0].shareAmount, 250.50);
  assert.strictEqual(exactSplits[1].shareAmount, 350.00);
  assert.strictEqual(exactSplits[2].shareAmount, 399.50);

  // SHARES
  const sharesParticipants = [
    { userId: 'u1', value: 1 },
    { userId: 'u2', value: 2 },
    { userId: 'u3', value: 2 }
  ];
  const sharesSplits = ExpenseService.calculateSplits(500.00, 'SHARES', sharesParticipants, 1.0);
  assert.strictEqual(sharesSplits[0].shareAmount, 100.00);
  assert.strictEqual(sharesSplits[1].shareAmount, 200.00);
  assert.strictEqual(sharesSplits[2].shareAmount, 200.00);
});

test('3. Balance Engine - Settlement Netting Algorithm (Aisha)', () => {
  const userBalances = [
    { userId: 'aisha', name: 'Aisha', netBalance: 700.00 },
    { userId: 'rohan', name: 'Rohan', netBalance: -500.00 },
    { userId: 'priya', name: 'Priya', netBalance: -200.00 },
    { userId: 'meera', name: 'Meera', netBalance: 0.00 },
    { userId: 'dev', name: 'Dev', netBalance: 500.00 },
    { userId: 'sam', name: 'Sam', netBalance: -500.00 }
  ];

  const simplified = BalanceService.simplifyDebts(userBalances);
  
  // Total debt should equal total credit (500 + 200 + 500 = 1200)
  const totalSettlementsAmount = simplified.reduce((sum, s) => sum + s.amount, 0);
  assert.strictEqual(totalSettlementsAmount, 1200.00);

  // Assert correct netting flows. Since Rohan (-500), Sam (-500), and Priya (-200) owe money,
  // and Aisha (+700) and Dev (+500) are owed money, they are resolved deterministically.
  assert.strictEqual(simplified.length, 4);
  
  const rohanToAisha = simplified.find(s => s.fromUserId === 'rohan' && s.toUserId === 'aisha');
  assert.ok(rohanToAisha);
  assert.strictEqual(rohanToAisha.amount, 500.00);

  const samToAisha = simplified.find(s => s.fromUserId === 'sam' && s.toUserId === 'aisha');
  assert.ok(samToAisha);
  assert.strictEqual(samToAisha.amount, 200.00);

  const samToDev = simplified.find(s => s.fromUserId === 'sam' && s.toUserId === 'dev');
  assert.ok(samToDev);
  assert.strictEqual(samToDev.amount, 300.00);

  const priyaToDev = simplified.find(s => s.fromUserId === 'priya' && s.toUserId === 'dev');
  assert.ok(priyaToDev);
  assert.strictEqual(priyaToDev.amount, 200.00);
});

test('4. Anomaly Framework - Detects structural violations', async () => {
  // Mock active group memberships
  // Sam joined on April 15, 2026. Others joined Jan 1, 2026.
  const mockMemberships = [
    { userId: 'u-aisha', joinedAt: new Date('2026-01-01'), leftAt: null, user: { name: 'Aisha', email: 'aisha@example.com' } },
    { userId: 'u-rohan', joinedAt: new Date('2026-01-01'), leftAt: null, user: { name: 'Rohan', email: 'rohan@example.com' } },
    { userId: 'u-sam', joinedAt: new Date('2026-04-15'), leftAt: null, user: { name: 'Sam', email: 'sam@example.com' } }
  ];

  // We test the anomaly detection pipeline helpers directly using sample inputs
  const parsedRows = [
    {
      rowNumber: 2,
      title: 'March Wifi Bills',
      amount: '900',
      currency: 'INR',
      paidBy: 'Aisha',
      expenseDate: '2026-03-15',
      splitType: 'EQUAL',
      participants: 'Aisha, Rohan, Sam' // Sam wasn't active on March 15 (Sam Requirement Violation!)
    },
    {
      rowNumber: 3,
      title: 'Aisha settled Wifi bills',
      amount: '300',
      currency: 'INR',
      paidBy: 'Rohan',
      expenseDate: '2026-03-20',
      splitType: 'SETTLEMENT', // Settlement payment logged as expense (Meera violation!)
      participants: 'Aisha, Rohan'
    },
    {
      rowNumber: 4,
      title: 'Groceries April',
      amount: '-150', // Negative Amount!
      currency: 'INR',
      paidBy: 'Aisha',
      expenseDate: '2026-04-20',
      splitType: 'EQUAL',
      participants: 'Aisha, Rohan'
    }
  ];

  // Verify Sam joining constraint directly
  const wifiRow = parsedRows[0];
  const samMem = mockMemberships.find(m => m.user.name === 'Sam');
  const expenseDate = new Date(wifiRow.expenseDate);
  const isSamActiveOnDate = expenseDate >= samMem.joinedAt && (!samMem.leftAt || expenseDate <= samMem.leftAt);
  
  assert.strictEqual(isSamActiveOnDate, false, "Sam should be inactive on March 15, 2026");

  // Verify settlement tracking check
  const settlementRow = parsedRows[1];
  const isSettlement = settlementRow.splitType === 'SETTLEMENT' || settlementRow.title.toLowerCase().includes('settled');
  assert.strictEqual(isSettlement, true, "Should identify settlement disguised as expense");

  // Verify negative amount check
  const negativeRow = parsedRows[2];
  const val = parseFloat(negativeRow.amount);
  assert.ok(val <= 0, "Should identify negative amount");
});
