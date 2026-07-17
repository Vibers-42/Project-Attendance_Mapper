import 'package:flutter/material.dart';
import '../models/faculty_model.dart';
import '../repositories/auth_repository.dart';
import '../utils/app_logger.dart';

class AuthProvider extends ChangeNotifier {
  final AuthRepository _authRepository;

  FacultyModel? _currentUser;
  bool _isLoading = true;
  String? _errorMessage;

  AuthProvider(this._authRepository) {
    checkAuthStatus();
  }

  FacultyModel? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  /// Checks if a valid session exists on app startup.
  /// PERFORMANCE FIX: First checks for a saved token in secure storage.
  /// If no token exists, immediately marks loading as complete without
  /// making a network call. This eliminates the visible loading spinner
  /// and wasted network request on every cold boot.
  Future<void> checkAuthStatus() async {
    _setLoading(true);
    try {
      // Token-first check: skip network call if there's nothing stored.
      final hasToken = await _authRepository.hasToken();
      if (!hasToken) {
        _currentUser = null;
        AppLogger.info('[AuthProvider] No stored token. Skipping /me request.');
        return;
      }

      AppLogger.info('[AuthProvider] Stored token found. Verifying session...');
      _currentUser = await _authRepository.getMe();
      _errorMessage = null;
      AppLogger.info('[AuthProvider] Session restored for: ${_currentUser?.facultyId}');
    } catch (e) {
      _currentUser = null;
      AppLogger.warning('[AuthProvider] Session check failed: $e');
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> login(String facultyId, String password) async {
    _setLoading(true);
    _errorMessage = null;

    try {
      AppLogger.info('[AuthProvider] Login attempt for facultyId: $facultyId');
      _currentUser = await _authRepository.login(facultyId, password);
      AppLogger.info('[AuthProvider] Login successful for: $facultyId');
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      AppLogger.warning('[AuthProvider] Login failed: $_errorMessage');
      notifyListeners();
      return false;
    } finally {
      _setLoading(false);
    }
  }

  Future<void> logout() async {
    AppLogger.info('[AuthProvider] Logging out: ${_currentUser?.facultyId}');
    await _authRepository.logout();
    _currentUser = null;
    _errorMessage = null;
    notifyListeners();
  }

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }
}
