class AuthResponseModel {
  final bool success;
  final String message;
  final Map<String, dynamic>? data;
  final List<dynamic>? errors;

  AuthResponseModel({
    required this.success,
    required this.message,
    this.data,
    this.errors,
  });

  factory AuthResponseModel.fromJson(Map<String, dynamic> json) {
    return AuthResponseModel(
      success: json['success'] ?? false,
      message: json['message'] ?? '',
      data: json['data'] as Map<String, dynamic>?,
      errors: json['errors'] as List<dynamic>?,
    );
  }
}
