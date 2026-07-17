const prisma = require('../config/prisma');

class AttendanceRecordRepository {
  async bulkCreate(recordsData) {
    return prisma.attendanceRecord.createMany({
      data: recordsData,
      skipDuplicates: true, // Prevents duplicate scan errors at DB level
    });
  }

  async findBySessionId(sessionId) {
    return prisma.attendanceRecord.findMany({
      where: { sessionId },
      include: { student: true },
      orderBy: { timestamp: 'asc' },
    });
  }

  async findByStudentRollNumber(rollNumber) {
    return prisma.attendanceRecord.findMany({
      where: { studentRollNumber: rollNumber },
      include: { session: true },
      orderBy: { timestamp: 'desc' },
    });
  }
}

module.exports = new AttendanceRecordRepository();
