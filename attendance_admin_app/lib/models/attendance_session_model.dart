class AttendanceSessionModel {
  final String id;
  final String status;
  final DateTime date;
  final String facultyId;
  final String? roomId;
  final String? subjectId;
  final String? academicYearId;
  final String? sectionId;
  final String? sessionTime;
  final String? labIncharge;
  final int attendanceCount;

  AttendanceSessionModel({
    required this.id,
    required this.status,
    required this.date,
    required this.facultyId,
    this.roomId,
    this.subjectId,
    this.academicYearId,
    this.sectionId,
    this.sessionTime,
    this.labIncharge,
    this.attendanceCount = 0,
  });

  factory AttendanceSessionModel.fromJson(Map<String, dynamic> json) {
    return AttendanceSessionModel(
      id: json['id'] as String,
      status: json['status'] as String,
      date: DateTime.parse(json['date'] as String),
      facultyId: json['facultyId'] as String,
      roomId: json['roomId'] as String?,
      subjectId: json['subjectId'] as String?,
      academicYearId: json['academicYearId'] as String?,
      sectionId: json['sectionId'] as String?,
      sessionTime: json['sessionTime'] as String?,
      labIncharge: json['labIncharge'] as String?,
      attendanceCount: json['attendanceCount'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'status': status,
      'date': date.toIso8601String(),
      'facultyId': facultyId,
      'roomId': roomId,
      'subjectId': subjectId,
      'academicYearId': academicYearId,
      'sectionId': sectionId,
      'sessionTime': sessionTime,
      'labIncharge': labIncharge,
    };
  }
}
