class AuthResponseModel {
  final bool success;
  final String message;
  final dynamic data;
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
      message: json['message']?.toString() ?? '',
      data: json['data'],
      errors: json['errors'] as List<dynamic>?,
    );
  }

  Map<String, dynamic>? get dataAsMap =>
      data is Map<String, dynamic> ? data as Map<String, dynamic> : null;

  List<dynamic>? get dataAsList => data is List ? data as List<dynamic> : null;
}
