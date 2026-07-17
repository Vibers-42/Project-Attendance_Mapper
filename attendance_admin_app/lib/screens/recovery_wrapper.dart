import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/attendance_provider.dart';
import '../services/session_recovery_service.dart';
import 'faculty_workspace_screen.dart';

class RecoveryWrapper extends StatefulWidget {
  const RecoveryWrapper({super.key});

  @override
  State<RecoveryWrapper> createState() => _RecoveryWrapperState();
}

class _RecoveryWrapperState extends State<RecoveryWrapper> {
  bool _wasRecovered = false;

  @override
  void initState() {
    super.initState();
    _checkRecovery();
  }

  Future<void> _checkRecovery() async {
    final recoveryService = Provider.of<SessionRecoveryService>(context, listen: false);
    final result = await recoveryService.attemptRecovery();

    if (!mounted) return;

    if (result.state == RecoveryState.recovered && result.data != null) {
      final attendanceProvider = Provider.of<AttendanceProvider>(context, listen: false);
      attendanceProvider.restoreSession(result.data!);
      
      setState(() {
        _wasRecovered = true;
      });

      // Show brief success and navigate to scanner
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              Icon(Icons.restore, color: Colors.white),
              SizedBox(width: 8),
              Text('Attendance session recovered.'),
            ],
          ),
          backgroundColor: Colors.green,
          duration: Duration(seconds: 2),
        ),
      );

      // The Snackbar will persist across the screen transition automatically.
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const FacultyWorkspaceScreen()),
        );
      }
    } else {
      // invalid or none
      if (result.state == RecoveryState.invalid) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Invalid or expired offline session discarded.'),
            backgroundColor: Colors.orange,
            duration: Duration(seconds: 3),
          ),
        );
      }
      
      setState(() {
        _wasRecovered = false;
      });
      
      // Navigate to normal dashboard
      if (mounted) {
        Navigator.of(context).pushReplacementNamed('/workspace');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 24),
            Text(
              _wasRecovered ? 'Restoring session...' : 'Checking for active sessions...',
              style: const TextStyle(fontSize: 16, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}
