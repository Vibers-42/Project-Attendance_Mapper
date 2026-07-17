import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  final FlutterSecureStorage _storage;

  SecureStorageService() : _storage = const FlutterSecureStorage();

  static const String _keyToken = 'jwt_token';
  static const String _keyUser = 'cached_user';

  Future<void> saveToken(String token) async {
    await _storage.write(key: _keyToken, value: token);
  }

  Future<String?> getToken() async {
    return await _storage.read(key: _keyToken);
  }

  Future<void> deleteToken() async {
    await _storage.delete(key: _keyToken);
  }

  Future<void> saveUser(String userJson) async {
    await _storage.write(key: _keyUser, value: userJson);
  }

  Future<String?> getUser() async {
    return await _storage.read(key: _keyUser);
  }

  Future<void> deleteUser() async {
    await _storage.delete(key: _keyUser);
  }

  Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
