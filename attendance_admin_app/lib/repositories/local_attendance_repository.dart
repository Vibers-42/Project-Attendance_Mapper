import 'package:hive/hive.dart';

class LocalAttendanceRepository {
  final Box _box = Hive.box('attendanceBox');

  Map<String, dynamic>? restoreAttendance() {
    final sessionId = _box.get('sessionId');
    if (sessionId != null) {
      final dateMillis = _box.get('date');
      DateTime? date;
      if (dateMillis != null) {
        date = DateTime.fromMillisecondsSinceEpoch(dateMillis);
      }
      
      List<String> scannedStudents = [];
      final savedStudents = _box.get('scannedStudents') as List<dynamic>?;
      if (savedStudents != null) {
        scannedStudents = savedStudents.cast<String>();
      }

      return {
        'sessionId': sessionId,
        'professorName': _box.get('professorName'),
        'year': _box.get('year'),
        'roomNumber': _box.get('roomNumber'),
        'date': date,
        'subject': _box.get('subject'),
        'sessionTime': _box.get('sessionTime'),
        'labIncharge': _box.get('labIncharge'),
        'scannedStudents': scannedStudents,
        'lastScanned': _box.get('lastScanned'),
      };
    }
    return null;
  }

  void startNewSession({
    required String sessionId,
    required String professorName,
    required String? year,
    required String roomNumber,
    required DateTime date,
    required String? subject,
    required String? sessionTime,
    required String labIncharge,
  }) {
    _box.put('sessionId', sessionId);
    _box.put('professorName', professorName);
    _box.put('year', year);
    _box.put('roomNumber', roomNumber);
    _box.put('date', date.millisecondsSinceEpoch);
    _box.put('subject', subject);
    _box.put('sessionTime', sessionTime);
    _box.put('labIncharge', labIncharge);
    _box.put('scannedStudents', <String>[]);
    _box.delete('lastScanned');
  }

  void saveValidStudents(Map<String, String> validStudents) {
    _box.put('validStudents', validStudents);
  }

  Map<String, String> loadValidStudents() {
    final stored = _box.get('validStudents');
    if (stored is Map) {
      return stored.map((key, value) => MapEntry(key.toString(), value.toString()));
    }
    return {};
  }

  bool saveAttendanceLocally({
    required String rollNumber,
    required List<String> currentList,
  }) {
    final formattedRoll = rollNumber.trim().toUpperCase();
    if (formattedRoll.isEmpty) return false;
    
    if (currentList.contains(formattedRoll)) {
      return false; // Duplicate
    }

    currentList.insert(0, formattedRoll);
    _box.put('scannedStudents', currentList);
    _box.put('lastScanned', formattedRoll);
    
    return true;
  }

  void deleteAttendance({
    required String rollNumber,
    required List<String> currentList,
    required String? currentLastScanned,
    required Function(String? newLastScanned) onUpdate,
  }) {
    if (currentList.remove(rollNumber)) {
      String? newLastScanned = currentLastScanned;
      if (currentLastScanned == rollNumber) {
        newLastScanned = currentList.isNotEmpty ? currentList.first : null;
      }
      
      _box.put('scannedStudents', currentList);
      _box.put('lastScanned', newLastScanned);
      
      onUpdate(newLastScanned);
    }
  }

  void clearAttendance() {
    _box.clear();
  }
}
