import 'dart:io';
import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../models/placement_session_model.dart';
import '../models/placement_student_model.dart';
import '../models/placement_attendance_entry.dart';
import '../models/placement_report_model.dart';
import '../models/faculty_model.dart';
import '../models/auth_response_model.dart';
import '../services/api_service.dart';
import '../utils/api_exception.dart';

class PlacementRepository {
  final ApiService _apiService;

  PlacementRepository(this._apiService);

  Future<PlacementSessionModel> createSession(Map<String, dynamic> data) async {
    try {
      final response = await _apiService.client.post(
        ApiConstants.placementSessions,
        data: data,
      );
      final authResponse = AuthResponseModel.fromJson(response.data);
      if (authResponse.success && authResponse.dataAsMap != null) {
        final sessionJson =
            authResponse.dataAsMap!['session'] as Map<String, dynamic>;
        return PlacementSessionModel.fromJson(sessionJson);
      }
      throw ApiException(authResponse.message);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<List<PlacementSessionModel>> getSessions() async {
    try {
      final response =
          await _apiService.client.get(ApiConstants.placementSessions);
      final authResponse = AuthResponseModel.fromJson(response.data);
      if (authResponse.success && authResponse.dataAsMap != null) {
        final list =
            authResponse.dataAsMap!['sessions'] as List<dynamic>;
        return list
            .map((e) =>
                PlacementSessionModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      throw ApiException(authResponse.message);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

class PlacementParseResult {
  final List<PlacementStudentModel> students;
  final List<PlacementStudentModel> missingStudents;
  PlacementParseResult(this.students, this.missingStudents);
}

  Future<PlacementParseResult> parseExcel(String filePath) async {
    try {
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(filePath),
      });
      final response = await _apiService.client.post(
        ApiConstants.placementParseExcel,
        data: formData,
        options: Options(contentType: 'multipart/form-data'),
      );
      final authResponse = AuthResponseModel.fromJson(response.data);
      if (authResponse.success && authResponse.dataAsMap != null) {
        final data = authResponse.dataAsMap!;
        final list = data['students'] as List<dynamic>;
        final missingList = data['missingStudents'] != null ? data['missingStudents'] as List<dynamic> : [];
        
        final students = list.map((e) => PlacementStudentModel.fromJson(e as Map<String, dynamic>)).toList();
        final missingStudents = missingList.map((e) => PlacementStudentModel.fromJson(e as Map<String, dynamic>)).toList();
        
        return PlacementParseResult(students, missingStudents);
      }
      throw ApiException(authResponse.message);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<void> addMissingStudents(List<PlacementStudentModel> students) async {
    try {
      final response = await _apiService.client.post(
        ApiConstants.placementAddMissingStudents,
        data: {
          'students': students.map((s) => s.toJson()).toList(),
        },
      );
      final authResponse = AuthResponseModel.fromJson(response.data);
      if (!authResponse.success) {
        throw ApiException(authResponse.message);
      }
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<List<PlacementAttendanceEntry>> getStudentsWithStatus(String sessionId) async {
    try {
      final response = await _apiService.client
          .get(ApiConstants.placementSessionStudents(sessionId));
      final authResponse = AuthResponseModel.fromJson(response.data);
      if (authResponse.success && authResponse.dataAsMap != null) {
        final list = authResponse.dataAsMap!['students'] as List<dynamic>;
        return list
            .map((e) => PlacementAttendanceEntry.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      throw ApiException(authResponse.message);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<Map<String, String>> getEligibilityMap(String sessionId) async {
    try {
      final response = await _apiService.client
          .get(ApiConstants.placementSessionStudents(sessionId));
      final authResponse = AuthResponseModel.fromJson(response.data);
      if (authResponse.success && authResponse.dataAsMap != null) {
        final list = authResponse.dataAsMap!['students'] as List<dynamic>;
        return {
          for (final s in list)
            (s['rollNumber'] as String).toUpperCase(): s['name'] as String,
        };
      }
      throw ApiException(authResponse.message);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<PlacementReport> getReport(String sessionId) async {
    try {
      final response = await _apiService.client
          .get(ApiConstants.placementSessionReport(sessionId));
      final authResponse = AuthResponseModel.fromJson(response.data);
      if (authResponse.success && authResponse.dataAsMap != null) {
        return PlacementReport.fromJson(authResponse.dataAsMap!);
      }
      throw ApiException(authResponse.message);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<void> downloadReportExcel(String sessionId, String savePath) async {
    try {
      final response = await _apiService.client.get(
        ApiConstants.placementSessionReportExcel(sessionId),
        options: Options(responseType: ResponseType.bytes),
      );
      await File(savePath).writeAsBytes(response.data as List<int>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<PlacementSessionModel> startSession(String sessionId) async {
    try {
      final response = await _apiService.client.patch(
        ApiConstants.placementSessionStart(sessionId),
      );
      final authResponse = AuthResponseModel.fromJson(response.data);
      if (authResponse.success && authResponse.dataAsMap != null) {
        return PlacementSessionModel.fromJson(
            authResponse.dataAsMap!['session'] as Map<String, dynamic>);
      }
      throw ApiException(authResponse.message);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<PlacementSessionModel> updateDraft(
    String sessionId,
    Map<String, dynamic> data,
  ) async {
    try {
      final response = await _apiService.client.patch(
        ApiConstants.placementSessionById(sessionId),
        data: data,
      );
      final authResponse = AuthResponseModel.fromJson(response.data);
      if (authResponse.success && authResponse.dataAsMap != null) {
        return PlacementSessionModel.fromJson(
            authResponse.dataAsMap!['session'] as Map<String, dynamic>);
      }
      throw ApiException(authResponse.message);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<void> finalizeSession(String sessionId, List<String> rollNumbers) async {
    try {
      final response = await _apiService.client.post(
        ApiConstants.placementSessionFinalize(sessionId),
        data: {'rollNumbers': rollNumbers},
      );
      final authResponse = AuthResponseModel.fromJson(response.data);
      if (!authResponse.success) throw ApiException(authResponse.message);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<void> deleteSession(String sessionId) async {
    try {
      final response = await _apiService.client.delete(
        ApiConstants.placementSessionById(sessionId),
      );
      final authResponse = AuthResponseModel.fromJson(response.data);
      if (!authResponse.success) throw ApiException(authResponse.message);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<List<FacultyModel>> getFaculty() async {
    try {
      final response =
          await _apiService.client.get(ApiConstants.placementFaculty);
      final authResponse = AuthResponseModel.fromJson(response.data);
      if (authResponse.success && authResponse.dataAsMap != null) {
        final list = authResponse.dataAsMap!['faculty'] as List<dynamic>;
        return list
            .map((e) => FacultyModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      throw ApiException(authResponse.message);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }
}
