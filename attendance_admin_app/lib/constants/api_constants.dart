
class ApiConstants {
  // Auth Endpoints
  static const String login = '/auth/login';
  static const String me = '/auth/me';
  static const String changePassword = '/auth/password';

  // Session Endpoints
  static const String sessions = '/sessions';
  static const String activeSession = '/sessions/active';
  static String sessionRecords(String id) => '/sessions/$id/records';
  static const String sessionTemplates = '/sessions/templates';
  static String joinSessionTemplate(String id) => '/sessions/templates/$id/join';

  // Master Data Endpoints
  static const String students = '/students';
  static const String studentScanMap = '/students/scan-map';

  static const String placementSessions = '/placement/sessions';
  static const String placementParseExcel = '/placement/parse-excel';
  static const String placementFaculty = '/placement/faculty';
  static String placementSessionById(String id) => '/placement/sessions/$id';
  static String placementSessionStart(String id) => '/placement/sessions/$id/start';
  static String placementSessionStudents(String id) => '/placement/sessions/$id/students';
  static String placementSessionAttendance(String id) => '/placement/sessions/$id/attendance';
  static String placementSessionFinalize(String id) => '/placement/sessions/$id/finalize';
  static String placementSessionReport(String id) => '/placement/sessions/$id/report';
  static String placementSessionReportExcel(String id) => '/placement/sessions/$id/report/excel';
}
