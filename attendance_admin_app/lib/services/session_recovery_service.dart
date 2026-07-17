import '../repositories/local_attendance_repository.dart';

enum RecoveryState {
  none,
  recovered,
  invalid,
}

class SessionRecoveryResult {
  final RecoveryState state;
  final Map<String, dynamic>? data;

  SessionRecoveryResult(this.state, {this.data});
}

class SessionRecoveryService {
  final LocalAttendanceRepository _localRepository;

  SessionRecoveryService(this._localRepository);

  /// Checks for any active session data in Hive and validates it.
  Future<SessionRecoveryResult> attemptRecovery() async {
    // Simulate a brief delay to show loading state (can be removed later)
    await Future.delayed(const Duration(milliseconds: 500));

    final data = _localRepository.restoreAttendance();

    if (data == null) {
      return SessionRecoveryResult(RecoveryState.none);
    }

    final String? sessionId = data['sessionId'];
    if (sessionId == null || sessionId.isEmpty) {
      _localRepository.clearAttendance(); // Cleanup corrupted data
      return SessionRecoveryResult(RecoveryState.invalid);
    }

    // Future enhancement: validate session expiration or query backend for reconciliation.
    // For now, if we have a sessionId, we assume it's valid to recover locally.

    return SessionRecoveryResult(RecoveryState.recovered, data: data);
  }
}
