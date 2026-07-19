import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Stores and resolves the backend base URL.
/// For production, this points to the hosted backend.
/// Admins can override it from the account screen; the override persists across restarts.
class ApiConfigService with ChangeNotifier {
  static const _storageKey = 'api_base_url';

  // Set this to the hosted URL once deployed.
  // Can also be overridden at build time: --dart-define=BACKEND_URL=https://...
  static const _defaultUrl = String.fromEnvironment(
    'BACKEND_URL',
    defaultValue: 'https://attendancemapper-backend.onrender.com/api/v1',
  );

  final SharedPreferences _prefs;
  String _baseUrl = '';

  ApiConfigService(this._prefs);

  String get baseUrl => _baseUrl;

  Future<void> init() async {
    final saved = _prefs.getString(_storageKey);
    _baseUrl = saved ?? _defaultUrl;
  }

  Future<void> setBaseUrl(String url) async {
    _baseUrl = _normalize(url);
    await _prefs.setString(_storageKey, _baseUrl);
    notifyListeners();
  }

  void resetToDefault() {
    _baseUrl = _defaultUrl;
    _prefs.remove(_storageKey);
    notifyListeners();
  }

  String _normalize(String url) {
    var t = url.trim();
    if (t.endsWith('/')) t = t.substring(0, t.length - 1);
    if (!t.contains('/api/v1')) {
      t = t.endsWith('/api') ? '$t/v1' : '$t/api/v1';
    }
    return t;
  }
}
