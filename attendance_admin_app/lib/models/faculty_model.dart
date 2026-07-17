class FacultyModel {
  final String id;
  final String facultyId;
  final String name;
  final String role;

  FacultyModel({
    required this.id,
    required this.facultyId,
    required this.name,
    required this.role,
  });

  factory FacultyModel.fromJson(Map<String, dynamic> json) {
    return FacultyModel(
      id: json['id'] as String,
      facultyId: json['facultyId'] as String,
      name: json['name'] ?? '',
      role: json['role'] ?? 'FACULTY',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'facultyId': facultyId,
      'name': name,
      'role': role,
    };
  }
}
