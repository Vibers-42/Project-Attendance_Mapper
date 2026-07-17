const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/utils/passwordUtils');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  const password = await hashPassword('webcap');

  const demoAccounts = [];
  for (let i = 1; i <= 10; i++) {
    const facultyId = `FAC${String(i).padStart(3, '0')}`;
    const name = i === 1 ? 'Demo' : `Demo${i - 1}`;
    
    demoAccounts.push({
      facultyId,
      name,
      password,
      role: 'FACULTY',
      isActive: true
    });
  }

  for (const account of demoAccounts) {
    await prisma.faculty.upsert({
      where: { facultyId: account.facultyId },
      update: {
        name: account.name,
        password: account.password,
        role: account.role,
        isActive: account.isActive
      },
      create: account
    });
  }

  console.log('✅ Successfully seeded 10 Faculty demo accounts.');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
