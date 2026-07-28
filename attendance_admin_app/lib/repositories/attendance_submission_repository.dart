import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../models/auth_response_model.dart';
import '../services/api_service.dart';
import '../utils/api_exception.dart';
import '../utils/duplicate_scan_exception.dart';

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
      // ── Structured 409: cross-session duplicate scan ──────────────────────
      // The backend returns { success: false, message: "...", conflicts: [...] }
      // when one or more students are already present in another active session.
      if (e.response?.statusCode == 409) {
        final data = e.response?.data;
        if (data is Map<String, dynamic>) {
          final rawConflicts = data['conflicts'];
          if (rawConflicts is List && rawConflicts.isNotEmpty) {
            final conflicts = rawConflicts
                .whereType<Map<String, dynamic>>()
                .map(DuplicateScanConflict.fromJson)
                .toList();
            throw DuplicateScanException(
              message:   data['message'] as String? ?? 'Duplicate scan detected.',
              conflicts: conflicts,
            );
          }
          // 409 without conflicts list — treat as a regular conflict error.
          throw ApiException(
            data['message'] as String? ?? 'Conflict: cannot submit attendance.',
          );
        }
      }
      // ─────────────────────────────────────────────────────────────────────
      throw ApiException.fromDioException(e);
    } catch (e) {
      if (e is ApiException || e is DuplicateScanException) rethrow;
      throw ApiException(e.toString());
    }
  }
}

