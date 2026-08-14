import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/attendance_session_model.dart';
import '../providers/attendance_provider.dart';
import '../providers/auth_provider.dart';
import '../utils/app_route_observer.dart';

/// Replaces the old "Create New Session" entry point.
///
/// Superadmin: two tabs — Create New Session (template, no room) and Active
/// Sessions (templates open for Faculty to join).
/// Faculty: Active Sessions only — selecting one prompts for a room number,
/// then proceeds to the existing scanner flow unchanged.
class SessionHubScreen extends StatefulWidget {
  const SessionHubScreen({super.key});

  @override
  State<SessionHubScreen> createState() => _SessionHubScreenState();
}

class _SessionHubScreenState extends State<SessionHubScreen> with RouteAware {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AttendanceProvider>(context, listen: false).fetchTemplates();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (route != null) appRouteObserver.subscribe(this, route);
  }

  @override
  void dispose() {
    appRouteObserver.unsubscribe(this);
    super.dispose();
  }

  @override
  void didPopNext() {
    Provider.of<AttendanceProvider>(context, listen: false).fetchTemplates();
  }

  @override
  Widget build(BuildContext context) {
    final faculty = context.watch<AuthProvider>().currentUser;
    final isSuperAdmin = faculty?.role == 'SUPER_ADMIN';

    if (!isSuperAdmin) {
      return Scaffold(
        appBar: AppBar(title: const Text('Session'), centerTitle: true),
        body: const _ActiveSessionsTab(),
      );
    }

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Session'),
          centerTitle: true,
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Create New Session'),
              Tab(text: 'Active Sessions'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            _CreateTemplateTab(),
            _ActiveSessionsTab(),
          ],
        ),
      ),
    );
  }
}

// ── Create New Session tab (Superadmin only) ────────────────────────────────

class _CreateTemplateTab extends StatefulWidget {
  const _CreateTemplateTab();

  @override
  State<_CreateTemplateTab> createState() => _CreateTemplateTabState();
}

class _CreateTemplateTabState extends State<_CreateTemplateTab> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _traineeController = TextEditingController();

  String? _selectedYear;
  String? _selectedSubject = 'Employability Skills - Aptitude';
  String? _selectedSessionTime;
  final DateTime _selectedDate = DateTime.now();

  final List<String> _years = ['2nd Year', '3rd Year'];
  final List<String> _subjects = [
    'Employability Skills - Aptitude',
    'Employability Skills - Soft Skills',
  ];
  final List<String> _sessionTimes = ['9:30 AM - 12:00 PM', '1:50 PM - 4:20 PM'];

  @override
  void dispose() {
    _traineeController.dispose();
    super.dispose();
  }

  Future<void> _create(AttendanceProvider provider) async {
    if (!_formKey.currentState!.validate()) return;

    final success = await provider.createTemplate(
      year: _selectedYear,
      date: _selectedDate,
      subject: _selectedSubject,
      sessionTime: _selectedSessionTime,
      labIncharge: _traineeController.text.trim(),
    );

    if (!mounted) return;
    if (success) {
      _traineeController.clear();
      setState(() {
        _selectedYear = null;
        _selectedSessionTime = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Session created — now visible under Active Sessions.'),
          backgroundColor: Colors.green,
        ),
      );
      DefaultTabController.of(context).animateTo(1);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.errorMessage ?? 'Failed to create session.'),
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

    return SafeArea(
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _SectionLabel('Created By'),
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
                items: _years
                    .map((y) => DropdownMenuItem(value: y, child: Text(y, overflow: TextOverflow.ellipsis)))
                    .toList(),
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
                items: _subjects
                    .map((s) => DropdownMenuItem(value: s, child: Text(s, overflow: TextOverflow.ellipsis)))
                    .toList(),
                onChanged: (v) => setState(() => _selectedSubject = v),
              ),
              const SizedBox(height: 28),

              _SectionLabel('Schedule'),
              const SizedBox(height: 12),
              _ReadOnlyField(
                label: 'Date',
                value: DateFormat('dd MMM yyyy').format(_selectedDate),
                icon: Icons.calendar_today_outlined,
                colorScheme: colorScheme,
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
                items: _sessionTimes
                    .map((t) => DropdownMenuItem(value: t, child: Text(t, overflow: TextOverflow.ellipsis)))
                    .toList(),
                onChanged: (v) => setState(() => _selectedSessionTime = v),
                validator: (v) => v == null ? 'Please select a session time' : null,
              ),
              const SizedBox(height: 36),

              Consumer<AttendanceProvider>(
                builder: (context, provider, _) => FilledButton.icon(
                  onPressed: provider.isLoading ? null : () => _create(provider),
                  icon: provider.isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.add_circle_outline),
                  label: Text(
                    provider.isLoading ? 'Creating Session...' : 'Create Session',
                    style: const TextStyle(fontSize: 16),
                  ),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
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

// ── Active Sessions tab (both roles) ────────────────────────────────────────

class _ActiveSessionsTab extends StatelessWidget {
  const _ActiveSessionsTab();

  @override
  Widget build(BuildContext context) {
    return Consumer<AttendanceProvider>(
      builder: (context, provider, _) {
        if (provider.isLoadingTemplates && provider.templates.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }

        if (provider.templatesError != null && provider.templates.isEmpty) {
          return _ErrorView(
            message: provider.templatesError!,
            onRetry: () => provider.fetchTemplates(),
          );
        }

        if (provider.templates.isEmpty) {
          return RefreshIndicator(
            onRefresh: provider.fetchTemplates,
            child: ListView(
              children: [
                SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                const _EmptyState(),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: provider.fetchTemplates,
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            itemCount: provider.templates.length,
            itemBuilder: (context, index) =>
                _TemplateCard(template: provider.templates[index]),
          ),
        );
      },
    );
  }
}

class _TemplateCard extends StatelessWidget {
  final AttendanceSessionModel template;
  const _TemplateCard({required this.template});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final dateStr = DateFormat('dd MMM yyyy').format(template.date.toLocal());
    final subjectLabel =
        template.subjectName?.replaceFirst('Employability Skills - ', 'ES - ');

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: cs.outlineVariant),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _promptRoomNumber(context, template),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                subjectLabel ?? 'Session',
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              _MetaRow(icon: Icons.calendar_today_outlined, label: dateStr, cs: cs),
              if (template.academicYearName != null) ...[
                const SizedBox(height: 4),
                _MetaRow(icon: Icons.school_outlined, label: template.academicYearName!, cs: cs),
              ],
              if (template.sessionTime != null) ...[
                const SizedBox(height: 4),
                _MetaRow(icon: Icons.access_time_outlined, label: template.sessionTime!, cs: cs),
              ],
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: const Icon(Icons.meeting_room_outlined, size: 18),
                  label: const Text('Select Session'),
                  onPressed: () => _promptRoomNumber(context, template),
                  style: FilledButton.styleFrom(
                    backgroundColor: cs.secondaryContainer,
                    foregroundColor: cs.onSecondaryContainer,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _promptRoomNumber(
      BuildContext context, AttendanceSessionModel template) async {
    final provider = Provider.of<AttendanceProvider>(context, listen: false);

    if (provider.hasActiveSession) {
      final proceed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Active Session Found'),
          content: const Text(
              'You already have a session in progress. Joining a new one will discard it.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Discard & Continue'),
            ),
          ],
        ),
      );
      if (proceed != true) return;
      provider.discardSession();
    }

    if (!context.mounted) return;
    await showRoomNumberDialog(context, template);
  }
}

class _MetaRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final ColorScheme cs;
  const _MetaRow({required this.icon, required this.label, required this.cs});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 14, color: cs.onSurface.withValues(alpha: 0.45)),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(fontSize: 13, color: cs.onSurface.withValues(alpha: 0.65)),
        ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(horizontal: 40),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.event_busy_outlined, size: 56, color: Colors.grey),
          SizedBox(height: 16),
          Text(
            'No active sessions right now.',
            style: TextStyle(fontSize: 15, color: Colors.grey),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_outlined, size: 52, color: Colors.grey.shade300),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: cs.onSurface.withValues(alpha: 0.6)),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
              onPressed: onRetry,
            ),
          ],
        ),
      ),
    );
  }
}

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
          Icon(Icons.lock_outline, size: 15, color: colorScheme.onSurface.withValues(alpha: 0.25)),
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

// ── Room Number dialog ───────────────────────────────────────────────────────

/// Mandatory room-number prompt shown before joining a session template.
/// Blocks submission on an empty value; on success, proceeds to the existing
/// scanner flow exactly as [AttendanceProvider.startSession] already does.
Future<void> showRoomNumberDialog(
    BuildContext context, AttendanceSessionModel template) async {
  final controller = TextEditingController();
  final formKey = GlobalKey<FormState>();
  final faculty = Provider.of<AuthProvider>(context, listen: false).currentUser;
  final professorName = (faculty?.name ?? '').split(' ').map(
        (w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1).toLowerCase(),
      ).join(' ');

  // Captured before the dialog opens — this is the screen's Navigator/Provider,
  // which stays valid regardless of the dialog route being pushed/popped.
  // Using the dialog's own (soon-to-be-popped) context for post-pop navigation
  // would risk "looking up a deactivated widget's ancestor".
  final navigator = Navigator.of(context);
  final provider = Provider.of<AttendanceProvider>(context, listen: false);

  await showDialog<void>(
    context: context,
    builder: (dialogContext) {
      bool isSubmitting = false;
      return StatefulBuilder(
        builder: (context, setState) {
          final cs = Theme.of(context).colorScheme;

          Future<void> submit() async {
            if (!formKey.currentState!.validate()) return;
            setState(() => isSubmitting = true);

            final success = await provider.joinTemplate(
              templateId: template.id,
              roomNumber: controller.text.trim(),
              professorName: professorName,
            );

            if (!dialogContext.mounted) return;
            if (success) {
              navigator.pop();
              navigator.pushNamed('/scanner');
            } else {
              setState(() => isSubmitting = false);
              ScaffoldMessenger.of(dialogContext).showSnackBar(
                SnackBar(
                  content: Text(provider.errorMessage ?? 'Failed to join session.'),
                  backgroundColor: Colors.red,
                ),
              );
            }
          }

          return AlertDialog(
            title: const Text('Enter Room Number'),
            content: Form(
              key: formKey,
              child: TextFormField(
                controller: controller,
                autofocus: true,
                textInputAction: TextInputAction.done,
                decoration: InputDecoration(
                  labelText: 'Room Number',
                  prefixIcon: const Icon(Icons.meeting_room_outlined),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: cs.outlineVariant),
                  ),
                ),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Room number is required.' : null,
                onFieldSubmitted: (_) => isSubmitting ? null : submit(),
              ),
            ),
            actions: [
              TextButton(
                onPressed: isSubmitting ? null : () => Navigator.of(dialogContext).pop(),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: isSubmitting ? null : submit,
                child: isSubmitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Next'),
              ),
            ],
          );
        },
      );
    },
  );
}
