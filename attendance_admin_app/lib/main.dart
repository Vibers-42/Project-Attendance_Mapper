import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'utils/app_logger.dart';

import 'providers/auth_provider.dart';
import 'providers/attendance_provider.dart';
import 'providers/attendance_history_provider.dart';
import 'providers/faculty_account_provider.dart';

import 'services/api_service.dart';
import 'services/secure_storage_service.dart';

import 'repositories/auth_repository.dart';
import 'repositories/session_repository.dart';
import 'repositories/attendance_submission_repository.dart';
import 'repositories/attendance_query_repository.dart';
import 'repositories/local_attendance_repository.dart';

import 'services/session_recovery_service.dart';

import 'screens/login_screen.dart';
import 'screens/create_session_screen.dart';
import 'screens/faculty_workspace_screen.dart';
import 'screens/scanner_screen.dart';
import 'screens/manual_entry_screen.dart';
import 'screens/view_attendance_screen.dart';
import 'screens/session_details_screen.dart';
import 'screens/faculty_account_screen.dart';
import 'screens/recovery_wrapper.dart';

void main() async {
  // Capture UI Errors
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    AppLogger.error('Flutter UI Error', details.exception, details.stack);
  };

  // Capture Async/Isolate Errors
  PlatformDispatcher.instance.onError = (error, stack) {
    AppLogger.error('Platform Async Error', error, stack);
    return true; // Prevent default crash behavior in prod
  };

  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Hive
  await Hive.initFlutter();
  await Hive.openBox('attendanceBox');
  
  // Dependency Injection Setup
  final secureStorageService = SecureStorageService();
  final apiService = ApiService(secureStorageService);
  
  final authRepository = AuthRepository(apiService, secureStorageService);
  final sessionRepository = SessionRepository(apiService);
  final submissionRepository = AttendanceSubmissionRepository(apiService);
  final queryRepository = AttendanceQueryRepository(apiService);
  final localRepository = LocalAttendanceRepository();
  
  final recoveryService = SessionRecoveryService(localRepository);
  
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider(authRepository)),
        ChangeNotifierProvider(create: (_) => FacultyAccountProvider(authRepository)),
        Provider.value(value: recoveryService),
        ChangeNotifierProvider(create: (_) => AttendanceProvider(
          localRepository,
          sessionRepository,
          submissionRepository,
        )),
        ChangeNotifierProvider(create: (_) => AttendanceHistoryProvider(queryRepository)),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Attendance Admin',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
        snackBarTheme: SnackBarThemeData(
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          backgroundColor: Colors.grey.shade900,
          contentTextStyle: const TextStyle(color: Colors.white, fontSize: 14),
        ),
      ),
      home: const AuthWrapper(),
      routes: {
        '/login': (context) => const LoginScreen(),
        '/recovery': (context) => const RecoveryWrapper(),
        '/workspace': (context) => const FacultyWorkspaceScreen(),
        '/create_session': (context) => const CreateSessionScreen(),
        '/scanner': (context) => const ScannerScreen(),
        '/manual_entry': (context) => const ManualEntryScreen(),
        '/view_attendance': (context) => const ViewAttendanceScreen(),
        '/session_details': (context) => const SessionDetailsScreen(),
        '/faculty_account': (context) => const FacultyAccountScreen(),
      },
    );
  }
}

/// AuthWrapper handles the auto-login logic and protects routes.
class AuthWrapper extends StatelessWidget {
  const AuthWrapper({super.key});

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    // Show loading screen while checking session on boot
    if (authProvider.isCheckingAuth && !authProvider.isAuthenticated) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    // If authenticated, go to RecoveryWrapper to check for offline sessions
    if (authProvider.isAuthenticated) {
      return const RecoveryWrapper();
    }

    // Otherwise show login
    return const LoginScreen();
  }
}
