class PlacementStudentModel {
  final String rollNumber;
  final String name;
  final String? phoneNumber;

  const PlacementStudentModel({
    required this.rollNumber,
    required this.name,
    this.phoneNumber,
  });

  factory PlacementStudentModel.fromJson(Map<String, dynamic> json) {
    return PlacementStudentModel(
      rollNumber: json['rollNumber'] as String,
      name: json['name'] as String,
      phoneNumber: json['phoneNumber'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'rollNumber': rollNumber,
        'name': name,
        if (phoneNumber != null) 'phoneNumber': phoneNumber,
      };
}
