import 'package:flutter/foundation.dart';
import '../repositories/local_attendance_repository.dart';
import '../repositories/session_repository.dart';
import '../repositories/attendance_submission_repository.dart';

class AttendanceProvider with ChangeNotifier {
  final LocalAttendanceRepository _localRepository;
  final SessionRepository _sessionRepository;
  final AttendanceSubmissionRepository _submissionRepository;

  List<String> _scannedStudents = [];
  String? _lastScanned;
  
  // Maps barcode -> rollNumber, or rollNumber -> rollNumber for valid students
  Map<String, String> _validStudents = {};

  // Session Details
  String? _sessionId;
  String? _professorName;
  String? _year;
  String? _roomNumber;
  DateTime? _date;
  String? _subject;
  String? _sessionTime;
  String? _labIncharge;

  bool _isLoading = false;
  String? _errorMessage;

  // Getters
  List<String> get scannedStudents => List.unmodifiable(_scannedStudents);
  String? get lastScanned => _lastScanned;
  int get presentCount => _scannedStudents.length;
  bool get hasActiveSession => _sessionId != null;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  String? get sessionId => _sessionId;
  String? get professorName => _professorName;
  String? get year => _year;
  String? get roomNumber => _roomNumber;
  DateTime? get date => _date;
  String? get subject => _subject;
  String? get sessionTime => _sessionTime;
  String? get labIncharge => _labIncharge;

  AttendanceProvider(
    this._localRepository,
    this._sessionRepository,
    this._submissionRepository,
  );

  void restoreSession(Map<String, dynamic> data) {
    _sessionId = data['sessionId'];
    _professorName = data['professorName'];
    _year = data['year'];
    _roomNumber = data['roomNumber'];
    _date = data['date'];
    _subject = data['subject'];
    _sessionTime = data['sessionTime'];
    _labIncharge = data['labIncharge'];
    
    _scannedStudents = List<String>.from(data['scannedStudents'] ?? []);
    _lastScanned = data['lastScanned'];
    _validStudents = _localRepository.loadValidStudents();

    notifyListeners();
    _refreshValidStudents();
  }

  Future<void> _refreshValidStudents() async {
    try {
      final students = await _sessionRepository.getValidStudents();
      if (students.isNotEmpty) {
        _validStudents = students;
        _localRepository.saveValidStudents(students);
        notifyListeners();
      }
    } catch (_) {
      // Keep cached validation map when offline.
    }
  }

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  Future<bool> startSession({
    required String professorName,
    required String? year,
    required String roomNumber,
    required DateTime date,
    required String? subject,
    required String? sessionTime,
    required String labIncharge,
  }) async {
    _setLoading(true);
    _errorMessage = null;

    try {
      // 1. Create session on the backend
      final sessionData = <String, dynamic>{
        'date': date.toIso8601String(),
        if (labIncharge.isNotEmpty) 'labIncharge': labIncharge,
        if (sessionTime != null && sessionTime.isNotEmpty) 'sessionTime': sessionTime,
        if (subject != null && subject.isNotEmpty) 'subject': subject,
        if (year != null && year.isNotEmpty) 'year': year,
        if (roomNumber.isNotEmpty) 'roomNumber': roomNumber,
      };
      final sessionModel = await _sessionRepository.createSession(sessionData);

      // Fetch the valid students for client-side validation
      _validStudents = await _sessionRepository.getValidStudents();
      if (_validStudents.isNotEmpty) {
        _localRepository.saveValidStudents(_validStudents);
      }

      // 2. Initialize locally with the generated backend sessionId
      _sessionId = sessionModel.id;
      _professorName = professorName;
      _year = year;
      _roomNumber = roomNumber;
      _date = date;
      _subject = subject;
      _sessionTime = sessionTime;
      _labIncharge = labIncharge;

      _scannedStudents.clear();
      _lastScanned = null;

      _localRepository.startNewSession(
        sessionId: sessionModel.id,
        professorName: professorName,
        year: year,
        roomNumber: roomNumber,
        date: date,
        subject: subject,
        sessionTime: sessionTime,
        labIncharge: labIncharge,
      );
      
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      return false;
    } finally {
      _setLoading(false);
    }
  }

  /// Updates year/subject/sessionTime/labIncharge on the active session.
  /// Clears scanned students when year changes (old rolls fail new year validation).
  Future<bool> updateSessionDetails({
    String? year,
    String? subject,
    String? sessionTime,
    String? labIncharge,
  }) async {
    if (_sessionId == null) return false;
    _setLoading(true);
    _errorMessage = null;

    try {
      final data = <String, dynamic>{
        if (year != null && year.isNotEmpty) 'year': year,
        if (subject != null && subject.isNotEmpty) 'subject': subject,
        if (sessionTime != null && sessionTime.isNotEmpty)
          'sessionTime': sessionTime,
        if (labIncharge != null && labIncharge.isNotEmpty) 'labIncharge': labIncharge,
      };

      await _sessionRepository.updateSession(_sessionId!, data);

      final yearChanged = year != null && year != _year;
      _year = year ?? _year;
      _subject = subject ?? _subject;
      _sessionTime = sessionTime ?? _sessionTime;
      if (labIncharge != null && labIncharge.isNotEmpty) {
        _labIncharge = labIncharge;
      }

      // Clear scans that no longer pass the new year's roll pattern
      if (yearChanged) {
        _scannedStudents.clear();
        _lastScanned = null;
        _localRepository.clearAttendance();
      }

      _localRepository.startNewSession(
        sessionId: _sessionId!,
        professorName: _professorName ?? '',
        year: _year,
        roomNumber: _roomNumber ?? '',
        date: _date ?? DateTime.now(),
        subject: _subject,
        sessionTime: _sessionTime,
        labIncharge: _labIncharge ?? '',
      );

      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      return false;
    } finally {
      _setLoading(false);
    }
  }

  bool hasScanned(String rollNumber) {
    String normalized = rollNumber.trim().toUpperCase();
    if (_validStudents.isNotEmpty && _validStudents.containsKey(normalized)) {
      normalized = _validStudents[normalized]!;
    }
    return _scannedStudents.contains(normalized);
  }

  // Returns a pattern locked to the session's selected academic year.
  // B1 = regular (entered that year), B[2-7] = lateral entry (one year ahead).
  // 2nd Year → 25B1 (2025 regular) or 26B[2-7] (2026 lateral entry)
  // 3rd Year → 24B1 (2024 regular) or 25B[2-7] (2025 lateral entry)
  // No year set  → any 2nd/3rd year AI roll
  RegExp get _validRollPattern {
    switch (_year) {
      case '2nd Year':
        return RegExp(r'^(25B1|26B[2-7])1AI\d{3}$');
      case '3rd Year':
        return RegExp(r'^(24B1|25B[2-7])1AI\d{3}$');
      default:
        return RegExp(r'^(24B1|25B[1-7]|26B[2-7])1AI\d{3}$');
    }
  }

  /// Returns null on success, or an error message on failure
  String? addStudent(String rawInput) {
    String normalized = rawInput.trim().toUpperCase();

    // Client-side validation against Master Data (always required)
    if (_validStudents.isEmpty) {
      return 'Student data not loaded. Please check connection.';
    }
    if (!_validStudents.containsKey(normalized)) {
      return 'Student not registered.';
    }
    normalized = _validStudents[normalized]!;

    // Branch check first — must be AI branch
    final branchPattern = RegExp(r'^(24|25|26)B[1-7]1AI\d{3}$');
    if (!branchPattern.hasMatch(normalized)) {
      return 'Student not registered.';
    }

    // Year-locked check — gives a specific message on year mismatch
    if (!_validRollPattern.hasMatch(normalized)) {
      return 'Student is not in $_year.';
    }

    if (_scannedStudents.contains(normalized)) {
      return 'Attendance Already Recorded.';
    }

    bool success = _localRepository.saveAttendanceLocally(
      rollNumber: normalized,
      currentList: _scannedStudents,
    );
    
    if (success) {
      _lastScanned = normalized;
      notifyListeners();
      return null;
    }
    return 'Failed to save attendance locally.';
  }

  void removeStudent(String rollNumber) {
    _localRepository.deleteAttendance(
      rollNumber: rollNumber,
      currentList: _scannedStudents,
      currentLastScanned: _lastScanned,
      onUpdate: (newLastScanned) {
        _lastScanned = newLastScanned;
        notifyListeners();
      },
    );
  }

  bool _isSubmitting = false;
  String? _submitError;
  
  bool get isSubmitting => _isSubmitting;
  String? get submitError => _submitError;

  void _setSubmitting(bool value) {
    _isSubmitting = value;
    notifyListeners();
  }

  Future<bool> submitAttendance() async {
    if (_sessionId == null || _scannedStudents.isEmpty) {
      _submitError = 'No active session or students to submit.';
      return false;
    }

    _setSubmitting(true);
    _submitError = null;

    try {
      await _submissionRepository.submitAttendance(_sessionId!, _scannedStudents);
      
      // Strict Offline Guarantee: Only clear Hive if the backend returns success.
      _localRepository.clearAttendance();
      
      _sessionId = null;
      _professorName = null;
      _year = null;
      _roomNumber = null;
      _date = null;
      _subject = null;
      _sessionTime = null;
      _labIncharge = null;
      
      _scannedStudents.clear();
      _lastScanned = null;
      _validStudents.clear();
      
      return true;
    } catch (e) {
      _submitError = e.toString().replaceAll('Exception: ', '');
      return false;
    } finally {
      _setSubmitting(false);
      notifyListeners();
    }
  }

  void discardSession() {
    _localRepository.clearAttendance();
    _sessionId = null;
    _professorName = null;
    _year = null;
    _roomNumber = null;
    _date = null;
    _subject = null;
    _sessionTime = null;
    _labIncharge = null;
    _validStudents.clear();
    
    _scannedStudents.clear();
    _lastScanned = null;
    
    notifyListeners();
  }
}
