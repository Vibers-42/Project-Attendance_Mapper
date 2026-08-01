import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../providers/placement_provider.dart';

class PlacementCreateSessionScreen extends StatefulWidget {
  const PlacementCreateSessionScreen({super.key});

  @override
  State<PlacementCreateSessionScreen> createState() =>
      _PlacementCreateSessionScreenState();
}

class _PlacementCreateSessionScreenState
    extends State<PlacementCreateSessionScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _venueController = TextEditingController();

  DateTime _selectedDate = DateTime.now();
  TimeOfDay _selectedTime = TimeOfDay.now();
  String _attendanceMode = 'OFFLINE';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<PlacementProvider>(context, listen: false).loadFaculty();
    });
  }

  @override
  void dispose() {
    _titleController.dispose();
    _venueController.dispose();
    super.dispose();
  }

  DateTime get _combinedDateTime => DateTime(
        _selectedDate.year,
        _selectedDate.month,
        _selectedDate.day,
        _selectedTime.hour,
        _selectedTime.minute,
      );

  // ── Date / time pickers ────────────────────────────────────────────────────

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
    );
    if (picked != null && mounted) setState(() => _selectedDate = picked);
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _selectedTime,
    );
    if (picked != null && mounted) setState(() => _selectedTime = picked);
  }

  // ── Excel upload ───────────────────────────────────────────────────────────

  Future<void> _pickAndUploadExcel(PlacementProvider provider) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx', 'xls'],
    );
    if (result == null || result.files.isEmpty) return;
    final path = result.files.first.path;
    if (path == null) return;

    await provider.parseExcel(path);

    if (!mounted) return;
    if (provider.errorMessage != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.errorMessage!),
          backgroundColor: Colors.red.shade700,
        ),
      );
      provider.clearError();
    }
  }

  // ── Session creation ───────────────────────────────────────────────────────

  Future<void> _submit(PlacementProvider provider,
      {required bool startImmediately}) async {
    if (!_formKey.currentState!.validate()) return;

    final venue = _venueController.text.trim();
    final session = await provider.createSession(
      title: _titleController.text.trim(),
      dateTime: _combinedDateTime,
      venue: venue.isEmpty ? null : venue,
      attendanceMode: _attendanceMode,
      startImmediately: startImmediately,
    );

    if (!mounted) return;

    if (session == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.errorMessage ?? 'Failed to create session.'),
          backgroundColor: Colors.red.shade700,
        ),
      );
      provider.clearError();
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(startImmediately
            ? 'Session started — ${session.title}'
            : 'Draft saved — ${session.title}'),
        backgroundColor: Colors.green.shade700,
      ),
    );
    Navigator.of(context).pop();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Placement Session'),
        centerTitle: true,
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: Consumer<PlacementProvider>(
            builder: (context, provider, _) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Section 1: Session Details ──────────────────────────
                  _SectionLabel('Session Details'),
                  const SizedBox(height: 14),

                  // Drive Name
                  TextFormField(
                    controller: _titleController,
                    textCapitalization: TextCapitalization.words,
                    decoration: _inputDecoration(
                      'Drive Name',
                      hint: 'e.g. TCS Campus Drive 2025',
                    ),
                    validator: (v) => v == null || v.trim().isEmpty
                        ? 'Drive name is required'
                        : null,
                  ),
                  const SizedBox(height: 16),

                  // Date + Time row
                  Row(
                    children: [
                      Expanded(
                        child: _PickerCard(
                          label: 'Drive Date',
                          value: DateFormat('dd MMM yyyy').format(_selectedDate),
                          icon: Icons.calendar_today_outlined,
                          onTap: _pickDate,
                          cs: cs,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _PickerCard(
                          label: 'Drive Time',
                          value: _selectedTime.format(context),
                          icon: Icons.access_time_outlined,
                          onTap: _pickTime,
                          cs: cs,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Attendance Mode
                  Text(
                    'Attendance Mode',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: cs.onSurface.withValues(alpha: 0.6),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(
                        value: 'OFFLINE',
                        label: Text('Offline'),
                        icon: Icon(Icons.location_on_outlined, size: 16),
                      ),
                      ButtonSegment(
                        value: 'VIRTUAL',
                        label: Text('Virtual'),
                        icon: Icon(Icons.video_call_outlined, size: 16),
                      ),
                    ],
                    selected: {_attendanceMode},
                    onSelectionChanged: (Set<String> sel) =>
                        setState(() => _attendanceMode = sel.first),
                    expandedInsets: EdgeInsets.zero,
                  ),
                  const SizedBox(height: 16),

                  // Venue / Link
                  TextFormField(
                    controller: _venueController,
                    decoration: _inputDecoration(
                      _attendanceMode == 'OFFLINE'
                          ? 'Venue (optional)'
                          : 'Meeting Link (optional)',
                      hint: _attendanceMode == 'OFFLINE'
                          ? 'e.g. Main Auditorium'
                          : 'e.g. https://meet.google.com/…',
                    ),
                  ),

                  // ── Section 2: Eligible Students ────────────────────────
                  const SizedBox(height: 32),
                  _SectionLabel('Eligible Students'),
                  const SizedBox(height: 4),
                  Text(
                    'Upload an Excel file with Roll No and Name columns.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: cs.onSurface.withValues(alpha: 0.55),
                    ),
                  ),
                  const SizedBox(height: 14),

                  if (provider.hasStudents) ...[
                    _StudentsLoadedBanner(
                      count: provider.studentCount,
                      onReplace: () => _pickAndUploadExcel(provider),
                      onClear: provider.clearStudents,
                      cs: cs,
                    ),
                  ] else ...[
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        icon: provider.isParsingExcel
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2),
                              )
                            : const Icon(Icons.upload_file_outlined),
                        label: Text(provider.isParsingExcel
                            ? 'Parsing…'
                            : 'Upload Eligibility Excel'),
                        onPressed: provider.isParsingExcel
                            ? null
                            : () => _pickAndUploadExcel(provider),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    ),
                  ],

                  // ── Section 3: Session Permissions ──────────────────────
                  const SizedBox(height: 32),
                  _SectionLabel('Session Permissions'),
                  const SizedBox(height: 4),
                  Text(
                    'Faculty you add can view or edit this session.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: cs.onSurface.withValues(alpha: 0.55),
                    ),
                  ),
                  const SizedBox(height: 14),

                  if (provider.selectedPermissions.isNotEmpty) ...[
                    ...provider.selectedPermissions.map(
                      (entry) => _PermissionTile(
                        entry: entry,
                        onRoleChanged: (role) => provider
                            .updatePermissionRole(entry.faculty.id, role),
                        onRemove: () =>
                            provider.removePermission(entry.faculty.id),
                        cs: cs,
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],

                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.person_add_alt_outlined),
                      label: const Text('Add Faculty'),
                      onPressed: () => _showFacultyPicker(context, provider),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 100),
                ],
              );
            },
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
          child: Consumer<PlacementProvider>(
            builder: (context, provider, _) {
              return Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: provider.isLoading
                          ? null
                          : () =>
                              _submit(provider, startImmediately: false),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Save as Draft'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: provider.isLoading
                          ? null
                          : () =>
                              _submit(provider, startImmediately: true),
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: provider.isLoading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Start Session'),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  InputDecoration _inputDecoration(String label, {String? hint}) =>
      InputDecoration(
        labelText: label,
        hintText: hint,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      );

  void _showFacultyPicker(BuildContext context, PlacementProvider provider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _FacultyPickerSheet(provider: provider),
    );
  }
}

// ── Sub-widgets ──────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context)
          .textTheme
          .titleSmall
          ?.copyWith(fontWeight: FontWeight.bold),
    );
  }
}

class _PickerCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final VoidCallback onTap;
  final ColorScheme cs;

  const _PickerCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.onTap,
    required this.cs,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          border: Border.all(color: cs.outline),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: cs.onSurface.withValues(alpha: 0.6)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 11,
                      color: cs.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StudentsLoadedBanner extends StatelessWidget {
  final int count;
  final VoidCallback onReplace;
  final VoidCallback onClear;
  final ColorScheme cs;

  const _StudentsLoadedBanner({
    required this.count,
    required this.onReplace,
    required this.onClear,
    required this.cs,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: cs.primaryContainer.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: cs.primary.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.check_circle_outline, color: cs.primary, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '$count student${count == 1 ? '' : 's'} loaded',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: cs.primary,
              ),
            ),
          ),
          TextButton(
            onPressed: onReplace,
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text('Replace'),
          ),
          const SizedBox(width: 4),
          IconButton(
            icon: const Icon(Icons.close, size: 18),
            onPressed: onClear,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            color: cs.onSurface.withValues(alpha: 0.5),
          ),
        ],
      ),
    );
  }
}

class _PermissionTile extends StatelessWidget {
  final PlacementPermissionEntry entry;
  final ValueChanged<String> onRoleChanged;
  final VoidCallback onRemove;
  final ColorScheme cs;

  const _PermissionTile({
    required this.entry,
    required this.onRoleChanged,
    required this.onRemove,
    required this.cs,
  });

  @override
  Widget build(BuildContext context) {
    final isEditor = entry.role == 'EDITOR';
    final initial = entry.faculty.name.isNotEmpty
        ? entry.faculty.name[0].toUpperCase()
        : '?';

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: cs.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
        child: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: cs.primaryContainer,
              child: Text(
                initial,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: cs.primary,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.faculty.name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 13),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    entry.faculty.facultyId,
                    style: TextStyle(
                      fontSize: 11,
                      color: cs.onSurface.withValues(alpha: 0.5),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => onRoleChanged(isEditor ? 'VIEWER' : 'EDITOR'),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: isEditor
                      ? cs.secondaryContainer
                      : cs.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  isEditor ? 'Editor' : 'Viewer',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isEditor ? cs.secondary : cs.onSurfaceVariant,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 4),
            IconButton(
              icon: Icon(
                Icons.close,
                size: 18,
                color: cs.onSurface.withValues(alpha: 0.45),
              ),
              onPressed: onRemove,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Faculty Picker Bottom Sheet ───────────────────────────────────────────────

class _FacultyPickerSheet extends StatefulWidget {
  final PlacementProvider provider;

  const _FacultyPickerSheet({required this.provider});

  @override
  State<_FacultyPickerSheet> createState() => _FacultyPickerSheetState();
}

class _FacultyPickerSheetState extends State<_FacultyPickerSheet> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    final selectedIds = widget.provider.selectedPermissions
        .map((e) => e.faculty.id)
        .toSet();

    final filtered = widget.provider.availableFaculty
        .where((f) => !selectedIds.contains(f.id))
        .where((f) =>
            _query.isEmpty ||
            f.name.toLowerCase().contains(_query.toLowerCase()) ||
            f.facultyId.toLowerCase().contains(_query.toLowerCase()))
        .toList();

    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.65,
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: cs.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                children: [
                  Text(
                    'Add Faculty',
                    style: theme.textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search by name or ID…',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      isDense: true,
                    ),
                    onChanged: (v) => setState(() => _query = v),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: filtered.isEmpty
                  ? Center(
                      child: Text(
                        widget.provider.availableFaculty.isEmpty
                            ? 'No faculty available.'
                            : 'No matching faculty.',
                        style: TextStyle(
                          color: cs.onSurface.withValues(alpha: 0.5),
                        ),
                      ),
                    )
                  : ListView.builder(
                      itemCount: filtered.length,
                      itemBuilder: (ctx, i) {
                        final faculty = filtered[i];
                        final initial = faculty.name.isNotEmpty
                            ? faculty.name[0].toUpperCase()
                            : '?';
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: cs.primaryContainer,
                            child: Text(
                              initial,
                              style: TextStyle(
                                color: cs.primary,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                          ),
                          title: Text(
                            faculty.name,
                            style: const TextStyle(fontSize: 14),
                          ),
                          subtitle: Text(
                            faculty.facultyId,
                            style: const TextStyle(fontSize: 12),
                          ),
                          onTap: () {
                            widget.provider.addPermission(faculty, 'VIEWER');
                            Navigator.of(context).pop();
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
