/**
 * One-time import script: creates Faculty accounts for all 14 AIML Programmers.
 * Uses employee ID as facultyId, "webcap" as the initial password.
 * Safe to re-run — upsert will update name/password without creating duplicates.
 *
 * Usage:  node scripts/importProgrammers.js
 */

const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/utils/passwordUtils');

const prisma = new PrismaClient();

const programmers = [
  { facultyId: '1780', name: 'TAMILISETTY SAMSONU REDDY' },
  { facultyId: '4797', name: 'JAKKI PYDIYYA' },
  { facultyId: '5512', name: 'KONDRAPU DHARANI' },
  { facultyId: '5535', name: 'KASINA NAGA JYOTHI' },
  { facultyId: '5711', name: 'PALLA POOJA NAGA DIVYA ANUSHA' },
  { facultyId: '5902', name: 'DOOSARLAPUDI VEERA VENKATA SATISH' },
  { facultyId: '6050', name: 'GOMPA BHARATHI' },
  { facultyId: '6503', name: 'YAKKALA DURGA ANNAPURNA' },
  { facultyId: '6528', name: 'ALLAM NAGA ATCHUTHA' },
  { facultyId: '6546', name: 'PERURI KUSUMA LATHA SIRISHA' },
  { facultyId: '6610', name: 'JAGARAPU APARNA' },
  { facultyId: '6617', name: 'VIJJAPUREDDY SWARNA DEEPIKA KALYANI' },
  { facultyId: '6695', name: 'KANDA RAJA' },
  { facultyId: '6726', name: 'MANASANI SATYA JYOTHI' },
];

async function main() {
  console.log('🚀 Importing AIML Programmer accounts...\n');

  const password = await hashPassword('webcap');

  let created = 0;
  let updated = 0;

  for (const programmer of programmers) {
    const existing = await prisma.faculty.findUnique({
      where: { facultyId: programmer.facultyId },
    });

    await prisma.faculty.upsert({
      where: { facultyId: programmer.facultyId },
      update: {
        name: programmer.name,
        password,
        isActive: true,
      },
      create: {
        facultyId: programmer.facultyId,
        name: programmer.name,
        password,
        role: 'FACULTY',
        isActive: true,
      },
    });

    if (existing) {
      console.log(`  ↻ Updated  [${programmer.facultyId}] ${programmer.name}`);
      updated++;
    } else {
      console.log(`  ✓ Created  [${programmer.facultyId}] ${programmer.name}`);
      created++;
    }
  }

  console.log(`\n✅ Done. ${created} created, ${updated} updated.`);
  console.log(`   Password for all accounts: webcap`);
}

main()
  .catch((e) => {
    console.error('❌ Import failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
