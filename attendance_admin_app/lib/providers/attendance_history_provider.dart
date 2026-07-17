import 'package:flutter/foundation.dart';
import '../models/attendance_session_model.dart';
import '../models/attendance_record_model.dart';
import '../repositories/attendance_query_repository.dart';

class AttendanceHistoryProvider with ChangeNotifier {
  final AttendanceQueryRepository _queryRepository;

  final List<AttendanceSessionModel> _sessions = [];
  final Map<String, List<AttendanceRecordModel>> _recordsCache = {};
  final Map<String, Future<List<AttendanceRecordModel>>> _inFlightRecordFetches = {};

  bool _isLoadingSessions = false;
  bool _isLoadingRecords = false;
  String? _errorMessage;
  
  // Pagination State
  int _currentPage = 1;
  bool _hasMore = true;

  // Filter State
  Map<String, dynamic> _activeFilters = {};

  // Getters
  List<AttendanceSessionModel> get sessions => List.unmodifiable(_sessions);
  bool get isLoadingSessions => _isLoadingSessions;
  bool get isLoadingRecords => _isLoadingRecords;
  String? get errorMessage => _errorMessage;
  bool get hasMore => _hasMore;
  Map<String, dynamic> get activeFilters => Map.unmodifiable(_activeFilters);

  AttendanceHistoryProvider(this._queryRepository);

  /// Sets new filters and forces a refresh
  void applyFilters(Map<String, dynamic> filters) {
    _activeFilters = Map.from(filters);
    fetchSessions(refresh: true);
  }

  /// Fetches paginated sessions. If refresh is true, clears current list.
  Future<void> fetchSessions({bool refresh = false}) async {
    if (refresh) {
      _currentPage = 1;
      _sessions.clear();
      _hasMore = true;
      _errorMessage = null;
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
      );

      _sessions.addAll(response.sessions);
      
      final int totalPages = response.meta['totalPages'] as int? ?? 1;
      if (_currentPage >= totalPages) {
        _hasMore = false;
      } else {
        _currentPage++;
      }
      
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoadingSessions = false;
      notifyListeners();
    }
  }

  /// Retrieves records for a session, checking cache first to minimize network calls.
  Future<List<AttendanceRecordModel>> fetchRecordsForSession(String sessionId, {bool forceRefresh = false}) async {
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

  Future<List<AttendanceRecordModel>> _fetchRecordsForSession(String sessionId) async {
    _isLoadingRecords = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final records = await _queryRepository.getSessionRecords(sessionId);
      _recordsCache[sessionId] = records;
      return records;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      return [];
    } finally {
      _isLoadingRecords = false;
      notifyListeners();
    }
  }

  void clearHistory() {
    _sessions.clear();
    _recordsCache.clear();
    _currentPage = 1;
    _hasMore = true;
    _errorMessage = null;
    notifyListeners();
  }
}
