
class ApiConstants {
  // Use flutter run --dart-define=BASE_URL=https://prod.example.com/api/v1 to override
  static String get baseUrl {
    const fromEnv = String.fromEnvironment('BASE_URL');
    if (fromEnv.isNotEmpty) return fromEnv;

    // Use the PC's actual local Wi-Fi IP address so physical mobile phones can connect
    // IMPORTANT: The mobile phone MUST be on the same Wi-Fi network as the PC!
    return 'http://10.50.79.178:3000/api/v1';
  }

  // Auth Endpoints
  static const String login = '/auth/login';
  static const String me = '/auth/me';
  static const String changePassword = '/auth/password';

  // Session Endpoints
  static const String sessions = '/sessions';
  static const String activeSession = '/sessions/active';
  static String sessionRecords(String id) => '/sessions/$id/records';

  // Master Data Endpoints
  static const String students = '/students';
}
