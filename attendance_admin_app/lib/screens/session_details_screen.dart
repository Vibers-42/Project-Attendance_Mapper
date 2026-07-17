import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/attendance_session_model.dart';
import '../models/attendance_record_model.dart';
import '../providers/attendance_history_provider.dart';

class SessionDetailsScreen extends StatefulWidget {
  const SessionDetailsScreen({super.key});

  @override
  State<SessionDetailsScreen> createState() => _SessionDetailsScreenState();
}

class _SessionDetailsScreenState extends State<SessionDetailsScreen> {
  bool _initialized = false;
  late AttendanceSessionModel _session;
  late Future<List<AttendanceRecordModel>> _recordsFuture;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_initialized) {
      _session = ModalRoute.of(context)!.settings.arguments as AttendanceSessionModel;
      // Capture the future once so rebuilds don't re-trigger network calls.
      _recordsFuture = Provider.of<AttendanceHistoryProvider>(context, listen: false)
          .fetchRecordsForSession(_session.id);
      _initialized = true;
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'SUBMITTED': return Colors.green;
      case 'PENDING': return Colors.orange;
      case 'IN_PROGRESS': return Colors.blue;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dateStr = DateFormat('dd MMM yyyy, hh:mm a').format(_session.date.toLocal());

    return Scaffold(
      appBar: AppBar(
        title: const Text('Session Details'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Header Card
            Card(
              margin: const EdgeInsets.all(16),
              elevation: 4,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Room ${_session.roomId ?? 'N/A'}', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
                        Chip(
                          label: Text(_session.status, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          backgroundColor: _getStatusColor(_session.status),
                        ),
                      ],
                    ),
                    const Divider(height: 32),
                    _DetailRow(icon: Icons.calendar_today, label: 'Date', value: dateStr),
                    const SizedBox(height: 12),
                    _DetailRow(icon: Icons.person, label: 'Lab Incharge', value: _session.labIncharge ?? 'N/A'),
                    const SizedBox(height: 12),
                    _DetailRow(icon: Icons.group, label: 'Present Students', value: '${_session.attendanceCount}'),
                  ],
                ),
              ),
            ),
            
            // Records List Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
              child: Text(
                'Scanned Records',
                style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
            ),
            
            // Records List
            Expanded(
              child: FutureBuilder<List<AttendanceRecordModel>>(
                future: _recordsFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (snapshot.hasError) {
                    return Center(child: Text('Error loading records', style: TextStyle(color: theme.colorScheme.error)));
                  }

                  final records = snapshot.data ?? [];

                  if (records.isEmpty) {
                    return Center(
                      child: Text('No students scanned for this session.', style: TextStyle(color: Colors.grey.shade600)),
                    );
                  }

                  return ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                    itemCount: records.length,
                    separatorBuilder: (context, index) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final record = records[index];
                      final scanTime = DateFormat('hh:mm:ss a').format(record.timestamp.toLocal());
                      
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: theme.colorScheme.primaryContainer,
                          child: Text('${index + 1}', style: TextStyle(color: theme.colorScheme.onPrimaryContainer, fontSize: 12)),
                        ),
                        title: Text(record.studentRollNumber, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        trailing: Text(scanTime, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 20, color: Colors.grey.shade600),
        const SizedBox(width: 12),
        Text('$label:', style: TextStyle(color: Colors.grey.shade600, fontSize: 15)),
        const SizedBox(width: 8),
        Expanded(
          child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15), overflow: TextOverflow.ellipsis),
        ),
      ],
    );
  }
}
