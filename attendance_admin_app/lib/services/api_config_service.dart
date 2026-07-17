import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:shared_preferences/shared_preferences.dart';

/// Resolves and persists the backend base URL.
/// Priority: dart-define BASE_URL > saved preference > platform default.
class ApiConfigService {
  static const _storageKey = 'api_base_url';

  final SharedPreferences _prefs;
  String _baseUrl = '';

  ApiConfigService(this._prefs);

  String get baseUrl => _baseUrl;

  Future<void> init() async {
    // Force the default IP address to ignore any previously cached SharedPreferences 
    // that might be stuck on 10.0.2.2
    _baseUrl = _defaultForPlatform();
  }

  Future<void> setBaseUrl(String url) async {
    _baseUrl = _normalize(url);
    await _prefs.setString(_storageKey, _baseUrl);
  }

  String _defaultForPlatform() {
    if (kIsWeb) {
      return 'http://localhost:3000/api/v1';
    }
    if (Platform.isAndroid) {
      // Use the PC's actual local Wi-Fi IP address so physical mobile phones can connect
      return 'http://192.168.1.10:3000/api/v1';
    }
    if (Platform.isIOS) {
      return 'http://127.0.0.1:3000/api/v1';
    }
    return 'http://localhost:3000/api/v1';
  }

  String _normalize(String url) {
    var trimmed = url.trim();
    if (trimmed.endsWith('/')) {
      trimmed = trimmed.substring(0, trimmed.length - 1);
    }
    if (!trimmed.endsWith('/api/v1')) {
      if (trimmed.endsWith('/api')) {
        trimmed = '$trimmed/v1';
      } else if (!trimmed.contains('/api/v1')) {
        trimmed = '$trimmed/api/v1';
      }
    }
    return trimmed;
  }

  /// Human-readable hint shown when connection fails.
  String get connectionHint {
    if (kIsWeb) {
      return 'Ensure the backend is running on port 3000.';
    }
    if (Platform.isAndroid) {
      return 'Emulator: use http://10.0.2.2:3000/api/v1. '
          'Physical phone: use http://YOUR_PC_IP:3000/api/v1 (same Wi-Fi).';
    }
    return 'Use http://127.0.0.1:3000/api/v1 on simulator, or your PC IP on a physical device.';
  }
}
