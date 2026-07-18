import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../models/attendance_session_model.dart';
import '../models/auth_response_model.dart';
import '../services/api_service.dart';
import '../utils/api_exception.dart';

class SessionRepository {
  final ApiService _apiService;

  SessionRepository(this._apiService);

  Future<AttendanceSessionModel> createSession(Map<String, dynamic> data) async {
    try {
      final response = await _apiService.client.post(
        ApiConstants.sessions,
        data: data,
      );

      final authResponse = AuthResponseModel.fromJson(response.data);

      if (authResponse.success && authResponse.data != null) {
        final sessionJson = authResponse.data!['session'] as Map<String, dynamic>;
        return AttendanceSessionModel.fromJson(sessionJson);
      } else {
        throw ApiException(authResponse.message);
      }
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<AttendanceSessionModel?> getActiveSession() async {
    try {
      final response = await _apiService.client.get(ApiConstants.activeSession);
      final authResponse = AuthResponseModel.fromJson(response.data);

      if (authResponse.success && authResponse.data != null) {
        final sessionJson = authResponse.data!['session'] as Map<String, dynamic>;
        return AttendanceSessionModel.fromJson(sessionJson);
      }
      return null;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        return null;
      }
      throw ApiException.fromDioException(e);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<AttendanceSessionModel> updateSession(
      String sessionId, Map<String, dynamic> data) async {
    try {
      final response = await _apiService.client.patch(
        '${ApiConstants.sessions}/$sessionId',
        data: data,
      );
      final authResponse = AuthResponseModel.fromJson(response.data);
      if (authResponse.success && authResponse.data != null) {
        final sessionJson =
            authResponse.data!['session'] as Map<String, dynamic>;
        return AttendanceSessionModel.fromJson(sessionJson);
      } else {
        throw ApiException(authResponse.message);
      }
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<Map<String, String>> getValidStudents() async {
    try {
      final response = await _apiService.client.get(
        ApiConstants.students,
        queryParameters: {'limit': 500},
      );

      final authResponse = AuthResponseModel.fromJson(response.data);
      if (authResponse.success && authResponse.data != null) {
        final studentsList = authResponse.data as List<dynamic>;
        final Map<String, String> validMap = {};
        
        for (var student in studentsList) {
          final rollNumber = student['rollNumber']?.toString().toUpperCase();
          final barcode = student['barcode']?.toString().toUpperCase();
          
          if (rollNumber != null) {
            validMap[rollNumber] = rollNumber;
            if (barcode != null) {
              validMap[barcode] = rollNumber;
            }
          }
        }
        return validMap;
      }
      return {};
    } catch (e) {
      // If offline or fails, return empty map so we don't block session creation,
      // but ideally we should cache this for offline use.
      return {};
    }
  }
}
