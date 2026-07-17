import 'package:flutter/material.dart';
import '../models/faculty_model.dart';
import '../repositories/auth_repository.dart';

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

  Future<void> checkAuthStatus() async {
    _setLoading(true);
    try {
      _currentUser = await _authRepository.getMe();
      _errorMessage = null;
    } catch (e) {
      _currentUser = null;
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> login(String facultyId, String password) async {
    _setLoading(true);
    _errorMessage = null;

    try {
      _currentUser = await _authRepository.login(facultyId, password);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      notifyListeners();
      return false;
    } finally {
      _setLoading(false);
    }
  }

  Future<void> logout() async {
    await _authRepository.logout();
    _currentUser = null;
    notifyListeners();
  }

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }
}
