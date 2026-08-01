import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:vibration/vibration.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../models/placement_session_model.dart';
import '../models/placement_attendance_entry.dart';
import '../providers/placement_provider.dart';
import '../services/api_config_service.dart';

class PlacementScannerScreen extends StatefulWidget {
  const PlacementScannerScreen({super.key});

  @override
  State<PlacementScannerScreen> createState() => _PlacementScannerScreenState();
}

class _PlacementScannerScreenState extends State<PlacementScannerScreen> {
  PlacementSessionModel? _session;
  PlacementProvider? _provider;
  bool _initialized = false;
  bool _isVirtual = false;
  String _attendUrl = '';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _provider ??= Provider.of<PlacementProvider>(context, listen: false);
    if (!_initialized) {
      _initialized = true;
      _session =
          ModalRoute.of(context)!.settings.arguments as PlacementSessionModel;
      _isVirtual = _session!.attendanceMode == 'VIRTUAL';

      if (_isVirtual) {
        final configService =
            Provider.of<ApiConfigService>(context, listen: false);
        _attendUrl = _buildAttendUrl(configService.baseUrl, _session!.id);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _provider!.startVirtualPolling(_session!.id);
        });
      } else {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _provider!.initScanner(_session!.id);
        });
      }
    }
  }

  @override
  void dispose() {
    _provider?.stopPolling();
    super.dispose();
  }

  static String _buildAttendUrl(String apiBaseUrl, String sessionId) {
    final uri = Uri.parse(apiBaseUrl);
    // Strip /api/v1 path to get host origin only.
    final origin =
        '${uri.scheme}://${uri.host}${(uri.port != 80 && uri.port != 443 && uri.port != 0) ? ':${uri.port}' : ''}';
    return '$origin/attend/$sessionId';
  }

  Future<bool?> _confirmOfflineBack(BuildContext context) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Leave Scanner?'),
        content: const Text(
            'Your scans are saved locally. You can return to submit them later.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Stay'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Go Back'),
          ),
        ],
      ),
    );
  }

  Future<void> _handleBack(BuildContext context) async {
    if (_isVirtual) {
      Navigator.of(context).pop();
      return;
    }
    final leave = await _confirmOfflineBack(context);
    if (leave == true && context.mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final session = _session;
    if (session == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final tabs = _isVirtual
        ? const [
            Tab(text: 'QR CODE', icon: Icon(Icons.qr_code_2)),
            Tab(text: 'LIVE ATTENDANCE', icon: Icon(Icons.people_alt)),
          ]
        : const [
            Tab(text: 'SCANNER', icon: Icon(Icons.qr_code_scanner)),
            Tab(text: 'LIVE ATTENDANCE', icon: Icon(Icons.people_alt)),
          ];

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
            title: Text(session.title, overflow: TextOverflow.ellipsis),
            centerTitle: true,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () => _handleBack(context),
            ),
            bottom: TabBar(tabs: tabs),
          ),
          body: TabBarView(
            physics: const NeverScrollableScrollPhysics(),
            children: _isVirtual
                ? [
                    _VirtualQrTab(session: session, attendUrl: _attendUrl),
                    _VirtualLiveTab(session: session),
                  ]
                : [
                    _ScannerTab(session: session),
                    _LiveAttendanceTab(session: session),
                  ],
          ),
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 1: SCANNER
// ──────────────────────────────────────────────────────────────────────────────

class _ScannerTab extends StatefulWidget {
  final PlacementSessionModel session;
  const _ScannerTab({required this.session});

  @override
  State<_ScannerTab> createState() => _ScannerTabState();
}

class _ScannerTabState extends State<_ScannerTab>
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
      final provider = Provider.of<PlacementProvider>(context, listen: false);
      final error = provider.addScan(rollNumber);
      if (error != null) {
        _showSnackbar(error, isError: true);
      } else {
        final name = provider.getStudentName(rollNumber.trim().toUpperCase()) ?? '';
        final display =
            name.isNotEmpty ? '$name (${rollNumber.trim().toUpperCase()})' : rollNumber.trim().toUpperCase();
        _showSnackbar('✓ Recorded: $display', isError: false);
        _triggerVibration();
      }
    } finally {
      _isProcessingScan = false;
    }
  }

  void _triggerVibration() {
    Vibration.hasVibrator().then((hasVibrator) {
      if (hasVibrator == true) Vibration.vibrate(duration: 150);
    }).catchError((_) {});
  }

  void _onManualSubmit() {
    final rollNumber = _manualEntryController.text.trim().toUpperCase();
    if (rollNumber.isEmpty) {
      _showSnackbar('Please enter a valid roll number.', isError: true);
      return;
    }
    _processRollNumber(rollNumber);
    _manualEntryController.clear();
  }

  void _showSnackbar(String message, {required bool isError}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message,
            style: const TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor:
            isError ? Colors.red.shade700 : Colors.green.shade700,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final theme = Theme.of(context);

    return Selector<PlacementProvider, bool>(
      selector: (_, p) => p.isLoadingEligibility,
      builder: (context, isLoading, _) {
        if (isLoading) {
          return const Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(),
                SizedBox(height: 16),
                Text('Loading eligibility list…'),
              ],
            ),
          );
        }

        return Selector<PlacementProvider, String?>(
          selector: (_, p) => p.eligibilityLoadError,
          builder: (context, loadError, _) {
            if (loadError != null) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.cloud_off_outlined,
                          size: 52, color: Colors.grey),
                      const SizedBox(height: 16),
                      Text(
                        loadError,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.grey),
                      ),
                      const SizedBox(height: 20),
                      FilledButton.icon(
                        icon: const Icon(Icons.refresh),
                        label: const Text('Retry'),
                        onPressed: () =>
                            Provider.of<PlacementProvider>(context,
                                    listen: false)
                                .retryInitScanner(),
                      ),
                    ],
                  ),
                ),
              );
            }

            if (_isCheckingPermission) {
              return const Center(child: CircularProgressIndicator());
            }

            if (!_hasPermission) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.camera_alt_outlined,
                        size: 64, color: Colors.grey),
                    const SizedBox(height: 16),
                    const Text('Camera Permission Required',
                        style: TextStyle(fontSize: 18)),
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
                // Camera preview
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
                              final barcodes = capture.barcodes;
                              if (barcodes.isNotEmpty) {
                                final code = barcodes.first.rawValue;
                                if (code != null) {
                                  _processRollNumber(code.trim().toUpperCase());
                                }
                              }
                            },
                          ),
                        ),
                        Container(
                          width: 250,
                          height: 250,
                          decoration: BoxDecoration(
                            border: Border.all(
                                color: Colors.green.withAlpha(128), width: 3),
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Status + manual entry
                Expanded(
                  flex: 5,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Selector<PlacementProvider,
                            ({String? lastScanned, String? name, int scannedCount})>(
                          selector: (_, p) => (
                            lastScanned: p.lastScanned,
                            name: p.lastScanned != null
                                ? p.getStudentName(p.lastScanned!)
                                : null,
                            scannedCount: p.scannedCount,
                          ),
                          builder: (context, data, _) {
                            return Row(
                              mainAxisAlignment:
                                  MainAxisAlignment.spaceBetween,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text('Last Scanned',
                                          style: theme.textTheme.labelLarge
                                              ?.copyWith(
                                                  color: Colors.grey)),
                                      const SizedBox(height: 4),
                                      Text(
                                        data.lastScanned ?? 'None',
                                        style: theme.textTheme.titleLarge
                                            ?.copyWith(
                                          fontWeight: FontWeight.bold,
                                          color: data.lastScanned != null
                                              ? theme.colorScheme.primary
                                              : Colors.grey,
                                          letterSpacing: 1,
                                        ),
                                      ),
                                      if (data.name != null) ...[
                                        const SizedBox(height: 2),
                                        Text(
                                          data.name!,
                                          style: theme.textTheme.bodySmall
                                              ?.copyWith(
                                                  color: Colors.grey.shade600),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ],
                                      if (data.lastScanned != null) ...[
                                        const SizedBox(height: 6),
                                        GestureDetector(
                                          onTap: () {
                                            final p =
                                                Provider.of<PlacementProvider>(
                                                    context,
                                                    listen: false);
                                            final removed = p.lastScanned;
                                            if (removed == null) return;
                                            p.removeScan(removed);
                                            _showSnackbar('Removed: $removed',
                                                isError: false);
                                          },
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Icon(Icons.undo_rounded,
                                                  size: 14,
                                                  color:
                                                      Colors.orange.shade700),
                                              const SizedBox(width: 4),
                                              Text(
                                                'Undo last scan',
                                                style: TextStyle(
                                                    fontSize: 12,
                                                    color:
                                                        Colors.orange.shade700,
                                                    fontWeight:
                                                        FontWeight.w600),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text('Present',
                                        style: theme.textTheme.labelLarge
                                            ?.copyWith(color: Colors.grey)),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${data.scannedCount}',
                                      style: theme.textTheme.headlineMedium
                                          ?.copyWith(
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
                        const SizedBox(height: 16),
                        Text('Manual Entry',
                            style: theme.textTheme.titleMedium
                                ?.copyWith(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _manualEntryController,
                                decoration: const InputDecoration(
                                  hintText: 'Enter Roll Number',
                                  border: OutlineInputBorder(),
                                  isDense: true,
                                  prefixIcon:
                                      Icon(Icons.person_add_alt_1),
                                ),
                                textCapitalization:
                                    TextCapitalization.characters,
                                onSubmitted: (_) => _onManualSubmit(),
                              ),
                            ),
                            const SizedBox(width: 12),
                            FilledButton(
                              onPressed: _onManualSubmit,
                              style: FilledButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 24, vertical: 16),
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
          },
        );
      },
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 2: LIVE ATTENDANCE
// ──────────────────────────────────────────────────────────────────────────────

class _LiveAttendanceTab extends StatefulWidget {
  final PlacementSessionModel session;
  const _LiveAttendanceTab({required this.session});

  @override
  State<_LiveAttendanceTab> createState() => _LiveAttendanceTabState();
}

class _LiveAttendanceTabState extends State<_LiveAttendanceTab> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _onFinalize(BuildContext context) async {
    final provider = Provider.of<PlacementProvider>(context, listen: false);
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);

    final confirmed = await _showFinalizeConfirmation(
      context,
      presentCount: provider.scannedCount,
      absentStudents: provider.pendingOfflineStudents,
    );

    if (confirmed != true || !mounted) return;

    final rollNumbers = provider.scannedRolls.toList();
    final success = await provider.finalizeSession(widget.session.id, rollNumbers);
    if (!mounted) return;

    if (success) {
      messenger.showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              Icon(Icons.lock, color: Colors.white),
              SizedBox(width: 8),
              Text('Attendance finalized. Session locked.',
                  style: TextStyle(fontWeight: FontWeight.bold)),
            ],
          ),
          backgroundColor: Colors.green,
          duration: Duration(seconds: 3),
        ),
      );
      nav.pop();
    } else {
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            provider.finalizeError ?? 'Failed to finalize attendance.',
            style: const TextStyle(fontWeight: FontWeight.bold),
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
    final cs = theme.colorScheme;

    return Column(
      children: [
        // Count summary row
        Selector<PlacementProvider,
            ({int eligible, int scanned, int pending})>(
          selector: (_, p) => (
            eligible: p.eligibleCount,
            scanned: p.scannedCount,
            pending: p.pendingCount,
          ),
          builder: (context, counts, _) {
            return Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: cs.surfaceContainerLow,
              child: Row(
                children: [
                  _CountChip(
                    label: 'Eligible',
                    count: counts.eligible,
                    color: cs.onSurface.withValues(alpha: 0.6),
                    bg: cs.surfaceContainerHighest,
                  ),
                  const SizedBox(width: 10),
                  _CountChip(
                    label: 'Present',
                    count: counts.scanned,
                    color: Colors.green.shade700,
                    bg: Colors.green.withValues(alpha: 0.1),
                  ),
                  const SizedBox(width: 10),
                  _CountChip(
                    label: 'Pending',
                    count: counts.pending,
                    color: Colors.orange.shade700,
                    bg: Colors.orange.withValues(alpha: 0.1),
                  ),
                ],
              ),
            );
          },
        ),

        // Search bar
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search roll number…',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12)),
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
            onChanged: (v) => setState(() => _searchQuery = v),
          ),
        ),

        // Scanned list
        Expanded(
          child: Selector<PlacementProvider, List<String>>(
            selector: (_, p) => p.scannedRolls,
            builder: (context, rolls, _) {
              final provider =
                  Provider.of<PlacementProvider>(context, listen: false);
              final filtered = rolls
                  .where((r) =>
                      r.contains(_searchQuery.toUpperCase()))
                  .toList();

              if (filtered.isEmpty) {
                return Center(
                  child: Text(
                    _searchQuery.isEmpty
                        ? 'No attendance recorded yet.'
                        : 'No results found.',
                    style:
                        const TextStyle(color: Colors.grey, fontSize: 16),
                  ),
                );
              }

              return ListView.builder(
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 8),
                itemCount: filtered.length,
                itemBuilder: (context, index) {
                  final roll = filtered[index];
                  final name = provider.getStudentName(roll) ?? '';
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    elevation: 1,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: cs.secondaryContainer,
                        child: Icon(Icons.person,
                            color: cs.onSecondaryContainer),
                      ),
                      title: Text(
                        roll,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1),
                      ),
                      subtitle: name.isNotEmpty ? Text(name) : null,
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline,
                            color: Colors.red),
                        tooltip: 'Remove',
                        onPressed: () =>
                            Provider.of<PlacementProvider>(context,
                                    listen: false)
                                .removeScan(roll),
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),

        // Finalize button
        Padding(
          padding: const EdgeInsets.all(16),
          child: Consumer<PlacementProvider>(
            builder: (context, provider, _) {
              return FilledButton.icon(
                onPressed: (!provider.isFinalizing &&
                        !provider.isLoadingEligibility)
                    ? () => _onFinalize(context)
                    : null,
                icon: provider.isFinalizing
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.lock_outline),
                label: Text(
                  provider.isFinalizing
                      ? 'Finalizing…'
                      : 'Finalize Attendance',
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.bold),
                ),
                style: FilledButton.styleFrom(
                  minimumSize: const Size(double.infinity, 56),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────

class _CountChip extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  final Color bg;

  const _CountChip({
    required this.label,
    required this.count,
    required this.color,
    required this.bg,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '$count',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            Text(
              label,
              style: TextStyle(fontSize: 12, color: color),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _SummaryRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Row(
      children: [
        Icon(icon, size: 16, color: cs.onSurface.withValues(alpha: 0.5)),
        const SizedBox(width: 8),
        Text('$label: ',
            style: TextStyle(
                color: cs.onSurface.withValues(alpha: 0.6), fontSize: 13)),
        Expanded(
          child: Text(
            value,
            style:
                const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// SHARED: Finalize confirmation dialog
// ──────────────────────────────────────────────────────────────────────────────

Future<bool?> _showFinalizeConfirmation(
  BuildContext context, {
  required int presentCount,
  required List<PlacementAttendanceEntry> absentStudents,
}) {
  final absentCount = absentStudents.length;
  return showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Finalize Attendance?'),
      content: SizedBox(
        width: double.maxFinite,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.warning_amber_rounded,
                      size: 16, color: Colors.red.shade700),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'This action is permanent and cannot be undone.',
                      style: TextStyle(
                          fontSize: 12, color: Colors.red.shade700),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            _SummaryRow(
              icon: Icons.check_circle_outline,
              label: 'Present',
              value:
                  '$presentCount student${presentCount == 1 ? '' : 's'}',
            ),
            const SizedBox(height: 8),
            _SummaryRow(
              icon: Icons.person_off_outlined,
              label: 'Will be Absent',
              value: '$absentCount student${absentCount == 1 ? '' : 's'}',
            ),
            if (absentStudents.isNotEmpty) ...[
              const SizedBox(height: 14),
              Text(
                'Students who will be marked Absent:',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade600),
              ),
              const SizedBox(height: 6),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 180),
                child: Scrollbar(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: absentStudents.length,
                    separatorBuilder: (context, i) =>
                        const Divider(height: 1),
                    itemBuilder: (_, i) {
                      final s = absentStudents[i];
                      return Padding(
                        padding:
                            const EdgeInsets.symmetric(vertical: 5),
                        child: Row(
                          children: [
                            Icon(Icons.person_off_outlined,
                                size: 13,
                                color: Colors.grey.shade400),
                            const SizedBox(width: 6),
                            Text(
                              s.rollNumber,
                              style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 0.4),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                s.name,
                                style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey.shade600),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(ctx).pop(true),
          style: FilledButton.styleFrom(
              backgroundColor: Colors.red.shade700),
          child: const Text('Finalize'),
        ),
      ],
    ),
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// VIRTUAL MODE — TAB 1: QR CODE
// ──────────────────────────────────────────────────────────────────────────────

class _VirtualQrTab extends StatelessWidget {
  final PlacementSessionModel session;
  final String attendUrl;

  const _VirtualQrTab({required this.session, required this.attendUrl});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Instructions banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: cs.primaryContainer.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: cs.primary.withValues(alpha: 0.25)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline, size: 18, color: cs.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Students: Open your camera or Google Lens and scan this QR code to mark your attendance.',
                    style: TextStyle(fontSize: 13, color: cs.onPrimaryContainer),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 32),

          // QR code card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 20,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: QrImageView(
              data: attendUrl,
              version: QrVersions.auto,
              size: 220,
              errorCorrectionLevel: QrErrorCorrectLevel.H,
              backgroundColor: Colors.white,
            ),
          ),

          const SizedBox(height: 20),

          // Drive name
          Text(
            session.title,
            style: theme.textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),

          // URL display (selectable for copy)
          SelectableText(
            attendUrl,
            style: theme.textTheme.bodySmall?.copyWith(
              color: cs.onSurface.withValues(alpha: 0.5),
              fontFamily: 'monospace',
            ),
            textAlign: TextAlign.center,
          ),

          const SizedBox(height: 24),

          // Eligible count
          Selector<PlacementProvider, int>(
            selector: (_, p) => p.virtualEligibleCount,
            builder: (_, count, _) => Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: cs.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.people_outline,
                      size: 18, color: cs.onSurface.withValues(alpha: 0.6)),
                  const SizedBox(width: 8),
                  Text(
                    '$count eligible student${count == 1 ? '' : 's'}',
                    style: TextStyle(
                        fontSize: 13,
                        color: cs.onSurface.withValues(alpha: 0.7)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// VIRTUAL MODE — TAB 2: LIVE ATTENDANCE (polling)
// ──────────────────────────────────────────────────────────────────────────────

class _VirtualLiveTab extends StatefulWidget {
  final PlacementSessionModel session;

  const _VirtualLiveTab({required this.session});

  @override
  State<_VirtualLiveTab> createState() => _VirtualLiveTabState();
}

class _VirtualLiveTabState extends State<_VirtualLiveTab> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _onFinalize(BuildContext context) async {
    final provider = Provider.of<PlacementProvider>(context, listen: false);
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);

    final confirmed = await _showFinalizeConfirmation(
      context,
      presentCount: provider.virtualPresentCount,
      absentStudents: provider.virtualPendingStudents,
    );

    if (confirmed != true || !mounted) return;

    final success =
        await provider.finalizeSession(widget.session.id, []);
    if (!mounted) return;

    if (success) {
      messenger.showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              Icon(Icons.lock, color: Colors.white),
              SizedBox(width: 8),
              Text('Attendance finalized. Session locked.',
                  style: TextStyle(fontWeight: FontWeight.bold)),
            ],
          ),
          backgroundColor: Colors.green,
          duration: Duration(seconds: 3),
        ),
      );
      nav.pop();
    } else {
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            provider.finalizeError ?? 'Failed to finalize attendance.',
            style: const TextStyle(fontWeight: FontWeight.bold),
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
    final cs = theme.colorScheme;

    return Column(
      children: [
        // Count chips
        Selector<PlacementProvider,
            ({int eligible, int present, int pending})>(
          selector: (_, p) => (
            eligible: p.virtualEligibleCount,
            present: p.virtualPresentCount,
            pending: p.virtualPendingCount,
          ),
          builder: (_, counts, _) => Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: cs.surfaceContainerLow,
            child: Row(
              children: [
                _CountChip(
                  label: 'Eligible',
                  count: counts.eligible,
                  color: cs.onSurface.withValues(alpha: 0.6),
                  bg: cs.surfaceContainerHighest,
                ),
                const SizedBox(width: 10),
                _CountChip(
                  label: 'Present',
                  count: counts.present,
                  color: Colors.green.shade700,
                  bg: Colors.green.withValues(alpha: 0.1),
                ),
                const SizedBox(width: 10),
                _CountChip(
                  label: 'Pending',
                  count: counts.pending,
                  color: Colors.orange.shade700,
                  bg: Colors.orange.withValues(alpha: 0.1),
                ),
              ],
            ),
          ),
        ),

        // Auto-refresh progress indicator
        Selector<PlacementProvider, bool>(
          selector: (_, p) => p.isPollingLoading,
          builder: (_, loading, _) => loading
              ? const LinearProgressIndicator(minHeight: 2)
              : const SizedBox(height: 2),
        ),

        // Search bar
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search pending students…',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12)),
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
            onChanged: (v) => setState(() => _searchQuery = v),
          ),
        ),

        // Section header
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
          child: Row(
            children: [
              Text(
                'Pending Students',
                style: theme.textTheme.labelLarge?.copyWith(
                    color: cs.onSurface.withValues(alpha: 0.55)),
              ),
              const Spacer(),
              Text(
                'Auto-refreshing every 5s',
                style: theme.textTheme.labelSmall?.copyWith(
                    color: cs.onSurface.withValues(alpha: 0.4)),
              ),
            ],
          ),
        ),

        // Pending student list (takes remaining space above the finalize button)
        Expanded(
          child: Selector<PlacementProvider, List<PlacementAttendanceEntry>>(
            selector: (_, p) => p.virtualPendingStudents,
            builder: (context, pending, _) {
              final filtered = pending.where((s) {
                final q = _searchQuery.toUpperCase();
                return s.rollNumber.contains(q) ||
                    s.name.toUpperCase().contains(q);
              }).toList();

              if (pending.isEmpty) {
                return RefreshIndicator(
                  onRefresh: () =>
                      Provider.of<PlacementProvider>(context, listen: false)
                          .refreshVirtualStudents(widget.session.id),
                  child: ListView(
                    children: [
                      SizedBox(
                          height: MediaQuery.of(context).size.height * 0.15),
                      Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.check_circle_outline,
                                size: 56, color: Colors.green.shade300),
                            const SizedBox(height: 12),
                            Text(
                              'All students have marked attendance!',
                              style: TextStyle(
                                  fontSize: 15,
                                  color: Colors.green.shade700,
                                  fontWeight: FontWeight.w600),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }

              if (filtered.isEmpty) {
                return const Center(
                  child: Text('No results found.',
                      style: TextStyle(color: Colors.grey, fontSize: 15)),
                );
              }

              return RefreshIndicator(
                onRefresh: () =>
                    Provider.of<PlacementProvider>(context, listen: false)
                        .refreshVirtualStudents(widget.session.id),
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 8),
                  itemCount: filtered.length,
                  itemBuilder: (_, i) {
                    final student = filtered[i];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                        side: BorderSide(
                            color: cs.outlineVariant.withValues(alpha: 0.6)),
                      ),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor:
                              Colors.orange.withValues(alpha: 0.12),
                          child: Text(
                            student.name.isNotEmpty
                                ? student.name[0].toUpperCase()
                                : '?',
                            style: TextStyle(
                                color: Colors.orange.shade800,
                                fontWeight: FontWeight.bold),
                          ),
                        ),
                        title: Text(
                          student.rollNumber,
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, letterSpacing: 0.5),
                        ),
                        subtitle: Text(student.name),
                        trailing: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.orange.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            'Pending',
                            style: TextStyle(
                                fontSize: 11,
                                color: Colors.orange.shade800,
                                fontWeight: FontWeight.w600),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              );
            },
          ),
        ),

        // Finalize button
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Consumer<PlacementProvider>(
            builder: (context, provider, _) => FilledButton.icon(
              onPressed: provider.isFinalizing
                  ? null
                  : () => _onFinalize(context),
              icon: provider.isFinalizing
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.lock_outline),
              label: Text(
                provider.isFinalizing ? 'Finalizing…' : 'Finalize Attendance',
                style: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.bold),
              ),
              style: FilledButton.styleFrom(
                minimumSize: const Size(double.infinity, 56),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
