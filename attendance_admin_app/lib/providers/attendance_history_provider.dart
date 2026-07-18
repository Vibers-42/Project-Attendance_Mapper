import 'package:flutter/foundation.dart';
import '../models/attendance_session_model.dart';
import '../models/attendance_record_model.dart';
import '../repositories/attendance_query_repository.dart';

class AttendanceHistoryProvider with ChangeNotifier {
  final AttendanceQueryRepository _queryRepository;

  // ── Filtered history list (used by ViewAttendanceScreen) ────────────────────
  final List<AttendanceSessionModel> _sessions = [];
  bool _isLoadingSessions = false;
  String? _errorMessage;
  int _currentPage = 1;
  bool _hasMore = true;
  Map<String, dynamic> _activeFilters = {};

  // ── Unfiltered recent list (used by FacultyWorkspaceScreen) ─────────────────
  final List<AttendanceSessionModel> _recentSessions = [];
  bool _isLoadingRecent = false;

  // ── Record cache ─────────────────────────────────────────────────────────────
  final Map<String, List<AttendanceRecordModel>> _recordsCache = {};
  final Map<String, Future<List<AttendanceRecordModel>>> _inFlightRecordFetches = {};
  bool _isLoadingRecords = false;
  String? _recordsErrorMessage;

  // ── Getters ───────────────────────────────────────────────────────────────────
  List<AttendanceSessionModel> get sessions => List.unmodifiable(_sessions);
  List<AttendanceSessionModel> get recentSessions => List.unmodifiable(_recentSessions);
  bool get isLoadingSessions => _isLoadingSessions;
  bool get isLoadingRecent => _isLoadingRecent;
  bool get isLoadingRecords => _isLoadingRecords;
  String? get errorMessage => _errorMessage;
  String? get recordsErrorMessage => _recordsErrorMessage;
  bool get hasMore => _hasMore;
  Map<String, dynamic> get activeFilters => Map.unmodifiable(_activeFilters);

  AttendanceHistoryProvider(this._queryRepository);

  // ── Recent sessions (no filters, always fresh) ───────────────────────────────

  Future<void> fetchRecentSessions() async {
    if (_isLoadingRecent) return;
    _isLoadingRecent = true;
    notifyListeners();
    try {
      final response = await _queryRepository.getSessions(page: 1, limit: 5);
      _recentSessions
        ..clear()
        ..addAll(response.sessions);
    } catch (_) {
      // Silently fail — workspace recent list is best-effort
    } finally {
      _isLoadingRecent = false;
      notifyListeners();
    }
  }

  // ── Filtered history ──────────────────────────────────────────────────────────

  void applyFilters(Map<String, dynamic> filters) {
    _activeFilters = Map.from(filters);
    fetchSessions(refresh: true);
  }

  Future<void> fetchSessions({bool refresh = false}) async {
    if (refresh) {
      _currentPage = 1;
      _hasMore = true;
      _errorMessage = null;
      _isLoadingSessions = false;
      // Don't clear _sessions here — keep showing stale data while fetching
    }

    if (!_hasMore || _isLoadingSessions) return;

    _isLoadingSessions = true;
    notifyListeners();

    try {
      final response = await _queryRepository.getSessions(
        page: _currentPage,
        limit: 15,
        status: _activeFilters['status'] as String?,
        roomId: _activeFilters['roomId'] as String?,
        startDate: _activeFilters['startDate'] as String?,
        endDate: _activeFilters['endDate'] as String?,
        year: _activeFilters['year'] as String?,
        subject: _activeFilters['subject'] as String?,
      );

      if (refresh) {
        // Atomic swap: replace list only once new data arrives
        _sessions
          ..clear()
          ..addAll(response.sessions);
        _currentPage = 2;
      } else {
        _sessions.addAll(response.sessions);
        _currentPage++;
      }

      final int totalPages = response.meta['totalPages'] as int? ?? 1;
      _hasMore = _currentPage <= totalPages;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoadingSessions = false;
      notifyListeners();
    }
  }

  // Silent refresh: updates data in background without showing a spinner.
  // Used on screen re-entry when cached data already exists.
  Future<void> silentRefresh() async {
    if (_isLoadingSessions) return;
    try {
      final response = await _queryRepository.getSessions(
        page: 1,
        limit: 15,
        status: _activeFilters['status'] as String?,
        roomId: _activeFilters['roomId'] as String?,
        startDate: _activeFilters['startDate'] as String?,
        endDate: _activeFilters['endDate'] as String?,
        year: _activeFilters['year'] as String?,
        subject: _activeFilters['subject'] as String?,
      );
      _sessions
        ..clear()
        ..addAll(response.sessions);
      _currentPage = 2;
      final totalPages = response.meta['totalPages'] as int? ?? 1;
      _hasMore = _currentPage <= totalPages;
      _errorMessage = null;
      notifyListeners();
    } catch (_) {
      // Keep existing data visible on failure — do nothing
    }
  }

  // ── Record fetching ───────────────────────────────────────────────────────────

  Future<List<AttendanceRecordModel>> fetchRecordsForSession(
      String sessionId, {bool forceRefresh = false}) async {
    if (!forceRefresh && _recordsCache.containsKey(sessionId)) {
      return _recordsCache[sessionId]!;
    }
    if (!forceRefresh && _inFlightRecordFetches.containsKey(sessionId)) {
      return _inFlightRecordFetches[sessionId]!;
    }
    final fetchFuture = _fetchRecordsForSession(sessionId);
    _inFlightRecordFetches[sessionId] = fetchFuture;
    try {
      return await fetchFuture;
    } finally {
      _inFlightRecordFetches.remove(sessionId);
    }
  }

  Future<List<AttendanceRecordModel>> _fetchRecordsForSession(
      String sessionId) async {
    _isLoadingRecords = true;
    _recordsErrorMessage = null;
    notifyListeners();
    try {
      final records = await _queryRepository.getSessionRecords(sessionId);
      _recordsCache[sessionId] = records;
      return records;
    } catch (e) {
      _recordsErrorMessage = e.toString().replaceAll('Exception: ', '');
      return [];
    } finally {
      _isLoadingRecords = false;
      notifyListeners();
    }
  }

  void clearHistory() {
    _sessions.clear();
    _recentSessions.clear();
    _recordsCache.clear();
    _currentPage = 1;
    _hasMore = true;
    _errorMessage = null;
    _recordsErrorMessage = null;
    notifyListeners();
  }
}
