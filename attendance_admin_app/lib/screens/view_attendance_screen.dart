import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../providers/attendance_history_provider.dart';
import '../models/attendance_session_model.dart';

class ViewAttendanceScreen extends StatefulWidget {
  const ViewAttendanceScreen({super.key});

  @override
  State<ViewAttendanceScreen> createState() => _ViewAttendanceScreenState();
}

class _ViewAttendanceScreenState extends State<ViewAttendanceScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<AttendanceHistoryProvider>(context, listen: false);
      if (provider.sessions.isEmpty) {
        provider.fetchSessions(refresh: true);
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      final provider = Provider.of<AttendanceHistoryProvider>(context, listen: false);
      if (!provider.isLoadingSessions && provider.hasMore) {
        provider.fetchSessions();
      }
    }
  }

  void _showFilterSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => const _FilterBottomSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance History'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: _showFilterSheet,
            tooltip: 'Filter Sessions',
          ),
        ],
      ),
      body: Consumer<AttendanceHistoryProvider>(
        builder: (context, provider, child) {
          if (provider.isLoadingSessions && provider.sessions.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.sessions.isEmpty) {
            return RefreshIndicator(
              onRefresh: () => provider.fetchSessions(refresh: true),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: SizedBox(
                  height: MediaQuery.of(context).size.height - 200,
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.history_edu, size: 64, color: Colors.grey.shade400),
                        const SizedBox(height: 16),
                        Text(
                          provider.errorMessage ?? 'No attendance sessions found.',
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 16),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => provider.fetchSessions(refresh: true),
            child: ListView.builder(
              controller: _scrollController,
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(12.0),
              itemCount: provider.sessions.length + (provider.hasMore ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == provider.sessions.length) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24.0),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }

                final session = provider.sessions[index];
                return _SessionCard(session: session);
              },
            ),
          );
        },
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  final AttendanceSessionModel session;

  const _SessionCard({required this.session});

  Color _getStatusColor(String status) {
    switch (status) {
      case 'SUBMITTED':
        return Colors.green;
      case 'PENDING':
        return Colors.orange;
      case 'IN_PROGRESS':
        return Colors.blue;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dateStr = DateFormat('dd MMM yyyy, hh:mm a').format(session.date.toLocal());
    
    return Card(
      margin: const EdgeInsets.only(bottom: 12.0),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: () {
          Navigator.pushNamed(context, '/session_details', arguments: session);
        },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      'Room ${session.roomId ?? 'N/A'}',
                      style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                    ),
                  ),
                  Chip(
                    label: Text(
                      session.status,
                      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    backgroundColor: _getStatusColor(session.status),
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.calendar_today, size: 16, color: Colors.grey.shade600),
                  const SizedBox(width: 8),
                  Text(dateStr, style: TextStyle(color: Colors.grey.shade700)),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.person, size: 16, color: Colors.grey.shade600),
                  const SizedBox(width: 8),
                  Text(session.labIncharge ?? 'N/A', style: TextStyle(color: Colors.grey.shade700)),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    '${session.attendanceCount} Students Present',
                    style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600, color: theme.colorScheme.primary),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FilterBottomSheet extends StatefulWidget {
  const _FilterBottomSheet();

  @override
  State<_FilterBottomSheet> createState() => _FilterBottomSheetState();
}

class _FilterBottomSheetState extends State<_FilterBottomSheet> {
  String? _selectedStatus;
  final TextEditingController _roomController = TextEditingController();

  @override
  void initState() {
    super.initState();
    final provider = Provider.of<AttendanceHistoryProvider>(context, listen: false);
    final filters = provider.activeFilters;
    _selectedStatus = filters['status'] as String?;
    _roomController.text = filters['roomId'] as String? ?? '';
  }

  @override
  void dispose() {
    _roomController.dispose();
    super.dispose();
  }

  void _applyFilters() {
    final provider = Provider.of<AttendanceHistoryProvider>(context, listen: false);
    
    final Map<String, dynamic> filters = {};
    if (_selectedStatus != null && _selectedStatus != 'ALL') {
      filters['status'] = _selectedStatus;
    }
    if (_roomController.text.trim().isNotEmpty) {
      filters['roomId'] = _roomController.text.trim();
    }
    
    provider.applyFilters(filters);
    Navigator.of(context).pop();
  }

  void _clearFilters() {
    final provider = Provider.of<AttendanceHistoryProvider>(context, listen: false);
    provider.applyFilters({});
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Filter Sessions', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 24),
          
          DropdownButtonFormField<String>(
            decoration: const InputDecoration(
              labelText: 'Status',
              border: OutlineInputBorder(),
            ),
            initialValue: _selectedStatus,
            items: const [
              DropdownMenuItem(value: 'ALL', child: Text('All Statuses')),
              DropdownMenuItem(value: 'SUBMITTED', child: Text('Submitted')),
              DropdownMenuItem(value: 'PENDING', child: Text('Pending')),
            ],
            onChanged: (val) => setState(() => _selectedStatus = val),
          ),
          const SizedBox(height: 16),
          
          TextField(
            controller: _roomController,
            decoration: const InputDecoration(
              labelText: 'Room Number',
              border: OutlineInputBorder(),
              hintText: 'e.g., 301',
            ),
          ),
          const SizedBox(height: 32),
          
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _clearFilters,
                  child: const Text('Clear Filters'),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: FilledButton(
                  onPressed: _applyFilters,
                  child: const Text('Apply'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
