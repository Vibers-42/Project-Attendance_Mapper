const prisma = require('../config/prisma');
const { generateWorkbookBuffer } = require('../utils/excelGenerator');
const { NotFoundError } = require('../utils/AppError');

class WorkbookGenerationService {

  // ── Shared data-building logic ───────────────────────────────────────────────

  async _buildWorkbookData(academicYearId, topic) {
    const sessionWhere = { status: 'COMPLETED' };
    if (academicYearId) sessionWhere.academicYearId = academicYearId;
    if (topic) sessionWhere.topic = topic;

    const sessions = await prisma.attendanceSession.findMany({
      where: sessionWhere,
      include: { room: true, faculty: true, subject: true, records: true },
    });

    if (sessions.length === 0) {
      throw new NotFoundError('No completed attendance sessions found for the specified filters.');
    }

    // Build attended-roll set first — used for P/A marking later.
    const allRecordRollNumbers = new Set();
    sessions.forEach(session => session.records.forEach(r => allRecordRollNumbers.add(r.studentRollNumber)));

    // Fetch ALL students for this year.
    // Strategy: infer the year from the roll numbers of students who attended —
    // this works even when sessions and students have no academicYearId linked.
    const THIRD_YEAR_PREFIXES = ['24B1', '25B2', '25B3', '25B4', '25B5', '25B6', '25B7'];
    const SECOND_YEAR_PREFIXES = ['25B1', '26B2', '26B3', '26B4', '26B5', '26B6', '26B7'];

    let detectedPrefixes = null;
    for (const roll of allRecordRollNumbers) {
      const p4 = roll.substring(0, 4);
      if (THIRD_YEAR_PREFIXES.includes(p4))  { detectedPrefixes = THIRD_YEAR_PREFIXES;  break; }
      if (SECOND_YEAR_PREFIXES.includes(p4)) { detectedPrefixes = SECOND_YEAR_PREFIXES; break; }
    }

    let studentWhere = {};
    if (detectedPrefixes) {
      studentWhere.OR = detectedPrefixes.map(p => ({ rollNumber: { startsWith: p } }));
    } else {
      // Could not infer from roll numbers — fall back to academicYearId name lookup
      const effectiveYearId = academicYearId ||
        sessions.find(s => s.academicYearId)?.academicYearId || null;

      if (effectiveYearId) {
        const academicYear = await prisma.academicYear.findUnique({
          where: { id: effectiveYearId },
          select: { name: true },
        });
        const yearName = (academicYear?.name || '').toLowerCase();
        if (yearName.includes('3') || yearName.includes('third')) {
          studentWhere.OR = THIRD_YEAR_PREFIXES.map(p => ({ rollNumber: { startsWith: p } }));
        } else if (yearName.includes('2') || yearName.includes('second')) {
          studentWhere.OR = SECOND_YEAR_PREFIXES.map(p => ({ rollNumber: { startsWith: p } }));
        } else {
          studentWhere.academicYearId = effectiveYearId;
        }
      } else {
        const sectionIds = [...new Set(sessions.filter(s => s.sectionId).map(s => s.sectionId))];
        if (sectionIds.length > 0) studentWhere.sectionId = { in: sectionIds };
      }
    }

    const allStudents = await prisma.student.findMany({
      where: studentWhere,
      orderBy: { rollNumber: 'asc' },
    });

    if (allStudents.length === 0) {
      throw new NotFoundError('No students found for the filtered sessions.');
    }

    const overallData = allStudents.map((student, index) => ({
      'S.No':              index + 1,
      'Roll No':           student.rollNumber,
      'Student Name':      student.name,
      'Timetable':         student.timetable || '',
      'Attendance Status': allRecordRollNumbers.has(student.rollNumber) ? 'P' : 'A',
    }));

    const roomDataMap    = {};
    const sessionInfoMap = {};
    const sessionsByRoom = {};
    sessions.forEach(session => {
      const roomName = session.room?.name || 'Unassigned Room';
      if (!sessionsByRoom[roomName]) sessionsByRoom[roomName] = [];
      sessionsByRoom[roomName].push(session);
    });

    for (const [roomName, roomSessions] of Object.entries(sessionsByRoom)) {
      const roomRollNumbers  = new Set();
      roomSessions.forEach(s => s.records.forEach(r => roomRollNumbers.add(r.studentRollNumber)));
      // Room sheets show only students who actually attended that room's session.
      const targetStudents = allStudents.filter(s => roomRollNumbers.has(s.rollNumber));

      roomDataMap[roomName] = targetStudents.map((student, index) => ({
        'S.No':              index + 1,
        'Roll No':           student.rollNumber,
        'Student Name':      student.name,
        'Timetable':         student.timetable || '',
        'Attendance Status': roomRollNumbers.has(student.rollNumber) ? 'P' : 'A',
      }));

      const latest = roomSessions.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
      sessionInfoMap[roomName] = {
        professorName:          latest.faculty?.name,
        labInchargeName:        latest.labIncharge,
        labInchargeEmployeeId:  latest.labInchargeEmployeeId,
        sessionDate:            latest.date.toISOString().split('T')[0],
        sessionTime:            latest.sessionTime,
        subject:                latest.subject?.name,
        topic:                  latest.topic,
      };
    }

    let nameSuffix = 'All';
    if (academicYearId) nameSuffix = 'AcademicYear';
    if (topic) nameSuffix = `Topic_${topic.replace(/[^a-zA-Z0-9\-]/g, '_').slice(0, 50)}`;
    if (academicYearId && topic) nameSuffix = 'Filtered';
    const fileName = `Attendance_Workbook_${nameSuffix}_${Date.now()}.xlsx`;

    return { overallData, roomDataMap, sessionInfoMap, fileName };
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  async generate(academicYearId, topic, generatedBy) {
    const { overallData, roomDataMap, sessionInfoMap } = await this._buildWorkbookData(academicYearId, topic);

    // Validate the buffer generates successfully before creating the DB record.
    await generateWorkbookBuffer(overallData, roomDataMap, sessionInfoMap);

    const workbookName = `Workbook - ${topic || 'All Topics'} - ${new Date().toLocaleDateString()}`;
    return prisma.generatedWorkbook.create({
      data: {
        name:           workbookName,
        academicYearId: academicYearId || null,
        topic:          topic || null,
        filePath:       '',   // workbooks are generated on-demand; no disk storage
        generatedBy:    generatedBy || null,
      },
    });
  }

  // Re-generates the workbook from its stored params and returns a Buffer for streaming.
  async getDownloadBuffer(id) {
    const workbook = await this.getWorkbook(id);
    const { overallData, roomDataMap, sessionInfoMap, fileName } =
      await this._buildWorkbookData(workbook.academicYearId, workbook.topic);
    const buffer = await generateWorkbookBuffer(overallData, roomDataMap, sessionInfoMap);
    return { buffer, fileName };
  }

  async listWorkbooks() {
    return prisma.generatedWorkbook.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getWorkbook(id) {
    const workbook = await prisma.generatedWorkbook.findUnique({ where: { id } });
    if (!workbook) throw new NotFoundError('Workbook not found');
    return workbook;
  }

  async deleteWorkbook(id) {
    await this.getWorkbook(id);
    await prisma.generatedWorkbook.delete({ where: { id } });
    return { success: true };
  }

  async deleteMultipleWorkbooks(ids) {
    const { count } = await prisma.generatedWorkbook.deleteMany({ where: { id: { in: ids } } });
    return { count };
  }

  async deleteAllWorkbooks() {
    const { count } = await prisma.generatedWorkbook.deleteMany({});
    return { count };
  }
}

module.exports = new WorkbookGenerationService();
