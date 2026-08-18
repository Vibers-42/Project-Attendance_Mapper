const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Testing Phase 5');
  // Clear existing placement sessions for a clean test
  await prisma.placementStudent.deleteMany();
  await prisma.placementSessionPermission.deleteMany();
  await prisma.placementSession.deleteMany();

  const superAdmin = await prisma.superAdmin.findFirst();
  
  // Need a faculty user to be creator
  let faculty = await prisma.faculty.findFirst();
  if (!faculty) {
    faculty = await prisma.faculty.create({
      data: {
        employeeId: 'TEST-FACULTY-1',
        name: 'Test Faculty',
        departmentId: (await prisma.department.findFirst()).id,
      }
    });
  }

  // Create Session A (TCS Drive)
  const sessionA = await prisma.placementSession.create({
    data: {
      title: 'TCS Drive',
      date: new Date('2026-08-18T09:00:00.000Z'),
      venue: 'Auditorium',
      description: 'Offline',
      status: 'COMPLETED',
      createdById: faculty.id,
      conductedById: faculty.id,
    }
  });

  // Insert 100 eligible students for A, 80 present
  const studentsA = Array.from({ length: 100 }).map((_, i) => ({
    rollNumber: `TCS${i}`,
    name: `Student A${i}`,
    sessionId: sessionA.id,
    attendanceStatus: i < 80 ? 'PRESENT' : 'ABSENT'
  }));
  await prisma.placementStudent.createMany({ data: studentsA });

  // Create Session B (Infosys Drive)
  const sessionB = await prisma.placementSession.create({
    data: {
      title: 'Infosys Drive',
      date: new Date('2026-08-20T09:00:00.000Z'),
      venue: 'Online',
      description: 'Virtual',
      status: 'COMPLETED',
      createdById: faculty.id,
      conductedById: faculty.id,
    }
  });

  // Insert 150 eligible students for B, 120 present
  const studentsB = Array.from({ length: 150 }).map((_, i) => ({
    rollNumber: `INF${i}`,
    name: `Student B${i}`,
    sessionId: sessionB.id,
    attendanceStatus: i < 120 ? 'PRESENT' : 'ABSENT'
  }));
  await prisma.placementStudent.createMany({ data: studentsB });

  console.log('✅ Inserted Test Sessions');

  // Verify listReports logic from AdminPlacementReportController
  const sessions = await prisma.placementSession.findMany({
    where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
    orderBy: { date: 'desc' },
    include: {
      _count: {
        select: {
          students: {
            where: { attendanceStatus: 'PRESENT' },
          },
        },
      },
    },
  });

  console.log(`✅ Found ${sessions.length} active/completed sessions.`);
  for (const s of sessions) {
    console.log(`- ${s.title} | ${s.date.toISOString()} | Present: ${s._count.students}`);
  }

  // Ensure download logic separates them
  console.log('\n✅ Testing downloading Session A (TCS Drive)...');
  const studentsForA = await prisma.placementStudent.findMany({ where: { sessionId: sessionA.id } });
  console.log(`Fetched ${studentsForA.length} students for A. Expected: 100.`);
  
  console.log('✅ Testing downloading Session B (Infosys Drive)...');
  const studentsForB = await prisma.placementStudent.findMany({ where: { sessionId: sessionB.id } });
  console.log(`Fetched ${studentsForB.length} students for B. Expected: 150.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
