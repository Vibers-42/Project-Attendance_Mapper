/// Represents a single student who was found in another active session.
class DuplicateScanConflict {
  /// The student's roll number that triggered the conflict.
  final String rollNumber;

  /// Name of the faculty member who already scanned this student.
  final String facultyName;

  /// ID of the conflicting session (may be used for display/debugging).
  final String? sessionId;

  /// ISO-8601 timestamp of when the student was originally scanned.
  final String? timestamp;

  const DuplicateScanConflict({
    required this.rollNumber,
    required this.facultyName,
    this.sessionId,
    this.timestamp,
  });

  factory DuplicateScanConflict.fromJson(Map<String, dynamic> json) {
    return DuplicateScanConflict(
      rollNumber:  json['rollNumber']  as String? ?? 'Unknown',
      facultyName: json['facultyName'] as String? ?? 'Unknown Faculty',
      sessionId:   json['sessionId']   as String?,
      timestamp:   json['timestamp']   as String?,
    );
  }

  @override
  String toString() => 'DuplicateScanConflict(roll: $rollNumber, faculty: $facultyName)';
}

/// Thrown by [AttendanceSubmissionRepository] when the backend returns HTTP 409
/// with a `conflicts` array, indicating that one or more students in the batch
/// are already present in another currently-active attendance session.
///
/// Use [conflicts] to render a per-student error message in the UI, e.g.:
///   "Roll number 22A91A0501 has already been scanned by Dr. Ramesh."
class DuplicateScanException implements Exception {
  /// Human-readable summary from the backend.
  final String message;

  /// Structured list of each conflicting student.
  final List<DuplicateScanConflict> conflicts;

  const DuplicateScanException({
    required this.message,
    required this.conflicts,
  });

  @override
  String toString() => 'DuplicateScanException: $message (${conflicts.length} conflicts)';
}
