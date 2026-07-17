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

  bool hasScanned(String rollNumber) {
    String normalized = rollNumber.trim().toUpperCase();
    if (_validStudents.isNotEmpty && _validStudents.containsKey(normalized)) {
      normalized = _validStudents[normalized]!;
    }
    return _scannedStudents.contains(normalized);
  }

  // Returns a pattern locked to the session's selected academic year.
  // Second Year  → 25B (regular) or 26B (lateral entry)
  // Third Year   → 24B (regular) or 25B (lateral entry)
  // No year set  → any of 24 / 25 / 26
  // All patterns also enforce: Bachelor's (B), Engineering school (1), AI branch.
  RegExp get _validRollPattern {
    switch (_year) {
      case 'Second Year':
        return RegExp(r'^(25|26)B[1-7]1AI\d{3}$');
      case 'Third Year':
        return RegExp(r'^(24|25)B[1-7]1AI\d{3}$');
      default:
        return RegExp(r'^(24|25|26)B[1-7]1AI\d{3}$');
    }
  }

  /// Returns null on success, or an error message on failure
  String? addStudent(String rawInput) {
    String normalized = rawInput.trim().toUpperCase();

    // Client-side validation against Master Data
    if (_validStudents.isNotEmpty) {
      if (!_validStudents.containsKey(normalized)) {
        return 'Student not registered in Master Data.';
      }
      // Map barcode to actual roll number
      normalized = _validStudents[normalized]!;
    }

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
