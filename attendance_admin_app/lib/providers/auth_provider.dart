import 'package:flutter/material.dart';
import '../models/faculty_model.dart';
import '../repositories/auth_repository.dart';
import '../utils/app_logger.dart';

class AuthProvider extends ChangeNotifier {
  final AuthRepository _authRepository;

  FacultyModel? _currentUser;
  bool _isCheckingAuth = true;
  bool _isLoading = false;
  String? _errorMessage;

  AuthProvider(this._authRepository) {
    checkAuthStatus();
  }

  FacultyModel? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null;
  bool get isCheckingAuth => _isCheckingAuth;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  /// Checks if a valid session exists on app startup.
  /// PERFORMANCE FIX: First checks for a saved token in secure storage.
  /// If no token exists, immediately marks loading as complete without
  /// making a network call. This eliminates the visible loading spinner
  /// and wasted network request on every cold boot.
  Future<void> checkAuthStatus() async {
    _isCheckingAuth = true;
    notifyListeners();
    try {
      // Token-first check: skip network call if there's nothing stored.
      final hasToken = await _authRepository.hasToken();
      if (!hasToken) {
        _currentUser = null;
        AppLogger.info('[AuthProvider] No stored token. Skipping /me request.');
        _isCheckingAuth = false;
        notifyListeners();
        return;
      }

      // Restore user from local cache instantly for zero-latency boot
      final cachedUser = await _authRepository.getCachedUser();
      if (cachedUser != null) {
        _currentUser = cachedUser;
        _isCheckingAuth = false;
        notifyListeners(); // Unblocks AuthWrapper instantly
        AppLogger.info('[AuthProvider] Restored user from cache instantly.');
      }

      AppLogger.info('[AuthProvider] Verifying session with backend in background...');
      // Even if cached, we ping the backend to verify the token hasn't expired.
      // If this fails, the API interceptor or the catch block will clear the session.
      final verifiedUser = await _authRepository.getMe();
      
      if (cachedUser == null) {
        _currentUser = verifiedUser;
        _isCheckingAuth = false;
        notifyListeners();
      }
    } catch (e) {
      _currentUser = null;
      _isCheckingAuth = false;
      notifyListeners();
      AppLogger.warning('[AuthProvider] Session check failed: $e');
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
