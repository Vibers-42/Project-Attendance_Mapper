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

  // ==========================================
  // STUDENT SEEDING
  // ==========================================
  const demoStudents = [
    { serialNo: 1, rollNumber: '22CS101', name: 'Arun Kumar', timetable: 'CSE A - Morning', barcode: 'BC22CS101' },
    { serialNo: 2, rollNumber: '22CS102', name: 'Bhavya Reddy', timetable: 'CSE A - Morning', barcode: 'BC22CS102' },
    { serialNo: 3, rollNumber: '22CS103', name: 'Chandra Mohan', timetable: 'CSE A - Morning', barcode: 'BC22CS103' },
    { serialNo: 4, rollNumber: '22CS201', name: 'Divya Sri', timetable: 'CSE B - Afternoon', barcode: 'BC22CS201' },
    { serialNo: 5, rollNumber: '22CS202', name: 'Esha Gupta', timetable: 'CSE B - Afternoon', barcode: 'BC22CS202' },
  ];

  for (const student of demoStudents) {
    await prisma.student.upsert({
      where: { rollNumber: student.rollNumber },
      update: {
        name: student.name,
        timetable: student.timetable,
        barcode: student.barcode,
        serialNo: student.serialNo
      },
      create: student
    });
  }

  console.log(`✅ Successfully seeded ${demoStudents.length} Student Master records.`);
}

main()
  .catch((e) => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
