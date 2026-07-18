const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/utils/passwordUtils');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ==========================================
  // ACADEMIC YEARS
  // ==========================================
  // Rename legacy "Second Year"/"Third Year" records in-place so existing
  // sessions (linked by academicYearId) remain correctly associated.
  const yearMigrations = [
    { from: 'Second Year', to: '2nd Year' },
    { from: 'Third Year',  to: '3rd Year'  },
  ];
  for (const { from, to } of yearMigrations) {
    const legacy = await prisma.academicYear.findUnique({ where: { name: from } });
    if (legacy) {
      await prisma.academicYear.update({ where: { name: from }, data: { name: to } });
    } else {
      await prisma.academicYear.upsert({ where: { name: to }, update: {}, create: { name: to } });
    }
  }
  console.log('✅ Seeded AcademicYear records.');

  // ==========================================
  // SUBJECTS
  // ==========================================
  const subjects = [
    { name: 'Employability Skills - Aptitude', code: 'ES-APT' },
    { name: 'Employability Skills - Soft Skills', code: 'ES-SS' },
  ];
  for (const s of subjects) {
    await prisma.subject.upsert({
      where: { name: s.name },
      update: {},
      create: s,
    });
  }
  console.log('✅ Seeded Subject records.');

  const password = await hashPassword('webcap');

  // ==========================================
  // SUPER ADMIN SEEDING
  // ==========================================
  // This is the initial Super Admin account for website access.
  // To add more Super Admins in the future, insert records into
  // the SuperAdmin table — no code changes required.

  await prisma.superAdmin.upsert({
    where: { employeeId: 'FAC010' },
    update: {
      employeeName: 'Super Admin',
      passwordHash: password,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
    create: {
      employeeId: 'FAC010',
      employeeName: 'Super Admin',
      passwordHash: password,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Successfully seeded Super Admin account (FAC010).');

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
  
  // Clear existing students to ensure ONLY the requested data is kept
  await prisma.student.deleteMany({});
  console.log('🧹 Cleared all existing students.');

  const demoStudents = [
    { serialNo: 1, rollNumber: '24B11AI085', name: 'DEVARAKONDA SRI SASHANK', timetable: 'T4(CA2)', barcode: 'BC24B11AI085' },
    { serialNo: 2, rollNumber: '24B11AI242', name: 'MANDA NAGA BHAVANI PRASAD REDDY', timetable: 'T5(T-HUB)', barcode: 'BC24B11AI242' },
    { serialNo: 3, rollNumber: '24B11AI062', name: 'CHIKKALA SRI NAGA VIJAY KUMAR', timetable: 'T5(T-HUB)', barcode: 'BC24B11AI062' },
    { serialNo: 4, rollNumber: '24B11AI139', name: 'GUVVALA SAI SRI PAVAN', timetable: 'T4(CA2)', barcode: 'BC24B11AI139' },
    { serialNo: 5, rollNumber: '24B11AI124', name: 'GODAVARTHI SAI HARSHA', timetable: 'T4(CA2)', barcode: 'BC24B11AI124' },
    { serialNo: 6, rollNumber: '24B11AI125', name: 'DEVARAKONDA GOHIT', timetable: 'T4(CA2)', barcode: 'BC24B11AI125' },
    { serialNo: 7, rollNumber: '24B11AI417', name: 'TEEPARTHI LALITHA CHANDRA SREENIJA', timetable: 'T5(T-HUB)', barcode: 'BC24B11AI417' },
    { serialNo: 8, rollNumber: '24B11AI019', name: 'ARIGELA TEJASRI SAI SANTHOSH', timetable: 'T5(T-HUB)', barcode: 'BC24B11AI019' },
    { serialNo: 9, rollNumber: '24B11AI228', name: 'MADDURI RAMA VENKATA SATYA CHITTI NAGA SAI', timetable: 'T5(T-HUB)', barcode: 'BC24B11AI228' },
    { serialNo: 10, rollNumber: '24B11AI248', name: 'MANTRIPRAGADA SAI HARSHITH', timetable: 'T5(T-HUB)', barcode: 'BC24B11AI248' },
    { serialNo: 11, rollNumber: '24B11AI262', name: 'MOHAMMED AKMAL KANNA MANGALAM', timetable: 'T5(T-HUB)', barcode: 'BC24B11AI262' },
    { serialNo: 12, rollNumber: '24B11AI217', name: 'LEKKALA ATCHUT KUMAR', timetable: 'T4(CA2)', barcode: 'BC24B11AI217' },
    { serialNo: 13, rollNumber: '24B11AI252', name: 'MATCHA KUMAR BABU', timetable: 'T4(CA2)', barcode: 'BC24B11AI252' },
    { serialNo: 14, rollNumber: '24B11AI400', name: 'SINGAM MAHIDAR', timetable: 'T4(CA2)', barcode: 'BC24B11AI400' },
  ];

  // Look up academic year IDs so students can be linked correctly
  const thirdYear  = await prisma.academicYear.findUnique({ where: { name: '3rd Year' } });
  const secondYear = await prisma.academicYear.findUnique({ where: { name: '2nd Year' } });

  for (const student of demoStudents) {
    // Link by roll-number prefix: 24B → 3rd Year, 25B → 2nd Year
    const acYear = student.rollNumber.startsWith('24B') ? thirdYear
                 : student.rollNumber.startsWith('25B') ? secondYear
                 : null;
    const yearLink = acYear ? { academicYearId: acYear.id } : {};

    await prisma.student.upsert({
      where:  { rollNumber: student.rollNumber },
      update: { name: student.name, timetable: student.timetable, barcode: student.barcode, serialNo: student.serialNo, ...yearLink },
      create: { ...student, ...yearLink },
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
