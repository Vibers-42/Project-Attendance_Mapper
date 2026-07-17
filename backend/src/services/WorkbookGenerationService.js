const prisma = require('../config/prisma');
const { generateWorkbook } = require('../utils/excelGenerator');
const { NotFoundError } = require('../utils/AppError');
const path = require('path');
const fs = require('fs');

class WorkbookGenerationService {
  /**
   * Generates a new workbook based on academicYearId and/or topic
   */
  async generate(academicYearId, topic, generatedBy) {
    // 1. Find sessions matching the criteria
    const sessionWhere = { status: 'COMPLETED' };
    if (academicYearId) sessionWhere.academicYearId = academicYearId;
    if (topic) sessionWhere.topic = topic;

    const sessions = await prisma.attendanceSession.findMany({
      where: sessionWhere,
      include: {
        room: true,
        faculty: true,
        subject: true,
        records: true, // gets all records (present students) for these sessions
      }
    });

    if (sessions.length === 0) {
      throw new NotFoundError('No completed attendance sessions found for the specified filters.');
    }

    // Determine the relevant sections from these sessions
    const sectionIds = [...new Set(sessions.filter(s => s.sectionId).map(s => s.sectionId))];
    
    // 2. Fetch all students who belong to these sections OR academicYearId (if sectionIds is empty, fallback to academicYear)
    const studentWhere = {};
    if (sectionIds.length > 0) {
      studentWhere.sectionId = { in: sectionIds };
    } else if (academicYearId) {
      studentWhere.academicYearId = academicYearId;
    }

    const allStudents = await prisma.student.findMany({
      where: studentWhere,
      orderBy: { rollNumber: 'asc' }
    });

    if (allStudents.length === 0) {
      throw new NotFoundError('No students found for the filtered sessions.');
    }

    // 3. Build Overall Data
    // For Overall, a student is Present if they have an attendance record in ANY of the filtered sessions.
    const allRecordRollNumbers = new Set();
    sessions.forEach(session => {
      session.records.forEach(record => {
        allRecordRollNumbers.add(record.studentRollNumber);
      });
    });

    const overallData = allStudents.map((student, index) => ({
      'S.No': index + 1,
      'Roll No': student.rollNumber,
      'Student Name': student.name,
      'Timetable': student.timetable || '',
      'Attendance Status': allRecordRollNumbers.has(student.rollNumber) ? 'P' : 'A'
    }));

    // 4. Build Room Data
    const roomDataMap = {};
    const sessionInfoMap = {};

    // Group sessions by Room
    const sessionsByRoom = {};
    sessions.forEach(session => {
      const roomName = session.room?.name || 'Unassigned Room';
      if (!sessionsByRoom[roomName]) {
        sessionsByRoom[roomName] = [];
      }
      sessionsByRoom[roomName].push(session);
    });

    for (const [roomName, roomSessions] of Object.entries(sessionsByRoom)) {
      // Find all students who belong to the sections that had classes in this room
      const roomSectionIds = [...new Set(roomSessions.filter(s => s.sectionId).map(s => s.sectionId))];
      const roomStudents = allStudents.filter(student => roomSectionIds.includes(student.sectionId));
      
      // If no sections were assigned, fallback to all students (rare case)
      const targetStudents = roomStudents.length > 0 ? roomStudents : allStudents;

      // Track presence specifically for sessions in this room
      const roomRecordRollNumbers = new Set();
      roomSessions.forEach(session => {
        session.records.forEach(record => {
          roomRecordRollNumbers.add(record.studentRollNumber);
        });
      });

      const sheetData = targetStudents.map((student, index) => ({
        'S.No': index + 1,
        'Roll No': student.rollNumber,
        'Student Name': student.name,
        'Timetable': student.timetable || '',
        'Attendance Status': roomRecordRollNumbers.has(student.rollNumber) ? 'P' : 'A'
      }));

      roomDataMap[roomName] = sheetData;

      // Use the most recent session in this room for the Session Info table metadata
      const latestSession = roomSessions.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
      
      sessionInfoMap[roomName] = {
        professorName: latestSession.faculty?.name,
        labInchargeName: latestSession.labIncharge,
        labInchargeEmployeeId: latestSession.labInchargeEmployeeId,
        sessionDate: latestSession.date.toISOString().split('T')[0],
        sessionTime: latestSession.sessionTime,
        subject: latestSession.subject?.name,
        topic: latestSession.topic,
      };
    }

    // 5. Generate Excel File
    const timestamp = new Date().getTime();
    let nameSuffix = 'All';
    if (academicYearId) nameSuffix = 'AcademicYear';
    if (topic) nameSuffix = `Topic_${topic.replace(/\s+/g, '')}`;
    if (academicYearId && topic) nameSuffix = 'Filtered';
    
    const fileName = `Attendance_Workbook_${nameSuffix}_${timestamp}.xlsx`;
    
    const filePath = generateWorkbook(overallData, roomDataMap, sessionInfoMap, fileName);

    // 6. Save Metadata to DB
    const workbookName = `Workbook - ${topic || 'All Topics'} - ${new Date().toLocaleDateString()}`;

    const generatedWorkbook = await prisma.generatedWorkbook.create({
      data: {
        name: workbookName,
        academicYearId: academicYearId || null,
        topic: topic || null,
        filePath: filePath,
        generatedBy: generatedBy || null
      }
    });

    return generatedWorkbook;
  }

  async listWorkbooks() {
    return prisma.generatedWorkbook.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async getWorkbook(id) {
    const workbook = await prisma.generatedWorkbook.findUnique({
      where: { id }
    });
    if (!workbook) throw new NotFoundError('Workbook not found');
    return workbook;
  }

  async deleteWorkbook(id) {
    const workbook = await this.getWorkbook(id);
    
    // Delete file from disk if it exists
    if (fs.existsSync(workbook.filePath)) {
      fs.unlinkSync(workbook.filePath);
    }

    await prisma.generatedWorkbook.delete({ where: { id } });
    return { success: true };
  }

  async deleteMultipleWorkbooks(ids) {
    const workbooks = await prisma.generatedWorkbook.findMany({
      where: { id: { in: ids } }
    });

    workbooks.forEach(workbook => {
      if (fs.existsSync(workbook.filePath)) {
        fs.unlinkSync(workbook.filePath);
      }
    });

    await prisma.generatedWorkbook.deleteMany({
      where: { id: { in: ids } }
    });
    
    return { count: workbooks.length };
  }

  async deleteAllWorkbooks() {
    const workbooks = await prisma.generatedWorkbook.findMany();
    
    workbooks.forEach(workbook => {
      if (fs.existsSync(workbook.filePath)) {
        fs.unlinkSync(workbook.filePath);
      }
    });

    const result = await prisma.generatedWorkbook.deleteMany({});
    return { count: result.count };
  }
}

module.exports = new WorkbookGenerationService();
