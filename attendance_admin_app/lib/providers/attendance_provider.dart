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
    
    _scannedStudents = data['scannedStudents'] ?? [];
    _lastScanned = data['lastScanned'];

    notifyListeners();
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
      final sessionModel = await _sessionRepository.createSession({
        'date': date.toIso8601String(),
        'labIncharge': labIncharge,
        // Assuming string inputs match master data for now, 
        // later UI will send proper UUIDs when Master Data is integrated.
      });

      // 2. Initialize locally with the generated backend sessionId
      _sessionId = sessionModel.id;
      _professorName = professorName;
      _year = year;
      _roomNumber = roomNumber;
      _date = date;
      _subject = subject;
      _sessionTime = sessionTime;
      _labIncharge = labIncharge;

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
    return _scannedStudents.contains(rollNumber.trim().toUpperCase());
  }

  bool addStudent(String rollNumber) {
    bool success = _localRepository.saveAttendanceLocally(
      rollNumber: rollNumber,
      currentList: _scannedStudents,
    );
    
    if (success) {
      _lastScanned = rollNumber.trim().toUpperCase();
      notifyListeners();
      return true;
    }
    return false;
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
    _professorName = null;
    _year = null;
    _roomNumber = null;
    _date = null;
    _subject = null;
    _sessionTime = null;
    _labIncharge = null;
    
    _scannedStudents.clear();
    _lastScanned = null;
    
    notifyListeners();
  }
}
