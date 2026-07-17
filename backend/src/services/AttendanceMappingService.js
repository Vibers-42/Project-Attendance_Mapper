const AttendanceSessionRepository = require('../repositories/AttendanceSessionRepository');
const TimetableRepository = require('../repositories/TimetableRepository');
const StudentRepository = require('../repositories/StudentRepository');
const { MappingContext, MappingStatus } = require('../domain/mapping.domain');

class AttendanceMappingService {
  /**
   * Prepares the mapping context by aggregating raw session data, timetable data, and student master data.
   * Does NOT modify any records. Read-only operation.
   * 
   * @param {string} sessionId - The UUID of the AttendanceSession.
   * @returns {Promise<MappingContext>}
   */
  async prepareMappingContext(sessionId) {
    if (!sessionId) {
      throw new Error('Session ID is required to prepare mapping context.');
    }

    // 1. Retrieve the Attendance Session (Source of truth)
    const session = await AttendanceSessionRepository.findById(sessionId);
    if (!session) {
      const error = new Error('Attendance session not found.');
      error.statusCode = 404;
      throw error;
    }

    // 2. Resolve Timetable Entry (if provided or map-able)
    // Currently, sessions just have strings for subject/room, so this prepares the infrastructure 
    // to map those strings to proper timetable entries in the future.
    let timetableEntry = null;
    
    // 3. Resolve Student Cohort Master Data
    let students = [];
    if (session.academicYearId && session.sectionId) {
      students = await StudentRepository.findAllByYearAndSection(
        session.academicYearId,
        session.sectionId
      );
    }

    return new MappingContext({
      session,
      timetableEntry,
      students,
      metadata: {
        totalScans: session.records?.length || 0,
        totalCohortSize: students.length
      }
    });
  }

  /**
   * Validates a prepared MappingContext to determine if it is ready for workbook generation.
   * 
   * @param {MappingContext} context 
   * @returns {Object} status and validation warnings
   */
  validateContext(context) {
    const warnings = [];
    let status = MappingStatus.PENDING;

    if (!context.session) {
      warnings.push('Session data is missing.');
      return { status: MappingStatus.CONFLICT, warnings };
    }

    if (!context.students || context.students.length === 0) {
      warnings.push('No student master data found for the session cohort.');
    }

    // Check if barcodes in the session actually map to known students in the cohort
    const cohortRollNumbers = new Set(context.students.map(s => s.rollNumber));
    const scannedRecords = context.session.records || [];
    
    const unmappedScans = scannedRecords.filter(
      record => !cohortRollNumbers.has(record.studentRollNumber)
    );

    if (unmappedScans.length > 0) {
      warnings.push(`${unmappedScans.length} scanned students do not exist in the cohort master data.`);
    }

    if (warnings.length > 0) {
      status = MappingStatus.CONFLICT;
    } else {
      status = MappingStatus.READY_FOR_EXPORT;
    }

    return { status, warnings };
  }
}

module.exports = new AttendanceMappingService();
