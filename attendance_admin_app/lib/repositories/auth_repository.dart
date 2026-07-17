import 'dart:convert';
import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../models/auth_response_model.dart';
import '../models/faculty_model.dart';
import '../services/api_service.dart';
import '../services/secure_storage_service.dart';
import '../utils/api_exception.dart';

class AuthRepository {
  final ApiService _apiService;
  final SecureStorageService _storageService;

  AuthRepository(this._apiService, this._storageService);

  /// Returns true if a JWT token is currently stored in secure storage.
  /// Used by AuthProvider to skip the /me request on cold boot if no token exists.
  Future<bool> hasToken() async {
    final token = await _storageService.getToken();
    return token != null && token.isNotEmpty;
  }

  Future<FacultyModel?> getCachedUser() async {
    final userJsonStr = await _storageService.getUser();
    if (userJsonStr == null || userJsonStr.isEmpty) return null;
    try {
      final userMap = jsonDecode(userJsonStr) as Map<String, dynamic>;
      return FacultyModel.fromJson(userMap);
    } catch (e) {
      return null; // Ignore parse errors on cached data
    }
  }

  Future<FacultyModel> login(String facultyId, String password) async {
    try {
      final response = await _apiService.client.post(
        ApiConstants.login,
        data: {
          'facultyId': facultyId,
          'password': password,
        },
      );

      final authResponse = AuthResponseModel.fromJson(response.data);

      if (authResponse.success && authResponse.data != null) {
        final token = authResponse.data!['token'] as String;
        final facultyJson = authResponse.data!['faculty'] as Map<String, dynamic>;

        await _storageService.saveToken(token);
        await _storageService.saveUser(jsonEncode(facultyJson));
        
        return FacultyModel.fromJson(facultyJson);
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

  Future<FacultyModel> getMe() async {
    try {
      final response = await _apiService.client.get(ApiConstants.me);
      final authResponse = AuthResponseModel.fromJson(response.data);

      if (authResponse.success && authResponse.data != null) {
        final facultyJson = authResponse.data!['faculty'] as Map<String, dynamic>;
        
        await _storageService.saveUser(jsonEncode(facultyJson));
        return FacultyModel.fromJson(facultyJson);
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

  Future<void> changePassword(String currentPassword, String newPassword) async {
    try {
      final response = await _apiService.client.put(
        ApiConstants.changePassword,
        data: {
          'currentPassword': currentPassword,
          'newPassword': newPassword,
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

  Future<void> logout() async {
    await _storageService.deleteToken();
    await _storageService.deleteUser();
  }
}
