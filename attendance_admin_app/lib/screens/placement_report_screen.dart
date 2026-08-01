import 'package:flutter/material.dart';
import 'package:open_file/open_file.dart';
import 'package:provider/provider.dart';

import '../models/placement_report_model.dart';
import '../models/placement_session_model.dart';
import '../providers/placement_provider.dart';

class PlacementReportScreen extends StatefulWidget {
  const PlacementReportScreen({super.key});

  @override
  State<PlacementReportScreen> createState() => _PlacementReportScreenState();
}

class _PlacementReportScreenState extends State<PlacementReportScreen> {
  PlacementSessionModel? _session;
  bool _initialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_initialized) {
      _initialized = true;
      _session =
          ModalRoute.of(context)!.settings.arguments as PlacementSessionModel;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Provider.of<PlacementProvider>(context, listen: false)
            .loadReport(_session!.id);
      });
    }
  }

  Future<void> _onDownload(BuildContext context) async {
    final provider = Provider.of<PlacementProvider>(context, listen: false);
    final messenger = ScaffoldMessenger.of(context);
    final path =
        await provider.downloadReportExcel(_session!.id, _session!.title);
    if (path != null) {
      messenger.showSnackBar(
        SnackBar(
          content: const Row(
            children: [
              Icon(Icons.check_circle, color: Colors.white),
              SizedBox(width: 8),
              Expanded(
                child: Text('Excel downloaded successfully.',
                    style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          backgroundColor: Colors.green,
          duration: const Duration(seconds: 5),
          action: SnackBarAction(
            label: 'Open',
            textColor: Colors.white,
            onPressed: () => OpenFile.open(path),
          ),
        ),
      );
    } else {
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            provider.downloadError ?? 'Failed to download Excel.',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          backgroundColor: Colors.red.shade700,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = _session;
    if (session == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(session.title, overflow: TextOverflow.ellipsis),
        centerTitle: true,
      ),
      body: Consumer<PlacementProvider>(
        builder: (context, provider, _) {
          if (provider.isLoadingReport) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.reportError != null) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline,
                        size: 52, color: Colors.grey),
                    const SizedBox(height: 16),
                    Text(
                      provider.reportError!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.grey),
                    ),
                    const SizedBox(height: 20),
                    FilledButton.icon(
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry'),
                      onPressed: () => provider.loadReport(session.id),
                    ),
                  ],
                ),
              ),
            );
          }

          final report = provider.report;
          if (report == null) return const SizedBox.shrink();

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Summary chips ───────────────────────────────────────────
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 12),
                color: cs.surfaceContainerLow,
                child: Row(
                  children: [
                    _CountChip(
                      label: 'Eligible',
                      count: report.eligible,
                      color: cs.onSurface.withValues(alpha: 0.6),
                      bg: cs.surfaceContainerHighest,
                    ),
                    const SizedBox(width: 10),
                    _CountChip(
                      label: 'Present',
                      count: report.present,
                      color: Colors.green.shade700,
                      bg: Colors.green.withValues(alpha: 0.1),
                    ),
                    const SizedBox(width: 10),
                    _CountChip(
                      label: 'Absent',
                      count: report.absent,
                      color: Colors.red.shade700,
                      bg: Colors.red.withValues(alpha: 0.1),
                    ),
                  ],
                ),
              ),

              // ── Download button ─────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: FilledButton.icon(
                  onPressed: provider.isDownloadingExcel
                      ? null
                      : () => _onDownload(context),
                  icon: provider.isDownloadingExcel
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.download_outlined),
                  label: Text(
                    provider.isDownloadingExcel
                        ? 'Downloading…'
                        : 'Download Excel',
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(double.infinity, 52),
                    backgroundColor: Colors.green.shade600,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),

              // ── Absent students header ──────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 6),
                child: Row(
                  children: [
                    Text(
                      'Absent Students',
                      style: theme.textTheme.titleSmall
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.red.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '${report.absent}',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: Colors.red.shade700),
                      ),
                    ),
                  ],
                ),
              ),

              // ── Absent student list ─────────────────────────────────────
              Expanded(
                child: report.absentStudents.isEmpty
                    ? _buildAllPresentState(cs)
                    : ListView.builder(
                        padding:
                            const EdgeInsets.fromLTRB(16, 0, 16, 24),
                        itemCount: report.absentStudents.length,
                        itemBuilder: (context, index) {
                          return _AbsentStudentCard(
                            student: report.absentStudents[index],
                            cs: cs,
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildAllPresentState(ColorScheme cs) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.how_to_reg, size: 64, color: Colors.green.shade300),
          const SizedBox(height: 16),
          Text(
            'Full Attendance!',
            style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.green.shade700),
          ),
          const SizedBox(height: 8),
          Text(
            'All eligible students were present.',
            style:
                TextStyle(color: cs.onSurface.withValues(alpha: 0.6)),
          ),
        ],
      ),
    );
  }
}

// ── Widgets ───────────────────────────────────────────────────────────────────

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
        padding:
            const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
        decoration:
            BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('$count',
                style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: color)),
            Text(label, style: TextStyle(fontSize: 12, color: color)),
          ],
        ),
      ),
    );
  }
}

class _AbsentStudentCard extends StatelessWidget {
  final PlacementReportStudent student;
  final ColorScheme cs;

  const _AbsentStudentCard({required this.student, required this.cs});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.6)),
      ),
      child: Padding(
        padding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: Colors.red.withValues(alpha: 0.1),
              child: Text(
                student.name.isNotEmpty
                    ? student.name[0].toUpperCase()
                    : '?',
                style: TextStyle(
                    color: Colors.red.shade700,
                    fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    student.rollNumber,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, letterSpacing: 0.5),
                  ),
                  Text(
                    student.name,
                    style: TextStyle(
                        color: cs.onSurface.withValues(alpha: 0.65),
                        fontSize: 13),
                  ),
                ],
              ),
            ),
            if (student.phoneNumber != null) ...[
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Icon(Icons.phone_outlined,
                      size: 14,
                      color: cs.onSurface.withValues(alpha: 0.4)),
                  const SizedBox(height: 2),
                  Text(
                    student.phoneNumber!,
                    style: TextStyle(
                        fontSize: 11,
                        color: cs.onSurface.withValues(alpha: 0.55)),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
