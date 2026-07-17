import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../providers/attendance_provider.dart';
import '../providers/auth_provider.dart';

class CreateSessionScreen extends StatefulWidget {
  const CreateSessionScreen({super.key});

  @override
  State<CreateSessionScreen> createState() => _CreateSessionScreenState();
}

class _CreateSessionScreenState extends State<CreateSessionScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _roomController = TextEditingController();
  final TextEditingController _traineeController = TextEditingController();

  String? _selectedYear;
  String? _selectedSubject = 'Employability Skills - Aptitude';
  String? _selectedSessionTime;
  DateTime _selectedDate = DateTime.now();

  final List<String> _years = ['Second Year', 'Third Year'];
  final List<String> _subjects = [
    'Employability Skills - Aptitude',
    'Employability Skills - Soft Skills',
  ];
  final List<String> _sessionTimes = ['9:30 AM - 12:00 PM', '1:50 PM - 4:20 PM'];

  @override
  void dispose() {
    _roomController.dispose();
    _traineeController.dispose();
    super.dispose();
  }

  Future<void> _selectDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2000),
      lastDate: DateTime(2101),
    );
    if (picked != null && picked != _selectedDate) {
      setState(() => _selectedDate = picked);
    }
  }

  void _startAttendance(String facultyName) async {
    if (!_formKey.currentState!.validate()) return;

    final provider = Provider.of<AttendanceProvider>(context, listen: false);

    final success = await provider.startSession(
      professorName: facultyName,
      year: _selectedYear,
      roomNumber: _roomController.text.trim(),
      date: _selectedDate,
      subject: _selectedSubject,
      sessionTime: _selectedSessionTime,
      labIncharge: _traineeController.text.trim(),
    );

    if (success && mounted) {
      Navigator.pushNamed(context, '/scanner');
    } else if (!success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.errorMessage ?? 'Failed to start session.'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final faculty = context.watch<AuthProvider>().currentUser;

    final String facultyId = faculty?.facultyId ?? '—';
    final String rawName = faculty?.name ?? '—';
    final String facultyName = rawName
        .split(' ')
        .map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1).toLowerCase())
        .join(' ');

    return Scaffold(
      appBar: AppBar(
        title: const Text('New Session'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [

                // ── SESSION HOST ──────────────────────────────
                _SectionLabel('Session Host'),
                const SizedBox(height: 12),

                _ReadOnlyField(
                  label: 'Employee ID',
                  value: facultyId,
                  icon: Icons.badge_outlined,
                  colorScheme: colorScheme,
                ),
                const SizedBox(height: 14),

                _ReadOnlyField(
                  label: 'Name',
                  value: facultyName,
                  icon: Icons.person_outline,
                  colorScheme: colorScheme,
                ),
                const SizedBox(height: 28),

                // ── TRAINEE ───────────────────────────────────
                _SectionLabel('Trainee'),
                const SizedBox(height: 12),

                TextField(
                  controller: _traineeController,
                  decoration: _inputDecoration(
                    label: 'Trainee Name (optional)',
                    icon: Icons.school_outlined,
                    colorScheme: colorScheme,
                  ),
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 28),

                // ── SESSION DETAILS ───────────────────────────
                _SectionLabel('Session Details'),
                const SizedBox(height: 12),

                DropdownButtonFormField<String>(
                  decoration: _inputDecoration(
                    label: 'Academic Year',
                    icon: Icons.calendar_month_outlined,
                    colorScheme: colorScheme,
                  ),
                  isExpanded: true,
                  borderRadius: BorderRadius.circular(16),
                  value: _selectedYear,
                  items: _years.map((y) => DropdownMenuItem(
                    value: y,
                    child: Text(y, overflow: TextOverflow.ellipsis),
                  )).toList(),
                  onChanged: (v) => setState(() => _selectedYear = v),
                  validator: (v) => v == null ? 'Please select an academic year' : null,
                ),
                const SizedBox(height: 14),

                DropdownButtonFormField<String>(
                  decoration: _inputDecoration(
                    label: 'Subject',
                    icon: Icons.menu_book_outlined,
                    colorScheme: colorScheme,
                  ),
                  isExpanded: true,
                  borderRadius: BorderRadius.circular(16),
                  value: _selectedSubject,
                  items: _subjects.map((s) => DropdownMenuItem(
                    value: s,
                    child: Text(s, overflow: TextOverflow.ellipsis),
                  )).toList(),
                  onChanged: (v) => setState(() => _selectedSubject = v),
                ),
                const SizedBox(height: 28),

                // ── SCHEDULE ─────────────────────────────────
                _SectionLabel('Schedule'),
                const SizedBox(height: 12),

                InkWell(
                  onTap: () => _selectDate(context),
                  borderRadius: BorderRadius.circular(12),
                  child: InputDecorator(
                    decoration: _inputDecoration(
                      label: 'Date',
                      icon: Icons.calendar_today_outlined,
                      colorScheme: colorScheme,
                    ),
                    child: Text(
                      DateFormat('dd MMM yyyy').format(_selectedDate),
                      style: theme.textTheme.bodyLarge,
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                DropdownButtonFormField<String>(
                  decoration: _inputDecoration(
                    label: 'Session Time',
                    icon: Icons.access_time_outlined,
                    colorScheme: colorScheme,
                  ),
                  isExpanded: true,
                  borderRadius: BorderRadius.circular(16),
                  value: _selectedSessionTime,
                  items: _sessionTimes.map((t) => DropdownMenuItem(
                    value: t,
                    child: Text(t, overflow: TextOverflow.ellipsis),
                  )).toList(),
                  onChanged: (v) => setState(() => _selectedSessionTime = v),
                  validator: (v) => v == null ? 'Please select a session time' : null,
                ),
                const SizedBox(height: 28),

                // ── ROOM ─────────────────────────────────────
                _SectionLabel('Room'),
                const SizedBox(height: 12),

                TextField(
                  controller: _roomController,
                  decoration: _inputDecoration(
                    label: 'Room Number',
                    icon: Icons.meeting_room_outlined,
                    colorScheme: colorScheme,
                  ),
                  keyboardType: TextInputType.text,
                  textInputAction: TextInputAction.done,
                ),
                const SizedBox(height: 36),

                // ── START BUTTON ──────────────────────────────
                Consumer<AttendanceProvider>(
                  builder: (context, provider, _) {
                    return FilledButton.icon(
                      onPressed: provider.isLoading
                          ? null
                          : () => _startAttendance(facultyName),
                      icon: provider.isLoading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.qr_code_scanner),
                      label: Text(
                        provider.isLoading ? 'Creating Session...' : 'Start Attendance',
                        style: const TextStyle(fontSize: 16),
                      ),
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration({
    required String label,
    required IconData icon,
    required ColorScheme colorScheme,
  }) {
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: colorScheme.outlineVariant),
    );
    final errorBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: colorScheme.error, width: 1.5),
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
      errorBorder: errorBorder,
      focusedErrorBorder: errorBorder,
      filled: true,
      fillColor: colorScheme.surfaceContainerHighest.withValues(alpha: 0.45),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _ReadOnlyField extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final ColorScheme colorScheme;

  const _ReadOnlyField({
    required this.label,
    required this.value,
    required this.icon,
    required this.colorScheme,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: colorScheme.primaryContainer.withValues(alpha: 0.25),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colorScheme.primary.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 22, color: colorScheme.primary.withValues(alpha: 0.7)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: colorScheme.primary.withValues(alpha: 0.8),
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: colorScheme.onSurface,
                  ),
                ),
              ],
            ),
          ),
          Icon(Icons.lock_outline, size: 15,
              color: colorScheme.onSurface.withValues(alpha: 0.25)),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Text(
      text.toUpperCase(),
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.bold,
        letterSpacing: 1.2,
        color: colorScheme.primary,
      ),
    );
  }
}
