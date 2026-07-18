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
  static final _scanTimeFormat = DateFormat('hh:mm:ss a');
  bool _initialized = false;
  late AttendanceSessionModel _session;
  late Future<List<AttendanceRecordModel>> _recordsFuture;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_initialized) {
      _session =
          ModalRoute.of(context)!.settings.arguments as AttendanceSessionModel;
      _recordsFuture =
          Provider.of<AttendanceHistoryProvider>(context, listen: false)
              .fetchRecordsForSession(_session.id);
      _initialized = true;
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'COMPLETED':
      case 'SUBMITTED':
        return Colors.green;
      case 'ACTIVE':
      case 'IN_PROGRESS':
        return Colors.blue;
      case 'CREATED':
      case 'PENDING':
        return Colors.orange;
      case 'CANCELLED':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  Color _statusBg(String status) => _statusColor(status).withValues(alpha: 0.12);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    // Use the sessionTime string — never format the date field with a time component
    // (the DB stores date-only UTC midnight which displays as 5:30am in IST).
    final dateStr =
        DateFormat('dd MMM yyyy').format(_session.date.toLocal());
    final sessionTitle = _session.sessionTime ?? dateStr;

    return Scaffold(
      appBar: AppBar(
        title: Text(sessionTitle,
            style: const TextStyle(fontWeight: FontWeight.w600)),
        centerTitle: true,
        elevation: 0,
      ),
      body: SafeArea(
        child: Column(
          children: [
            // ── Status + summary header ──
            _buildHeader(theme, cs, dateStr),

            // ── Records list ──
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12),
              child: Row(
                children: [
                  Text('Scanned Students',
                      style: theme.textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.bold)),
                  const Spacer(),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: cs.primaryContainer,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '${_session.attendanceCount}',
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: cs.onPrimaryContainer),
                    ),
                  ),
                ],
              ),
            ),

            Expanded(
              child: FutureBuilder<List<AttendanceRecordModel>>(
                future: _recordsFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting &&
                      !snapshot.hasData) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (snapshot.hasError || (snapshot.data != null && snapshot.data!.isEmpty && Provider.of<AttendanceHistoryProvider>(context, listen: false).recordsErrorMessage != null)) {
                    final msg = Provider.of<AttendanceHistoryProvider>(context, listen: false).recordsErrorMessage ?? 'Error loading records';
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(msg, style: TextStyle(color: cs.error), textAlign: TextAlign.center),
                      ),
                    );
                  }

                  final records = snapshot.data ?? [];

                  if (records.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.group_off_outlined,
                              size: 48, color: Colors.grey.shade300),
                          const SizedBox(height: 12),
                          Text('No students scanned.',
                              style:
                                  TextStyle(color: Colors.grey.shade500)),
                        ],
                      ),
                    );
                  }

                  return ListView.separated(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16.0, vertical: 4.0),
                    itemCount: records.length,
                    cacheExtent: 500,
                    separatorBuilder: (_, _) =>
                        const Divider(height: 1, indent: 60),
                    itemBuilder: (context, index) {
                      final record = records[index];
                      final scanTime = _scanTimeFormat
                          .format(record.timestamp.toLocal());

                      return ListTile(
                        contentPadding:
                            const EdgeInsets.symmetric(horizontal: 8),
                        leading: CircleAvatar(
                          backgroundColor: cs.primaryContainer,
                          child: Text(
                            '${index + 1}',
                            style: TextStyle(
                                color: cs.onPrimaryContainer, fontSize: 12),
                          ),
                        ),
                        title: Text(record.studentRollNumber,
                            style: const TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 15)),
                        trailing: Text(scanTime,
                            style: TextStyle(
                                color: cs.onSurface.withValues(alpha: 0.5),
                                fontSize: 12)),
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

  Widget _buildHeader(ThemeData theme, ColorScheme cs, String dateStr) {
    final status = _session.status;
    final sColor = _statusColor(status);
    final sBg = _statusBg(status);

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cs.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: sBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                          color: sColor, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      status,
                      style: TextStyle(
                          color: sColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_session.subjectName != null) ...[
            _Row(
              Icons.menu_book_outlined,
              'Subject',
              _session.subjectName!.replaceFirst('Employability Skills - ', 'ES - '),
            ),
            const SizedBox(height: 10),
          ],
          if (_session.academicYearName != null) ...[
            _Row(Icons.school_outlined, 'Year', _session.academicYearName!),
            const SizedBox(height: 10),
          ],
          _Row(Icons.calendar_today_outlined, 'Date', dateStr),
          const SizedBox(height: 10),
          _Row(Icons.access_time_outlined, 'Session',
              _session.sessionTime ?? 'N/A'),
          if (_session.labIncharge != null &&
              _session.labIncharge!.isNotEmpty) ...[
            const SizedBox(height: 10),
            _Row(Icons.person_outline, 'Lab Incharge', _session.labIncharge!),
          ],
          const SizedBox(height: 10),
          _Row(Icons.people_alt_outlined, 'Present',
              '${_session.attendanceCount} students'),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _Row(this.icon, this.label, this.value);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: cs.onSurface.withValues(alpha: 0.45)),
        const SizedBox(width: 10),
        Text('$label: ',
            style: TextStyle(
                color: cs.onSurface.withValues(alpha: 0.55), fontSize: 14)),
        Expanded(
          child: Text(value,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
              overflow: TextOverflow.ellipsis),
        ),
      ],
    );
  }
}
