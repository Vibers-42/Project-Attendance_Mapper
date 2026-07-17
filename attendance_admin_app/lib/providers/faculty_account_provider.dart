import 'package:flutter/foundation.dart';
import '../repositories/auth_repository.dart';

class FacultyAccountProvider with ChangeNotifier {
  final AuthRepository _authRepository;

  bool _isChangingPassword = false;
  String? _passwordError;

  bool get isChangingPassword => _isChangingPassword;
  String? get passwordError => _passwordError;

  FacultyAccountProvider(this._authRepository);

  void _setChangingPassword(bool value) {
    _isChangingPassword = value;
    notifyListeners();
  }

  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    _setChangingPassword(true);
    _passwordError = null;

    try {
      await _authRepository.changePassword(currentPassword, newPassword);
      return true;
    } catch (e) {
      _passwordError = e.toString().replaceAll('Exception: ', '');
      return false;
    } finally {
      _setChangingPassword(false);
    }
  }

  void clearErrors() {
    _passwordError = null;
    notifyListeners();
  }
}
