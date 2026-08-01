class PlacementAttendanceEntry {
  final String rollNumber;
  final String name;
  final String attendanceStatus;

  const PlacementAttendanceEntry({
    required this.rollNumber,
    required this.name,
    required this.attendanceStatus,
  });

  bool get isPending => attendanceStatus == 'PENDING';
  bool get isPresent => attendanceStatus == 'PRESENT';

  factory PlacementAttendanceEntry.fromJson(Map<String, dynamic> json) {
    return PlacementAttendanceEntry(
      rollNumber: json['rollNumber'] as String,
      name: json['name'] as String,
      attendanceStatus: json['attendanceStatus'] as String? ?? 'PENDING',
    );
  }
}
