import 'package:dio/dio.dart';
import '../models/auth_response_model.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, {this.statusCode});

  factory ApiException.fromDioException(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout || 
        e.type == DioExceptionType.receiveTimeout || 
        e.type == DioExceptionType.sendTimeout) {
      return ApiException('Connection timed out. Please try again.', statusCode: 408);
    }
    
    if (e.type == DioExceptionType.connectionError) {
      return ApiException('No internet connection. Please check your network.', statusCode: 0);
    }

    if (e.response != null && e.response?.data != null) {
      try {
        final authResponse = AuthResponseModel.fromJson(e.response!.data);
        return ApiException(authResponse.message, statusCode: e.response?.statusCode);
      } catch (_) {
        return ApiException('Unexpected server response.', statusCode: e.response?.statusCode);
      }
    }
    
    return ApiException('Network error. Please try again later.');
  }

  @override
  String toString() => message;
}
