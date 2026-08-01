import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import '../models/placement_session_model.dart';
import '../models/placement_student_model.dart';
import '../models/placement_attendance_entry.dart';
import '../models/placement_report_model.dart';
import '../models/faculty_model.dart';
import '../repositories/placement_repository.dart';
import '../repositories/local_placement_repository.dart';
import '../utils/api_exception.dart';

class PlacementPermissionEntry {
  final FacultyModel faculty;
  final String role;

  const PlacementPermissionEntry({required this.faculty, required this.role});

  PlacementPermissionEntry withRole(String newRole) =>
      PlacementPermissionEntry(faculty: faculty, role: newRole);
}

class PlacementProvider with ChangeNotifier {
  final PlacementRepository _repository;
  final LocalPlacementRepository _localRepository;

  PlacementProvider(this._repository, this._localRepository);

  // ── Create-session form state ─────────────────────────────────────────────

  bool _isLoading = false;
  bool _isParsingExcel = false;
  String? _errorMessage;

  List<PlacementStudentModel> _parsedStudents = [];
  List<FacultyModel> _availableFaculty = [];
  bool _facultyLoaded = false;
  List<PlacementPermissionEntry> _selectedPermissions = [];

  // ── Sessions list state ───────────────────────────────────────────────────

  List<PlacementSessionModel> _sessions = [];
  bool _isLoadingSessions = false;
  String? _sessionsError;

  // ── Offline scanner state ────────────────────────────────────────────────

  String? _activeScanSessionId;
  Map<String, String> _eligibilityMap = {};
  List<String> _scannedRolls = [];
  String? _lastScanned;
  bool _isLoadingEligibility = false;
  String? _eligibilityLoadError;
  bool _isFinalizing = false;
  String? _finalizeError;

  // ── Report state ──────────────────────────────────────────────────────────

  PlacementReport? _report;
  String? _reportSessionId;
  bool _isLoadingReport = false;
  String? _reportError;
  bool _isDownloadingExcel = false;
  String? _downloadError;
  bool _isDeletingSession = false;

  // ── Virtual scanner state ─────────────────────────────────────────────────

  List<PlacementAttendanceEntry> _virtualStudents = [];
  Timer? _pollingTimer;
  bool _isPollingLoading = false;
  String? _pollingError;

  // ── Getters — form ────────────────────────────────────────────────────────

  bool get isLoading => _isLoading;
  bool get isParsingExcel => _isParsingExcel;
  String? get errorMessage => _errorMessage;
  int get studentCount => _parsedStudents.length;
  bool get hasStudents => _parsedStudents.isNotEmpty;

  List<PlacementStudentModel> get parsedStudents =>
      List.unmodifiable(_parsedStudents);

  List<FacultyModel> get availableFaculty =>
      List.unmodifiable(_availableFaculty);

  List<PlacementPermissionEntry> get selectedPermissions =>
      List.unmodifiable(_selectedPermissions);

  // ── Getters — sessions list ───────────────────────────────────────────────

  List<PlacementSessionModel> get sessions => List.unmodifiable(_sessions);
  bool get isLoadingSessions => _isLoadingSessions;
  String? get sessionsError => _sessionsError;

  // ── Getters — scanner ─────────────────────────────────────────────────────

  int get eligibleCount => _eligibilityMap.length;
  int get scannedCount => _scannedRolls.length;
  int get pendingCount => (eligibleCount - scannedCount).clamp(0, eligibleCount);
  List<String> get scannedRolls => List.unmodifiable(_scannedRolls);
  String? get lastScanned => _lastScanned;
  bool get isLoadingEligibility => _isLoadingEligibility;
  String? get eligibilityLoadError => _eligibilityLoadError;
  bool get isFinalizing => _isFinalizing;
  String? get finalizeError => _finalizeError;

  /// Eligible students not yet scanned (will become Absent on finalization).
  List<PlacementAttendanceEntry> get pendingOfflineStudents {
    return _eligibilityMap.entries
        .where((e) => !_scannedRolls.contains(e.key))
        .map((e) => PlacementAttendanceEntry(
              rollNumber: e.key,
              name: e.value,
              attendanceStatus: 'PENDING',
            ))
        .toList()
      ..sort((a, b) => a.rollNumber.compareTo(b.rollNumber));
  }

  String? getStudentName(String rollNumber) =>
      _eligibilityMap[rollNumber.toUpperCase()];

  // ── Getters — report ─────────────────────────────────────────────────────

  PlacementReport? get report => _report;
  bool get isLoadingReport => _isLoadingReport;
  String? get reportError => _reportError;
  bool get isDownloadingExcel => _isDownloadingExcel;
  String? get downloadError => _downloadError;
  bool get isDeletingSession => _isDeletingSession;

  // ── Getters — virtual scanner ─────────────────────────────────────────────

  List<PlacementAttendanceEntry> get virtualStudents =>
      List.unmodifiable(_virtualStudents);
  List<PlacementAttendanceEntry> get virtualPendingStudents =>
      _virtualStudents.where((s) => s.isPending).toList();
  int get virtualEligibleCount => _virtualStudents.length;
  int get virtualPresentCount => _virtualStudents.where((s) => s.isPresent).length;
  int get virtualPendingCount => _virtualStudents.where((s) => s.isPending).length;
  bool get isPollingLoading => _isPollingLoading;
  String? get pollingError => _pollingError;

  // ── Error helpers ─────────────────────────────────────────────────────────

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  // ── Sessions list ─────────────────────────────────────────────────────────

  Future<void> fetchSessions() async {
    if (_isLoadingSessions) return;
    _isLoadingSessions = true;
    _sessionsError = null;
    notifyListeners();
    try {
      _sessions = await _repository.getSessions();
    } on ApiException catch (e) {
      _sessionsError = e.message;
    } catch (e) {
      _sessionsError = 'Failed to load placement sessions.';
    } finally {
      _isLoadingSessions = false;
      notifyListeners();
    }
  }

  // ── Excel parsing ─────────────────────────────────────────────────────────

  Future<void> parseExcel(String filePath) async {
    _isParsingExcel = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _parsedStudents = await _repository.parseExcel(filePath);
    } on ApiException catch (e) {
      _errorMessage = e.message;
      _parsedStudents = [];
    } catch (e) {
      _errorMessage = 'Failed to parse Excel file.';
      _parsedStudents = [];
    } finally {
      _isParsingExcel = false;
      notifyListeners();
    }
  }

  void clearStudents() {
    _parsedStudents = [];
    notifyListeners();
  }

  // ── Faculty list ──────────────────────────────────────────────────────────

  Future<void> loadFaculty() async {
    if (_facultyLoaded) return;
    try {
      _availableFaculty = await _repository.getFaculty();
      _facultyLoaded = true;
      notifyListeners();
    } catch (e) {
      debugPrint('[PlacementProvider] loadFaculty error: $e');
    }
  }

  // ── Permissions ───────────────────────────────────────────────────────────

  void addPermission(FacultyModel faculty, String role) {
    final already =
        _selectedPermissions.any((p) => p.faculty.id == faculty.id);
    if (already) return;
    _selectedPermissions = [
      ..._selectedPermissions,
      PlacementPermissionEntry(faculty: faculty, role: role),
    ];
    notifyListeners();
  }

  void removePermission(String facultyId) {
    _selectedPermissions =
        _selectedPermissions.where((p) => p.faculty.id != facultyId).toList();
    notifyListeners();
  }

  void updatePermissionRole(String facultyId, String role) {
    _selectedPermissions = _selectedPermissions
        .map((p) => p.faculty.id == facultyId ? p.withRole(role) : p)
        .toList();
    notifyListeners();
  }

  // ── Session creation ──────────────────────────────────────────────────────

  Future<PlacementSessionModel?> createSession({
    required String title,
    required DateTime dateTime,
    String? venue,
    String? attendanceMode,
    required bool startImmediately,
  }) async {
    if (_isLoading) return null;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final data = {
        'title': title,
        'date': dateTime.toIso8601String(),
        'venue': venue,
        'attendanceMode': attendanceMode,
        'status': startImmediately ? 'ACTIVE' : 'DRAFT',
        'students': _parsedStudents.map((s) => s.toJson()).toList(),
        'permissions': _selectedPermissions
            .map((p) => {'facultyId': p.faculty.id, 'role': p.role})
            .toList(),
      };

      final session = await _repository.createSession(data);
      // Invalidate cached sessions so the list screen fetches fresh data.
      _sessions = [];
      _resetFormState();
      return session;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return null;
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
      return null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void _resetFormState() {
    _parsedStudents = [];
    _selectedPermissions = [];
  }

  // ── Scanner ───────────────────────────────────────────────────────────────

  Future<void> initScanner(String sessionId) async {
    _activeScanSessionId = sessionId;
    _eligibilityLoadError = null;
    _isLoadingEligibility = true;
    notifyListeners();

    try {
      _eligibilityMap = await _repository.getEligibilityMap(sessionId);
    } on ApiException catch (e) {
      _eligibilityLoadError = e.message;
      _eligibilityMap = {};
    } catch (_) {
      _eligibilityLoadError = 'Failed to load student list.';
      _eligibilityMap = {};
    } finally {
      _isLoadingEligibility = false;
    }

    _scannedRolls = _localRepository.loadScans(sessionId);
    _lastScanned = _scannedRolls.isNotEmpty ? _scannedRolls.first : null;
    notifyListeners();
  }

  Future<void> retryInitScanner() async {
    if (_activeScanSessionId != null) await initScanner(_activeScanSessionId!);
  }

  /// Returns null on success, or an error message string on failure.
  String? addScan(String rawRollNumber) {
    final roll = rawRollNumber.trim().toUpperCase();
    if (roll.isEmpty) return 'Invalid roll number.';
    if (!_eligibilityMap.containsKey(roll)) return 'Not in eligibility list.';
    if (_scannedRolls.contains(roll)) return 'Already scanned: $roll';

    _scannedRolls = [roll, ..._scannedRolls];
    _lastScanned = roll;
    if (_activeScanSessionId != null) {
      _localRepository.saveScans(_activeScanSessionId!, _scannedRolls);
    }
    notifyListeners();
    return null;
  }

  void removeScan(String rollNumber) {
    final roll = rollNumber.toUpperCase();
    _scannedRolls = _scannedRolls.where((r) => r != roll).toList();
    _lastScanned = _scannedRolls.isNotEmpty ? _scannedRolls.first : null;
    if (_activeScanSessionId != null) {
      _localRepository.saveScans(_activeScanSessionId!, _scannedRolls);
    }
    notifyListeners();
  }

  void resetScannerState() {
    _activeScanSessionId = null;
    _eligibilityMap = {};
    _scannedRolls = [];
    _lastScanned = null;
    _eligibilityLoadError = null;
    notifyListeners();
  }

  /// Atomically submits offline scans, marks all PENDING as ABSENT, and
  /// transitions the session to COMPLETED. Clears all local scanner state.
  Future<bool> finalizeSession(String sessionId, List<String> rollNumbers) async {
    if (_isFinalizing) return false;
    _isFinalizing = true;
    _finalizeError = null;
    notifyListeners();
    try {
      await _repository.finalizeSession(sessionId, rollNumbers);
      _localRepository.clearScans(sessionId);
      stopPolling();
      // Invalidate session list so the detail screen shows COMPLETED status.
      _sessions = [];
      // Reset all scanner state.
      _activeScanSessionId = null;
      _eligibilityMap = {};
      _scannedRolls = [];
      _lastScanned = null;
      _eligibilityLoadError = null;
      _reportSessionId = null;
      _report = null;
      _virtualStudents = [];
      return true;
    } on ApiException catch (e) {
      _finalizeError = e.message;
      return false;
    } catch (_) {
      _finalizeError = 'Failed to finalize session.';
      return false;
    } finally {
      _isFinalizing = false;
      notifyListeners();
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────

  Future<void> loadReport(String sessionId) async {
    if (_reportSessionId == sessionId && _report != null) return;
    _isLoadingReport = true;
    _reportError = null;
    _report = null;
    notifyListeners();
    try {
      _report = await _repository.getReport(sessionId);
      _reportSessionId = sessionId;
    } on ApiException catch (e) {
      _reportError = e.message;
    } catch (_) {
      _reportError = 'Failed to load report.';
    } finally {
      _isLoadingReport = false;
      notifyListeners();
    }
  }

  Future<String?> downloadReportExcel(String sessionId, String sessionTitle) async {
    if (_isDownloadingExcel) return null;
    _isDownloadingExcel = true;
    _downloadError = null;
    notifyListeners();
    try {
      final saveDir = await _getReportSaveDirectory();
      final safeName = sessionTitle
          .replaceAll(RegExp(r'[^\w\s]'), '')
          .trim()
          .replaceAll(RegExp(r'\s+'), '_');
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final filePath = '${saveDir.path}/placement_${safeName}_$timestamp.xlsx';
      await _repository.downloadReportExcel(sessionId, filePath);
      return filePath;
    } on ApiException catch (e) {
      _downloadError = e.message;
      return null;
    } catch (_) {
      _downloadError = 'Failed to download Excel file.';
      return null;
    } finally {
      _isDownloadingExcel = false;
      notifyListeners();
    }
  }

  Future<bool> deleteSession(String sessionId) async {
    if (_isDeletingSession) return false;
    _isDeletingSession = true;
    notifyListeners();
    try {
      await _repository.deleteSession(sessionId);
      _sessions = _sessions.where((s) => s.id != sessionId).toList();
      return true;
    } on ApiException catch (e) {
      debugPrint('[PlacementProvider] deleteSession error: ${e.message}');
      return false;
    } catch (_) {
      return false;
    } finally {
      _isDeletingSession = false;
      notifyListeners();
    }
  }

  Future<Directory> _getReportSaveDirectory() async {
    if (Platform.isIOS) return getApplicationDocumentsDirectory();
    return (await getDownloadsDirectory()) ?? await getApplicationDocumentsDirectory();
  }

  // ── Virtual scanner / polling ─────────────────────────────────────────────

  void startVirtualPolling(String sessionId) {
    stopPolling();
    // Fetch immediately, then every 5 seconds.
    _fetchVirtualStudents(sessionId);
    _pollingTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      _fetchVirtualStudents(sessionId);
    });
  }

  void stopPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }

  Future<void> refreshVirtualStudents(String sessionId) =>
      _fetchVirtualStudents(sessionId);

  Future<void> _fetchVirtualStudents(String sessionId) async {
    if (_isPollingLoading) return;
    _isPollingLoading = true;
    try {
      _virtualStudents = await _repository.getStudentsWithStatus(sessionId);
      _pollingError = null;
    } on ApiException catch (e) {
      _pollingError = e.message;
    } catch (_) {
      _pollingError = 'Failed to refresh attendance.';
    } finally {
      _isPollingLoading = false;
      notifyListeners();
    }
  }
}
