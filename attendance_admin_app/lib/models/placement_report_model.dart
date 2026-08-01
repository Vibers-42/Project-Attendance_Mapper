class PlacementReportStudent {
  final String rollNumber;
  final String name;
  final String? phoneNumber;
  final DateTime? markedAt;

  const PlacementReportStudent({
    required this.rollNumber,
    required this.name,
    this.phoneNumber,
    this.markedAt,
  });

  factory PlacementReportStudent.fromJson(Map<String, dynamic> json) {
    return PlacementReportStudent(
      rollNumber: json['rollNumber'] as String,
      name: json['name'] as String,
      phoneNumber: json['phoneNumber'] as String?,
      markedAt: json['markedAt'] != null
          ? DateTime.tryParse(json['markedAt'] as String)
          : null,
    );
  }
}

class PlacementReport {
  final String sessionId;
  final String sessionTitle;
  final int eligible;
  final int present;
  final int absent;
  final List<PlacementReportStudent> presentStudents;
  final List<PlacementReportStudent> absentStudents;

  const PlacementReport({
    required this.sessionId,
    required this.sessionTitle,
    required this.eligible,
    required this.present,
    required this.absent,
    required this.presentStudents,
    required this.absentStudents,
  });

  factory PlacementReport.fromJson(Map<String, dynamic> json) {
    final session = json['session'] as Map<String, dynamic>;
    return PlacementReport(
      sessionId: session['id'] as String,
      sessionTitle: session['title'] as String,
      eligible: json['eligible'] as int,
      present: json['present'] as int,
      absent: json['absent'] as int,
      presentStudents: (json['presentStudents'] as List<dynamic>)
          .map((e) => PlacementReportStudent.fromJson(e as Map<String, dynamic>))
          .toList(),
      absentStudents: (json['absentStudents'] as List<dynamic>)
          .map((e) => PlacementReportStudent.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
