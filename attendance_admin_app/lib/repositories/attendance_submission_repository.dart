import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../models/auth_response_model.dart';
import '../services/api_service.dart';
import '../utils/api_exception.dart';

class AttendanceSubmissionRepository {
  final ApiService _apiService;

  AttendanceSubmissionRepository(this._apiService);

  Future<int> submitAttendance(String sessionId, List<String> scannedStudents) async {
    if (sessionId.isEmpty) {
      throw ApiException('Session ID is missing. Cannot submit attendance.');
    }

    if (scannedStudents.isEmpty) {
      throw ApiException('No students scanned. Cannot submit empty attendance.');
    }

    try {
      final response = await _apiService.client.post(
        ApiConstants.sessionRecords(sessionId),
        data: {
          'scannedStudents': scannedStudents,
        },
      );

      final authResponse = AuthResponseModel.fromJson(response.data);

      if (authResponse.success && authResponse.data != null) {
        return authResponse.data!['count'] as int? ?? scannedStudents.length;
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
