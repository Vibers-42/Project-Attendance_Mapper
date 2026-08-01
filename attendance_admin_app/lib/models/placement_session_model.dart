class PlacementSessionModel {
  final String id;
  final String title;
  final DateTime date;
  final String? venue;
  final String? attendanceMode;
  final String status;
  final int studentCount;
  final int permissionCount;
  // Populated by the list endpoint; null when coming from the create endpoint.
  final String? myRole;

  const PlacementSessionModel({
    required this.id,
    required this.title,
    required this.date,
    this.venue,
    this.attendanceMode,
    required this.status,
    required this.studentCount,
    required this.permissionCount,
    this.myRole,
  });

  factory PlacementSessionModel.fromJson(Map<String, dynamic> json) {
    final counts = json['_count'] as Map<String, dynamic>? ?? {};
    return PlacementSessionModel(
      id: json['id'] as String,
      title: json['title'] as String,
      date: DateTime.parse(json['date'] as String),
      venue: json['venue'] as String?,
      attendanceMode: json['description'] as String?,
      status: json['status'] as String,
      studentCount: counts['students'] as int? ?? 0,
      permissionCount: counts['permissions'] as int? ?? 0,
      myRole: json['myRole'] as String?,
    );
  }

  bool get isOwnerOrEditor =>
      myRole == 'OWNER' || myRole == 'EDITOR';
}
