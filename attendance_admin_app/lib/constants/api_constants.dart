
class ApiConstants {
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
  static const String studentScanMap = '/students/scan-map';
}
