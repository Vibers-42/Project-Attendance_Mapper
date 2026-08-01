class PlacementStudentModel {
  final String rollNumber;
  final String name;

  const PlacementStudentModel({required this.rollNumber, required this.name});

  factory PlacementStudentModel.fromJson(Map<String, dynamic> json) {
    return PlacementStudentModel(
      rollNumber: json['rollNumber'] as String,
      name: json['name'] as String,
    );
  }

  Map<String, dynamic> toJson() => {'rollNumber': rollNumber, 'name': name};
}
