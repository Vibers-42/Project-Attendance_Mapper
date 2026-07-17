class ApiConstants {
  // Use flutter run --dart-define=BASE_URL=https://prod.example.com/api/v1 to override
  static const String baseUrl = String.fromEnvironment(
    'BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api/v1',
  );

  // Auth Endpoints
  static const String login = '/auth/login';
  static const String me = '/auth/me';
  static const String changePassword = '/auth/password';

  // Session Endpoints
  static const String sessions = '/sessions';
  static const String activeSession = '/sessions/active';
  static String sessionRecords(String id) => '/sessions/$id/records';
}
