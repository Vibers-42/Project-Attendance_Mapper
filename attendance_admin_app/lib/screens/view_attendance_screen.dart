import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
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
  late final StreamSubscription<List<ConnectivityResult>> _connectivitySub;
  bool _wasOffline = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider =
          Provider.of<AttendanceHistoryProvider>(context, listen: false);
      if (provider.sessions.isEmpty) {
        provider.fetchSessions(refresh: true);
      } else {
        // Data already in memory — refresh silently without a spinner
        provider.silentRefresh();
      }
    });

    // Auto-refresh when internet is restored after being offline
    _connectivitySub = Connectivity()
        .onConnectivityChanged
        .listen((results) {
      final isOnline = results
          .any((r) => r != ConnectivityResult.none);
      if (!isOnline) {
        _wasOffline = true;
      } else if (_wasOffline && isOnline) {
        _wasOffline = false;
        if (!mounted) return;
        final provider = Provider.of<AttendanceHistoryProvider>(
            context,
            listen: false);
        if (provider.errorMessage != null) {
          provider.fetchSessions(refresh: true);
        }
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _connectivitySub.cancel();
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
          Consumer<AttendanceHistoryProvider>(
            builder: (context, provider, _) {
              final af = provider.activeFilters;
              final count = [
                if (af.containsKey('year')) 1,
                if (af.containsKey('subject')) 1,
                if (af.containsKey('startDate')) 1,
              ].length;
              return Badge(
                isLabelVisible: count > 0,
                label: Text('$count'),
                child: IconButton(
                  icon: Icon(count > 0
                      ? Icons.filter_list
                      : Icons.filter_list_outlined),
                  onPressed: _showFilterSheet,
                  tooltip: 'Filter',
                ),
              );
            },
          ),
        ],
      ),
      body: Consumer<AttendanceHistoryProvider>(
        builder: (context, provider, child) {
          if (provider.isLoadingSessions && provider.sessions.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.sessions.isEmpty) {
            final hasError = provider.errorMessage != null;
            return RefreshIndicator(
              onRefresh: () => provider.fetchSessions(refresh: true),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: SizedBox(
                  height: MediaQuery.of(context).size.height - 200,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            hasError
                                ? Icons.wifi_off_rounded
                                : Icons.history_edu,
                            size: 64,
                            color: Colors.grey.shade300,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            hasError
                                ? provider.errorMessage!
                                : 'No attendance sessions found.',
                            style: TextStyle(
                                color: Colors.grey.shade600, fontSize: 15),
                            textAlign: TextAlign.center,
                          ),
                          if (hasError) ...[
                            const SizedBox(height: 8),
                            Text(
                              'Will retry when connection is restored.',
                              style: TextStyle(
                                  color: Colors.grey.shade400, fontSize: 13),
                            ),
                          ],
                        ],
                      ),
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
              cacheExtent: 800,
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
    final cs = theme.colorScheme;
    final dateStr = DateFormat('dd MMM yyyy').format(session.date.toLocal());
    final statusColor = _getStatusColor(session.status);

    // Short subject label: strip "Employability Skills - " prefix
    final subjectLabel = session.subjectName
        ?.replaceFirst('Employability Skills - ', 'ES - ');
    final yearLabel = session.academicYearName;
    final timeLabel = session.sessionTime;

    return Card(
      margin: const EdgeInsets.only(bottom: 10.0),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: cs.outlineVariant),
      ),
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, '/session_details', arguments: session),
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Title row: subject + status ───────────────────────────
              Row(
                children: [
                  Expanded(
                    child: Text(
                      subjectLabel ?? timeLabel ?? dateStr,
                      style: theme.textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 8),
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

              // ── Meta row: year · time · date ──────────────────────────
              Wrap(
                spacing: 12,
                runSpacing: 4,
                children: [
                  if (yearLabel != null)
                    _MetaChip(
                        icon: Icons.school_outlined, label: yearLabel),
                  if (timeLabel != null)
                    _MetaChip(
                        icon: Icons.access_time_outlined, label: timeLabel),
                  _MetaChip(
                      icon: Icons.calendar_today_outlined, label: dateStr),
                ],
              ),
              const SizedBox(height: 10),

              // ── Footer: student count ────────────────────────────────
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Icon(Icons.people_outline, size: 16, color: cs.primary),
                  const SizedBox(width: 6),
                  Text(
                    '${session.attendanceCount} students present',
                    style: TextStyle(
                      color: cs.primary,
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

class _MetaChip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _MetaChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: cs.onSurface.withValues(alpha: 0.45)),
        const SizedBox(width: 4),
        Text(label,
            style: TextStyle(
                fontSize: 12,
                color: cs.onSurface.withValues(alpha: 0.6))),
      ],
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
  // Which criteria are toggled on — any combination allowed
  final Set<String> _active = {};

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
    final filters =
        Provider.of<AttendanceHistoryProvider>(context, listen: false)
            .activeFilters;
    _selectedYear = filters['year'] as String?;
    _selectedSubject = filters['subject'] as String?;
    final dateStr = filters['startDate'] as String?;
    if (dateStr != null) _selectedDate = DateTime.tryParse(dateStr);

    // Restore which toggles were on from active filters
    if (_selectedYear != null) _active.add('year');
    if (_selectedSubject != null) _active.add('subject');
    if (_selectedDate != null) _active.add('date');
    // Default: show year toggle open if nothing is active
    if (_active.isEmpty) _active.add('year');
  }

  void _toggleMode(String mode) {
    setState(() {
      if (_active.contains(mode)) {
        _active.remove(mode);
        // Clear value when toggled off
        if (mode == 'year') _selectedYear = null;
        if (mode == 'subject') _selectedSubject = null;
        if (mode == 'date') _selectedDate = null;
      } else {
        _active.add(mode);
      }
    });
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
    final provider =
        Provider.of<AttendanceHistoryProvider>(context, listen: false);
    final Map<String, dynamic> filters = {};
    if (_selectedYear != null) filters['year'] = _selectedYear;
    if (_selectedSubject != null) filters['subject'] = _selectedSubject;
    if (_selectedDate != null) {
      final iso = _selectedDate!.toIso8601String().split('T').first;
      filters['startDate'] = iso;
      filters['endDate'] =
          _selectedDate!.add(const Duration(days: 1)).toIso8601String().split('T').first;
    }
    provider.applyFilters(filters);
    Navigator.of(context).pop();
  }

  void _clearFilters() {
    Provider.of<AttendanceHistoryProvider>(context, listen: false)
        .applyFilters({});
    Navigator.of(context).pop();
  }

  InputDecoration _dec(String label, IconData icon) {
    final cs = Theme.of(context).colorScheme;
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: cs.outlineVariant),
    );
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon, color: cs.onSurfaceVariant),
      border: border,
      enabledBorder: border,
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: cs.primary, width: 1.5),
      ),
      filled: true,
      fillColor: cs.surfaceContainerHighest.withValues(alpha: 0.45),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return DraggableScrollableSheet(
      initialChildSize: 0.5,
      minChildSize: 0.35,
      maxChildSize: 0.92,
      expand: false,
      builder: (context, scrollController) => Column(
        children: [
          // Handle bar
          Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 4),
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                  color: cs.outlineVariant,
                  borderRadius: BorderRadius.circular(2)),
            ),
          ),
          // Title row
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 8, 0),
            child: Row(
              children: [
                Text('Filter Sessions',
                    style: theme.textTheme.titleLarge
                        ?.copyWith(fontWeight: FontWeight.bold)),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // ── Active filter summary strip ───────────────────────────────
          Builder(builder: (context) {
            final chips = <Widget>[];
            if (_selectedYear != null) {
              chips.add(_ActiveChip(
                label: _selectedYear!,
                onRemove: () => setState(() {
                  _selectedYear = null;
                  _active.remove('year');
                }),
              ));
            }
            if (_selectedSubject != null) {
              chips.add(_ActiveChip(
                label: _selectedSubject!.replaceFirst(
                    'Employability Skills - ', ''),
                onRemove: () => setState(() {
                  _selectedSubject = null;
                  _active.remove('subject');
                }),
              ));
            }
            if (_selectedDate != null) {
              chips.add(_ActiveChip(
                label: DateFormat('dd MMM yyyy').format(_selectedDate!),
                onRemove: () => setState(() {
                  _selectedDate = null;
                  _active.remove('date');
                }),
              ));
            }

            if (chips.isEmpty) return const SizedBox.shrink();
            return Container(
              width: double.infinity,
              color: cs.primaryContainer.withValues(alpha: 0.25),
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Wrap(
                spacing: 8,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text('Applied:',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: cs.primary)),
                  ...chips,
                ],
              ),
            );
          }),

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
                // ── Filter toggles ────────────────────────────────────────
                Text('Filter by',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.1,
                        color: cs.primary)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _ModeChip(
                      label: 'Year',
                      icon: Icons.school_outlined,
                      selected: _active.contains('year'),
                      onTap: () => _toggleMode('year'),
                    ),
                    const SizedBox(width: 8),
                    _ModeChip(
                      label: 'Subject',
                      icon: Icons.menu_book_outlined,
                      selected: _active.contains('subject'),
                      onTap: () => _toggleMode('subject'),
                    ),
                    const SizedBox(width: 8),
                    _ModeChip(
                      label: 'Date',
                      icon: Icons.calendar_today_outlined,
                      selected: _active.contains('date'),
                      onTap: () => _toggleMode('date'),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // ── Year input ───────────────────────────────────────────
                if (_active.contains('year')) ...[
                  DropdownButtonFormField<String>(
                    decoration: _dec('Academic Year', Icons.school_outlined),
                    value: _selectedYear,
                    isExpanded: true,
                    borderRadius: BorderRadius.circular(16),
                    items: _years
                        .map((y) => DropdownMenuItem(
                            value: y,
                            child: Text(y, overflow: TextOverflow.ellipsis)))
                        .toList(),
                    onChanged: (v) => setState(() => _selectedYear = v),
                  ),
                  const SizedBox(height: 16),
                ],

                // ── Subject input ─────────────────────────────────────────
                if (_active.contains('subject')) ...[
                  DropdownButtonFormField<String>(
                    decoration: _dec('Subject', Icons.menu_book_outlined),
                    value: _selectedSubject,
                    isExpanded: true,
                    borderRadius: BorderRadius.circular(16),
                    items: _subjects
                        .map((s) => DropdownMenuItem(
                            value: s,
                            child: Text(s, overflow: TextOverflow.ellipsis)))
                        .toList(),
                    onChanged: (v) => setState(() => _selectedSubject = v),
                  ),
                  const SizedBox(height: 16),
                ],

                // ── Date input ────────────────────────────────────────────
                if (_active.contains('date')) ...[
                  InkWell(
                    onTap: _pickDate,
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 15),
                      decoration: BoxDecoration(
                        color: _selectedDate != null
                            ? cs.primaryContainer.withValues(alpha: 0.35)
                            : cs.surfaceContainerHighest.withValues(alpha: 0.45),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _selectedDate != null
                              ? cs.primary.withValues(alpha: 0.4)
                              : cs.outlineVariant,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.calendar_today_outlined,
                              size: 20,
                              color: _selectedDate != null
                                  ? cs.primary
                                  : cs.onSurfaceVariant),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              _selectedDate != null
                                  ? DateFormat('dd MMM yyyy')
                                      .format(_selectedDate!)
                                  : 'Pick a date',
                              style: theme.textTheme.bodyLarge?.copyWith(
                                color: _selectedDate != null
                                    ? cs.onSurface
                                    : cs.onSurface.withValues(alpha: 0.4),
                              ),
                            ),
                          ),
                          if (_selectedDate != null)
                            GestureDetector(
                              onTap: () => setState(() => _selectedDate = null),
                              child: Icon(Icons.close_rounded,
                                  size: 18, color: cs.onSurfaceVariant),
                            )
                          else
                            Icon(Icons.chevron_right_rounded,
                                size: 20, color: cs.onSurfaceVariant),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                const SizedBox(height: 16),

                // ── Action buttons ────────────────────────────────────────
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
                        child: const Text('Clear'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: FilledButton(
                        onPressed: _applyFilters,
                        style: FilledButton.styleFrom(
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Text('Apply Filter'),
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

class _ActiveChip extends StatelessWidget {
  final String label;
  final VoidCallback onRemove;

  const _ActiveChip({required this.label, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: cs.primaryContainer,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: cs.primary.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label,
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: cs.onPrimaryContainer)),
          const SizedBox(width: 4),
          GestureDetector(
            onTap: onRemove,
            child: Icon(Icons.close_rounded,
                size: 14, color: cs.onPrimaryContainer),
          ),
        ],
      ),
    );
  }
}

class _ModeChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _ModeChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected
                ? cs.primaryContainer
                : cs.surfaceContainerHighest.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? cs.primary : cs.outlineVariant,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon,
                  size: 20,
                  color: selected ? cs.primary : cs.onSurfaceVariant),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight:
                      selected ? FontWeight.bold : FontWeight.normal,
                  color: selected ? cs.primary : cs.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
