import 'package:flutter/foundation.dart';

class AppLogger {
  static void info(String message) {
    if (kDebugMode) {
      debugPrint('ℹ️ INFO: $message');
    }
  }

  static void warning(String message) {
    if (kDebugMode) {
      debugPrint('⚠️ WARNING: $message');
    }
  }

  static void error(String message, [dynamic error, StackTrace? stackTrace]) {
    if (kDebugMode) {
      debugPrint('❌ ERROR: $message');
      if (error != null) debugPrint(error.toString());
      if (stackTrace != null) debugPrint(stackTrace.toString());
    }
    // Future: Route to Crashlytics or Sentry here
    // FirebaseCrashlytics.instance.recordError(error, stackTrace, reason: message);
  }
}
