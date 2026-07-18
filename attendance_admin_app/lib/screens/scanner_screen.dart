import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:vibration/vibration.dart';
import 'package:permission_handler/permission_handler.dart';
import '../providers/attendance_provider.dart';

class ScannerScreen extends StatelessWidget {
  const ScannerScreen({super.key});

  // Returns: 'back' → keep session, just navigate away
  //          'end'  → discard session entirely
  //          null   → stay
  Future<String?> _confirmBack(BuildContext context) {
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Leave Scanner?'),
        content: const Text(
            'The session stays active — you can return to it later.'),
        actionsAlignment: MainAxisAlignment.spaceBetween,
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop('end'),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('End Session'),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(null),
                child: const Text('Stay'),
              ),
              const SizedBox(width: 4),
              FilledButton(
                onPressed: () => Navigator.of(ctx).pop('back'),
                child: const Text('Go Back'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _handleBack(BuildContext context) async {
    final result = await _confirmBack(context);
    if (!context.mounted) return;
    if (result == 'end') {
      Provider.of<AttendanceProvider>(context, listen: false).discardSession();
      Navigator.of(context).pop();
    } else if (result == 'back') {
      Navigator.of(context).pop();
    }
  }

  void _showEditSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      sheetAnimationStyle: AnimationStyle(
        curve: Curves.easeOutCubic,
        duration: const Duration(milliseconds: 300),
        reverseCurve: Curves.easeInCubic,
        reverseDuration: const Duration(milliseconds: 220),
      ),
      builder: (_) => ChangeNotifierProvider.value(
        value: Provider.of<AttendanceProvider>(context, listen: false),
        child: const _EditSessionSheet(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        await _handleBack(context);
      },
      child: DefaultTabController(
        length: 2,
        child: Scaffold(
          appBar: AppBar(
            title: const Text('Attendance System'),
            centerTitle: true,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () => _handleBack(context),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.edit_note_outlined),
                tooltip: 'Edit session details',
                onPressed: () => _showEditSheet(context),
              ),
            ],
            bottom: const TabBar(
              tabs: [
                Tab(text: 'SCANNER', icon: Icon(Icons.qr_code_scanner)),
                Tab(text: 'LIVE ATTENDANCE', icon: Icon(Icons.people_alt)),
              ],
            ),
          ),
          body: const TabBarView(
            physics: NeverScrollableScrollPhysics(),
            children: [
              ScannerTab(),
              LiveAttendanceTab(),
            ],
          ),
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Quick-edit sheet (accessible from scanner AppBar)
// ──────────────────────────────────────────────────────────────────────────────
class _EditSessionSheet extends StatefulWidget {
  const _EditSessionSheet();

  @override
  State<_EditSessionSheet> createState() => _EditSessionSheetState();
}

class _EditSessionSheetState extends State<_EditSessionSheet> {
  static const List<String> _years = ['Second Year', 'Third Year'];
  static const List<String> _subjects = [
    'Employability Skills - Aptitude',
    'Employability Skills - Soft Skills',
  ];
  static const List<String> _sessionTimes = [
    '9:30 AM - 12:00 PM',
    '1:50 PM - 4:20 PM',
  ];

  late String? _year;
  late String? _subject;
  late String? _sessionTime;
  late TextEditingController _traineeCtrl;

  @override
  void initState() {
    super.initState();
    final p = Provider.of<AttendanceProvider>(context, listen: false);
    _year = p.year;
    _subject = p.subject;
    _sessionTime = p.sessionTime;
    _traineeCtrl = TextEditingController(text: p.labIncharge ?? '');
  }

  @override
  void dispose() {
    _traineeCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final provider = Provider.of<AttendanceProvider>(context, listen: false);
    final yearChanged = _year != provider.year;

    if (yearChanged && provider.presentCount > 0) {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Clear Scanned Students?'),
          content: Text(
              'You have ${provider.presentCount} student(s) scanned. '
              'Changing the year will clear them because they belong to a different year. Continue?'),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('Cancel')),
            FilledButton(
                onPressed: () => Navigator.of(ctx).pop(true),
                child: const Text('Yes, Change Year')),
          ],
        ),
      );
      if (confirm != true) return;
    }

    final success = await provider.updateSessionDetails(
      year: _year,
      subject: _subject,
      sessionTime: _sessionTime,
      labIncharge: _traineeCtrl.text.trim(),
    );

    if (!mounted) return;
    Navigator.of(context).pop();

    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(success
          ? 'Session updated${yearChanged ? ' — previous scans cleared' : ''}'
          : provider.errorMessage ?? 'Update failed'),
      backgroundColor: success ? Colors.green.shade700 : Colors.red.shade700,
    ));
  }

  InputDecoration _dec(String label, IconData icon) {
    final cs = Theme.of(context).colorScheme;
    final border = OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: cs.outlineVariant));
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon, color: cs.onSurfaceVariant),
      border: border,
      enabledBorder: border,
      focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: cs.primary, width: 1.5)),
      filled: true,
      fillColor: cs.surfaceContainerHighest.withValues(alpha: 0.4),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Padding(
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle
            Center(
              child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                      color: cs.outlineVariant,
                      borderRadius: BorderRadius.circular(2))),
            ),
            Text('Edit Session Details',
                style: theme.textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),

            DropdownButtonFormField<String>(
              decoration: _dec('Academic Year', Icons.school_outlined),
              value: _year,
              isExpanded: true,
              borderRadius: BorderRadius.circular(16),
              items: _years
                  .map((y) => DropdownMenuItem(
                      value: y,
                      child: Text(y, overflow: TextOverflow.ellipsis)))
                  .toList(),
              onChanged: (v) => setState(() => _year = v),
            ),
            const SizedBox(height: 14),

            DropdownButtonFormField<String>(
              decoration: _dec('Subject', Icons.menu_book_outlined),
              value: _subject,
              isExpanded: true,
              borderRadius: BorderRadius.circular(16),
              items: _subjects
                  .map((s) => DropdownMenuItem(
                      value: s,
                      child: Text(s, overflow: TextOverflow.ellipsis)))
                  .toList(),
              onChanged: (v) => setState(() => _subject = v),
            ),
            const SizedBox(height: 14),

            DropdownButtonFormField<String>(
              decoration:
                  _dec('Session Time', Icons.access_time_outlined),
              value: _sessionTime,
              isExpanded: true,
              borderRadius: BorderRadius.circular(16),
              items: _sessionTimes
                  .map((t) => DropdownMenuItem(
                      value: t,
                      child: Text(t, overflow: TextOverflow.ellipsis)))
                  .toList(),
              onChanged: (v) => setState(() => _sessionTime = v),
            ),
            const SizedBox(height: 14),

            TextField(
              controller: _traineeCtrl,
              decoration:
                  _dec('Trainee Name (optional)', Icons.person_outline),
              textInputAction: TextInputAction.done,
            ),
            const SizedBox(height: 24),

            Consumer<AttendanceProvider>(
              builder: (_, provider, _) => FilledButton.icon(
                onPressed:
                    provider.isLoading ? null : _save,
                icon: provider.isLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.save_outlined),
                label: Text(
                    provider.isLoading ? 'Saving...' : 'Save Changes'),
                style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12))),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ==========================================
// TAB 1: SCANNER
// ==========================================
class ScannerTab extends StatefulWidget {
  const ScannerTab({super.key});

  @override
  State<ScannerTab> createState() => _ScannerTabState();
}

class _ScannerTabState extends State<ScannerTab>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;
  late final MobileScannerController _scannerController;
  final TextEditingController _manualEntryController = TextEditingController();
  
  bool _hasPermission = false;
  bool _isCheckingPermission = true;
  bool _isProcessingScan = false;
  DateTime? _lastProcessedAt;
  static const Duration _scanCooldown = Duration(milliseconds: 750);

  @override
  void initState() {
    super.initState();
    _scannerController = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
      facing: CameraFacing.back,
    );
    _checkPermission();
  }

  Future<void> _checkPermission() async {
    final status = await Permission.camera.request();
    if (mounted) {
      setState(() {
        _hasPermission = status.isGranted;
        _isCheckingPermission = false;
      });
    }
  }

  @override
  void dispose() {
    _scannerController.dispose();
    _manualEntryController.dispose();
    super.dispose();
  }

  void _processRollNumber(String rollNumber) {
    if (rollNumber.isEmpty || _isProcessingScan) return;

    final now = DateTime.now();
    if (_lastProcessedAt != null &&
        now.difference(_lastProcessedAt!) < _scanCooldown) {
      return;
    }

    _isProcessingScan = true;
    _lastProcessedAt = now;
    try {
      final provider = Provider.of<AttendanceProvider>(context, listen: false);
      final errorMsg = provider.addStudent(rollNumber);

      if (errorMsg != null) {
        _showSnackbar(errorMsg, isError: true);
      } else {
        _showSnackbar(
          '✓ Attendance Recorded: ${provider.lastScanned}',
          isError: false,
        );
        _triggerVibration();
      }
    } finally {
      _isProcessingScan = false;
    }
  }

  void _triggerVibration() {
    Vibration.hasVibrator().then((hasVibrator) {
      if (hasVibrator == true) {
        Vibration.vibrate(duration: 150);
      }
    }).catchError((_) {});
  }

  void _onManualSubmit() {
    final rollNumber = _manualEntryController.text.trim().toUpperCase();
    if (rollNumber.isEmpty) {
      _showSnackbar('Please enter a valid Roll Number', isError: true);
      return;
    }
    _processRollNumber(rollNumber);
    _manualEntryController.clear();
  }

  void _showSnackbar(String message, {required bool isError}) {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: isError ? Colors.red.shade700 : Colors.green.shade700,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context); // required by AutomaticKeepAliveClientMixin
    final theme = Theme.of(context);

    if (_isCheckingPermission) {
      return const Center(child: CircularProgressIndicator());
    }

    if (!_hasPermission) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.camera_alt_outlined, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            const Text('Camera Permission Required', style: TextStyle(fontSize: 18)),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () async {
                final status = await Permission.camera.request();
                if (status.isGranted) {
                  setState(() => _hasPermission = true);
                } else if (status.isPermanentlyDenied) {
                  openAppSettings();
                }
              },
              child: const Text('Grant Permission'),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        // Camera Preview (Occupies most of the top half)
        Expanded(
          flex: 4,
          child: Container(
            color: Colors.black,
            child: Stack(
              alignment: Alignment.center,
              children: [
                RepaintBoundary(
                  child: MobileScanner(
                    controller: _scannerController,
                    onDetect: (capture) {
                      final List<Barcode> barcodes = capture.barcodes;
                      if (barcodes.isNotEmpty) {
                        final String? code = barcodes.first.rawValue;
                        if (code != null) {
                          _processRollNumber(code.trim().toUpperCase());
                        }
                      }
                    },
                  ),
                ),
                // Targeting box overlay
                Container(
                  width: 250,
                  height: 250,
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.green.withAlpha(128), width: 3),
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ],
            ),
          ),
        ),
        
        // Status & Manual Entry Section
        Expanded(
          flex: 5,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Selector<AttendanceProvider,
                    ({String? lastScanned, int presentCount})>(
                  selector: (_, p) => (
                    lastScanned: p.lastScanned,
                    presentCount: p.presentCount,
                  ),
                  builder: (context, data, _) {
                    return Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Last Scanned',
                                style: theme.textTheme.labelLarge
                                    ?.copyWith(color: Colors.grey)),
                            const SizedBox(height: 4),
                            Text(
                              data.lastScanned ?? 'None',
                              style: theme.textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: data.lastScanned != null
                                    ? theme.colorScheme.primary
                                    : Colors.grey,
                                letterSpacing: 1,
                              ),
                            ),
                            if (data.lastScanned != null) ...[
                              const SizedBox(height: 6),
                              GestureDetector(
                                onTap: () {
                                  final provider =
                                      Provider.of<AttendanceProvider>(
                                          context,
                                          listen: false);
                                  final removed = provider.lastScanned!;
                                  provider.removeStudent(removed);
                                  _showSnackbar('Removed: $removed',
                                      isError: false);
                                },
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.undo_rounded,
                                        size: 14,
                                        color: Colors.orange.shade700),
                                    const SizedBox(width: 4),
                                    Text(
                                      'Undo last scan',
                                      style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.orange.shade700,
                                          fontWeight: FontWeight.w600),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('Present Count',
                                style: theme.textTheme.labelLarge
                                    ?.copyWith(color: Colors.grey)),
                            const SizedBox(height: 4),
                            Text(
                              '${data.presentCount}',
                              style: theme.textTheme.headlineMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: theme.colorScheme.primary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 24),
                const Divider(),
                const SizedBox(height: 24),
                Text('Manual Entry', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _manualEntryController,
                        decoration: const InputDecoration(
                          hintText: 'Enter Roll Number',
                          border: OutlineInputBorder(),
                          isDense: true,
                          prefixIcon: Icon(Icons.person_add_alt_1),
                        ),
                        textCapitalization: TextCapitalization.characters,
                        onSubmitted: (_) => _onManualSubmit(),
                      ),
                    ),
                    const SizedBox(width: 12),
                    FilledButton(
                      onPressed: _onManualSubmit,
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                      ),
                      child: const Text('Add'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _SummaryRow(this.icon, this.label, this.value);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Row(
      children: [
        Icon(icon, size: 16, color: cs.onSurface.withValues(alpha: 0.5)),
        const SizedBox(width: 8),
        Text('$label: ', style: TextStyle(color: cs.onSurface.withValues(alpha: 0.6), fontSize: 13)),
        Expanded(
          child: Text(value,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              overflow: TextOverflow.ellipsis),
        ),
      ],
    );
  }
}

// ==========================================
// TAB 2: LIVE ATTENDANCE
// ==========================================
class LiveAttendanceTab extends StatefulWidget {
  const LiveAttendanceTab({super.key});

  @override
  State<LiveAttendanceTab> createState() => _LiveAttendanceTabState();
}

class _LiveAttendanceTabState extends State<LiveAttendanceTab> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _onUpdateAttendance() async {
    final provider = Provider.of<AttendanceProvider>(context, listen: false);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        final subject = (provider.subject ?? 'N/A')
            .replaceFirst('Employability Skills - ', 'ES - ');
        return AlertDialog(
          title: const Text('Confirm Submission'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _SummaryRow(Icons.menu_book_outlined, 'Subject', subject),
              const SizedBox(height: 8),
              _SummaryRow(Icons.school_outlined, 'Year', provider.year ?? 'N/A'),
              const SizedBox(height: 8),
              _SummaryRow(Icons.access_time_outlined, 'Session', provider.sessionTime ?? 'N/A'),
              const SizedBox(height: 8),
              _SummaryRow(Icons.people_outline, 'Students', '${provider.presentCount} present'),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Submit'),
            ),
          ],
        );
      },
    );
    if (confirmed != true || !mounted) return;

    final success = await provider.submitAttendance();
    
    if (!mounted) return;
    
    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              Icon(Icons.check_circle, color: Colors.white),
              SizedBox(width: 8),
              Text('Attendance Updated Successfully!', style: TextStyle(fontWeight: FontWeight.bold)),
            ],
          ),
          backgroundColor: Colors.green,
          duration: Duration(seconds: 3),
        ),
      );
      // Pop back to workspace (root), clearing the session details stack
      Navigator.of(context).popUntil((route) => route.isFirst);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            provider.submitError ?? 'Failed to update attendance.',
            style: const TextStyle(fontWeight: FontWeight.bold)
          ),
          backgroundColor: Colors.red.shade700,
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      children: [
        // Present Count Header
        Selector<AttendanceProvider, int>(
          selector: (_, provider) => provider.presentCount,
          builder: (context, presentCount, _) {
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
              color: Colors.grey.withAlpha(25),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Total Present',
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  Chip(
                    label: Text(
                      '$presentCount',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    backgroundColor: theme.colorScheme.primary,
                    labelStyle: TextStyle(color: theme.colorScheme.onPrimary),
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                  ),
                ],
              ),
            );
          },
        ),
        
        // Search Bar
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search Roll Number...',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              isDense: true,
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _searchQuery = '');
                      },
                    )
                  : null,
            ),
            onChanged: (value) => setState(() => _searchQuery = value),
          ),
        ),

        // Searchable ListView
        Expanded(
          child: Selector<AttendanceProvider, List<String>>(
            selector: (_, provider) => provider.scannedStudents,
            builder: (context, scannedStudents, _) {
              final students = scannedStudents.where((roll) {
                return roll.contains(_searchQuery.toUpperCase());
              }).toList();

              if (students.isEmpty) {
                return Center(
                  child: Text(
                    _searchQuery.isEmpty ? 'No Attendance Recorded Yet' : 'No results found',
                    style: const TextStyle(color: Colors.grey, fontSize: 16),
                  ),
                );
              }

              return ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                itemCount: students.length,
                itemBuilder: (context, index) {
                  final rollNumber = students[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8.0),
                    elevation: 1,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: theme.colorScheme.secondaryContainer,
                        child: Icon(Icons.person, color: theme.colorScheme.onSecondaryContainer),
                      ),
                      title: Text(
                        rollNumber,
                        style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1),
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline, color: Colors.red),
                        onPressed: () {
                          Provider.of<AttendanceProvider>(context, listen: false)
                              .removeStudent(rollNumber);
                        },
                        tooltip: 'Delete Attendance',
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),

        // Update Attendance Button
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: Consumer<AttendanceProvider>(
            builder: (context, attendanceProvider, child) {
              return FilledButton.icon(
                onPressed: (attendanceProvider.presentCount > 0 && !attendanceProvider.isSubmitting)
                    ? _onUpdateAttendance
                    : null,
                icon: attendanceProvider.isSubmitting
                    ? const SizedBox(
                        width: 20, 
                        height: 20, 
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)
                      )
                    : const Icon(Icons.cloud_upload),
                label: Text(
                  attendanceProvider.isSubmitting ? 'Updating...' : 'Update Attendance',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                style: FilledButton.styleFrom(
                  minimumSize: const Size(double.infinity, 56),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
