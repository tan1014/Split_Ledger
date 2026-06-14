import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // 1. Clear database
  await prisma.auditLog.deleteMany({});
  await prisma.importAnomaly.deleteMany({});
  await prisma.importJob.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.expenseParticipant.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.groupMembership.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.exchangeRate.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Cleared database tables.');

  // 2. Hash password
  const passwordHash = await bcrypt.hash('password', 10);

  // 3. Create Users
  const usersData = [
    { name: 'Aisha', email: 'aisha@example.com', passwordHash },
    { name: 'Rohan', email: 'rohan@example.com', passwordHash },
    { name: 'Priya', email: 'priya@example.com', passwordHash },
    { name: 'Meera', email: 'meera@example.com', passwordHash },
    { name: 'Dev', email: 'dev@example.com', passwordHash },
    { name: 'Sam', email: 'sam@example.com', passwordHash },
  ];

  const users = {};
  for (const u of usersData) {
    const createdUser = await prisma.user.create({ data: u });
    users[createdUser.name] = createdUser;
  }
  console.log(`Created ${Object.keys(users).length} users.`);

  // 4. Create Group
  const group = await prisma.group.create({
    data: {
      name: 'Flat 302',
      description: 'Monthly flatmates shared expenses and settlement tracker.',
    },
  });
  console.log(`Created group: ${group.name}`);

  // 5. Create Memberships with different start dates
  // Aisha, Rohan, Priya, Meera, Dev joined on Jan 1, 2026.
  // Sam joined on April 15, 2026.
  const memberships = [
    { groupName: 'Flat 302', userName: 'Aisha', joinedAt: new Date('2026-01-01T00:00:00Z') },
    { groupName: 'Flat 302', userName: 'Rohan', joinedAt: new Date('2026-01-01T00:00:00Z') },
    { groupName: 'Flat 302', userName: 'Priya', joinedAt: new Date('2026-01-01T00:00:00Z') },
    { groupName: 'Flat 302', userName: 'Meera', joinedAt: new Date('2026-01-01T00:00:00Z') },
    { groupName: 'Flat 302', userName: 'Dev', joinedAt: new Date('2026-01-01T00:00:00Z') },
    { groupName: 'Flat 302', userName: 'Sam', joinedAt: new Date('2026-04-15T00:00:00Z') },
  ];

  for (const m of memberships) {
    await prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId: users[m.userName].id,
        joinedAt: m.joinedAt,
      },
    });
  }
  console.log('Created group memberships.');

  // 6. Create Exchange Rates
  const rates = [
    { fromCurrency: 'USD', toCurrency: 'INR', rate: 83.50, effectiveDate: new Date('2026-01-01T00:00:00Z') },
    { fromCurrency: 'EUR', toCurrency: 'INR', rate: 90.00, effectiveDate: new Date('2026-01-01T00:00:00Z') },
    { fromCurrency: 'GBP', toCurrency: 'INR', rate: 106.00, effectiveDate: new Date('2026-01-01T00:00:00Z') },
    { fromCurrency: 'INR', toCurrency: 'INR', rate: 1.00, effectiveDate: new Date('2026-01-01T00:00:00Z') },
  ];

  for (const r of rates) {
    await prisma.exchangeRate.create({ data: r });
  }
  console.log('Created exchange rates.');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
