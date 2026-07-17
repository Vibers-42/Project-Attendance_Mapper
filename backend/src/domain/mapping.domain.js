/**
 * Enum defining the current status of an attendance mapping operation.
 */
const MappingStatus = {
  PENDING: 'PENDING',
  VALIDATED: 'VALIDATED',
  CONFLICT: 'CONFLICT',
  READY_FOR_EXPORT: 'READY_FOR_EXPORT'
};

/**
 * Represents the contextual data required to execute an attendance mapping.
 */
class MappingContext {
  constructor({ session, timetableEntry, students, metadata = {} }) {
    this.session = session;             // The raw AttendanceSession (source of truth)
    this.timetableEntry = timetableEntry; // The referenced Timetable data
    this.students = students || [];     // Master Data for the cohort
    this.metadata = metadata;           // Extensible mapping metadata (e.g. issues, warnings)
  }

  get sessionId() {
    return this.session?.id;
  }
}

/**
 * Represents the final structured output of a mapping operation.
 */
class MappingResult {
  constructor({ context, mappedRecords, unmappedRecords, status }) {
    this.context = context;
    this.mappedRecords = mappedRecords || [];
    this.unmappedRecords = unmappedRecords || [];
    this.status = status || MappingStatus.PENDING;
    this.generatedAt = new Date();
  }
}

module.exports = {
  MappingStatus,
  MappingContext,
  MappingResult
};
