class AttendanceRecordModel {
  final String id;
  final String sessionId;
  final String studentRollNumber;
  final DateTime timestamp;
  
  // Could hold nested student details later when Master Data is fully mapped
  final Map<String, dynamic>? studentData;

  AttendanceRecordModel({
    required this.id,
    required this.sessionId,
    required this.studentRollNumber,
    required this.timestamp,
    this.studentData,
  });

  factory AttendanceRecordModel.fromJson(Map<String, dynamic> json) {
    return AttendanceRecordModel(
      id: json['id'] as String,
      sessionId: json['sessionId'] as String,
      studentRollNumber: json['studentRollNumber'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      studentData: json['student'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'sessionId': sessionId,
      'studentRollNumber': studentRollNumber,
      'timestamp': timestamp.toIso8601String(),
      'student': studentData,
    };
  }
}
