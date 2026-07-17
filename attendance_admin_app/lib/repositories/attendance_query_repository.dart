import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../models/attendance_session_model.dart';
import '../models/attendance_record_model.dart';
import '../models/auth_response_model.dart';
import '../services/api_service.dart';
import '../utils/api_exception.dart';

class PaginatedSessionsResponse {
  final List<AttendanceSessionModel> sessions;
  final Map<String, dynamic> meta;

  PaginatedSessionsResponse({required this.sessions, required this.meta});
}

class AttendanceQueryRepository {
  final ApiService _apiService;

  AttendanceQueryRepository(this._apiService);

  Future<PaginatedSessionsResponse> getSessions({
    int page = 1,
    int limit = 10,
    String? status,
    String? roomId,
    String? startDate,
    String? endDate,
  }) async {
    try {
      final Map<String, dynamic> queryParameters = {
        'page': page,
        'limit': limit,
      };

      if (status != null && status.isNotEmpty) queryParameters['status'] = status;
      if (roomId != null && roomId.isNotEmpty) queryParameters['roomId'] = roomId;
      if (startDate != null && startDate.isNotEmpty) queryParameters['startDate'] = startDate;
      if (endDate != null && endDate.isNotEmpty) queryParameters['endDate'] = endDate;

      final response = await _apiService.client.get(
        ApiConstants.sessions,
        queryParameters: queryParameters,
      );

      final authResponse = AuthResponseModel.fromJson(response.data);

      if (authResponse.success && authResponse.data != null) {
        final List<dynamic> sessionsList = authResponse.data!['sessions'];
        final Map<String, dynamic> meta = authResponse.data!['meta'] ?? {};

        final sessions = sessionsList
            .map((json) => AttendanceSessionModel.fromJson(json as Map<String, dynamic>))
            .toList();

        return PaginatedSessionsResponse(sessions: sessions, meta: meta);
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

  Future<List<AttendanceRecordModel>> getSessionRecords(String sessionId) async {
    try {
      final response = await _apiService.client.get(
        ApiConstants.sessionRecords(sessionId),
      );

      final authResponse = AuthResponseModel.fromJson(response.data);

      if (authResponse.success && authResponse.data != null) {
        final List<dynamic> recordsList = authResponse.data!['records'];
        return recordsList
            .map((json) => AttendanceRecordModel.fromJson(json as Map<String, dynamic>))
            .toList();
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
}
