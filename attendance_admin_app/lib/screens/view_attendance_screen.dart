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
      Provider.of<AttendanceHistoryProvider>(context, listen: false)
          .fetchSessions(refresh: true);
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
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
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      sheetAnimationStyle: AnimationStyle(
        curve: Curves.easeOutCubic,
        duration: const Duration(milliseconds: 340),
        reverseCurve: Curves.easeInCubic,
        reverseDuration: const Duration(milliseconds: 240),
      ),
      builder: (context) => const _FilterBottomSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('History'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list_outlined),
            onPressed: _showFilterSheet,
            tooltip: 'Filter',
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
                        Icon(Icons.history_edu, size: 64, color: Colors.grey.shade300),
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
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: provider.sessions.length + (provider.hasMore ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == provider.sessions.length) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24.0),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                return _SessionCard(session: provider.sessions[index]);
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
      case 'COMPLETED':
        return Colors.green;
      case 'PENDING':
      case 'CREATED':
        return Colors.orange;
      case 'IN_PROGRESS':
      case 'ACTIVE':
        return Colors.blue;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dateStr = DateFormat('dd MMM yyyy').format(session.date.toLocal());
    final timeStr = session.sessionTime ?? dateStr;
    final statusColor = _getStatusColor(session.status);

    return Card(
      margin: const EdgeInsets.only(bottom: 10.0),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, '/session_details', arguments: session),
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      timeStr,
                      style: theme.textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      session.status,
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Icon(Icons.calendar_today_outlined,
                      size: 14, color: Colors.grey.shade500),
                  const SizedBox(width: 6),
                  Text(dateStr,
                      style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                  if (session.labIncharge != null) ...[
                    const SizedBox(width: 16),
                    Icon(Icons.person_outline,
                        size: 14, color: Colors.grey.shade500),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        session.labIncharge!,
                        style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Icon(Icons.people_outline,
                      size: 16, color: theme.colorScheme.primary),
                  const SizedBox(width: 6),
                  Text(
                    '${session.attendanceCount} students present',
                    style: TextStyle(
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
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

// ─────────────────────────────────────────────────────────────────────────────
// Filter bottom sheet
// ─────────────────────────────────────────────────────────────────────────────

class _FilterBottomSheet extends StatefulWidget {
  const _FilterBottomSheet();

  @override
  State<_FilterBottomSheet> createState() => _FilterBottomSheetState();
}

class _FilterBottomSheetState extends State<_FilterBottomSheet> {
  String? _selectedYear;
  String? _selectedSubject;
  DateTime? _selectedDate;

  static const List<String> _years = ['Second Year', 'Third Year'];
  static const List<String> _subjects = [
    'Employability Skills - Aptitude',
    'Employability Skills - Soft Skills',
  ];

  @override
  void initState() {
    super.initState();
    final provider = Provider.of<AttendanceHistoryProvider>(context, listen: false);
    final filters = provider.activeFilters;
    _selectedYear = filters['year'] as String?;
    _selectedSubject = filters['subject'] as String?;
    final dateStr = filters['startDate'] as String?;
    if (dateStr != null) _selectedDate = DateTime.tryParse(dateStr);
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _selectedDate = picked);
  }

  void _applyFilters() {
    final provider = Provider.of<AttendanceHistoryProvider>(context, listen: false);
    final Map<String, dynamic> filters = {};
    if (_selectedYear != null) filters['year'] = _selectedYear;
    if (_selectedSubject != null) filters['subject'] = _selectedSubject;
    if (_selectedDate != null) {
      final iso = _selectedDate!.toIso8601String().split('T').first;
      filters['startDate'] = iso;
      final next = _selectedDate!.add(const Duration(days: 1));
      filters['endDate'] = next.toIso8601String().split('T').first;
    }
    provider.applyFilters(filters);
    Navigator.of(context).pop();
  }

  void _clearFilters() {
    Provider.of<AttendanceHistoryProvider>(context, listen: false).applyFilters({});
    Navigator.of(context).pop();
  }

  InputDecoration _dec(String label, IconData icon) {
    final colorScheme = Theme.of(context).colorScheme;
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: colorScheme.outlineVariant),
    );
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon, color: colorScheme.onSurfaceVariant),
      border: border,
      enabledBorder: border,
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: colorScheme.primary, width: 1.5),
      ),
      filled: true,
      fillColor: colorScheme.surfaceContainerHighest.withValues(alpha: 0.45),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return DraggableScrollableSheet(
      initialChildSize: 0.65,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      expand: false,
      builder: (context, scrollController) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 4),
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: colorScheme.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 8, 0),
            child: Row(
              children: [
                Text(
                  'Filter Sessions',
                  style: theme.textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView(
              controller: scrollController,
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              children: [

                // Academic Year
                _FilterLabel('Academic Year'),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  decoration: _dec('Year', Icons.school_outlined),
                  value: _selectedYear,
                  isExpanded: true,
                  borderRadius: BorderRadius.circular(16),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('Any year')),
                    ..._years.map((y) => DropdownMenuItem(
                          value: y,
                          child: Text(y, overflow: TextOverflow.ellipsis),
                        )),
                  ],
                  onChanged: (val) => setState(() => _selectedYear = val),
                ),
                const SizedBox(height: 20),

                // Subject
                _FilterLabel('Subject'),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  decoration: _dec('Subject', Icons.menu_book_outlined),
                  value: _selectedSubject,
                  isExpanded: true,
                  borderRadius: BorderRadius.circular(16),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('Any subject')),
                    ..._subjects.map((s) => DropdownMenuItem(
                          value: s,
                          child: Text(s, overflow: TextOverflow.ellipsis),
                        )),
                  ],
                  onChanged: (val) => setState(() => _selectedSubject = val),
                ),
                const SizedBox(height: 20),

                // Date
                _FilterLabel('Date'),
                const SizedBox(height: 10),
                InkWell(
                  onTap: _pickDate,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
                    decoration: BoxDecoration(
                      color: _selectedDate != null
                          ? colorScheme.primaryContainer.withValues(alpha: 0.35)
                          : colorScheme.surfaceContainerHighest.withValues(alpha: 0.45),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _selectedDate != null
                            ? colorScheme.primary.withValues(alpha: 0.4)
                            : colorScheme.outlineVariant,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.calendar_today_outlined,
                          size: 20,
                          color: _selectedDate != null
                              ? colorScheme.primary
                              : colorScheme.onSurfaceVariant,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            _selectedDate != null
                                ? DateFormat('dd MMM yyyy').format(_selectedDate!)
                                : 'Pick a date',
                            style: theme.textTheme.bodyLarge?.copyWith(
                              color: _selectedDate != null
                                  ? colorScheme.onSurface
                                  : colorScheme.onSurface.withValues(alpha: 0.4),
                            ),
                          ),
                        ),
                        if (_selectedDate != null)
                          GestureDetector(
                            onTap: () => setState(() => _selectedDate = null),
                            child: Icon(Icons.close_rounded,
                                size: 18, color: colorScheme.onSurfaceVariant),
                          )
                        else
                          Icon(Icons.chevron_right_rounded,
                              size: 20, color: colorScheme.onSurfaceVariant),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 32),

                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _clearFilters,
                        style: OutlinedButton.styleFrom(
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Text('Clear All'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: _applyFilters,
                        style: FilledButton.styleFrom(
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Text('Apply'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterLabel extends StatelessWidget {
  final String text;
  const _FilterLabel(this.text);

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Text(
      text.toUpperCase(),
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.bold,
        letterSpacing: 1.1,
        color: colorScheme.primary,
      ),
    );
  }
}
