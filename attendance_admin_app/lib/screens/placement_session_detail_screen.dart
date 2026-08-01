import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:open_file/open_file.dart';
import 'package:provider/provider.dart';

import '../models/placement_session_model.dart';
import '../providers/placement_provider.dart';

class PlacementSessionDetailScreen extends StatelessWidget {
  const PlacementSessionDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session =
        ModalRoute.of(context)!.settings.arguments as PlacementSessionModel;

    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    final dateStr =
        DateFormat('EEEE, d MMMM yyyy').format(session.date.toLocal());
    final timeStr = DateFormat('h:mm a').format(session.date.toLocal());

    return Scaffold(
      appBar: AppBar(
        title: Text(
          session.title,
          overflow: TextOverflow.ellipsis,
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status + role
            Row(
              children: [
                _StatusBadge(status: session.status),
                const Spacer(),
                if (session.myRole != null)
                  _RoleBadge(role: session.myRole!, cs: cs),
              ],
            ),
            const SizedBox(height: 20),

            // Details card
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: cs.outlineVariant),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    _DetailRow(
                      icon: Icons.badge_outlined,
                      label: 'Drive Name',
                      value: session.title,
                      cs: cs,
                    ),
                    _Divider(cs: cs),
                    _DetailRow(
                      icon: Icons.calendar_today_outlined,
                      label: 'Date',
                      value: dateStr,
                      cs: cs,
                    ),
                    _Divider(cs: cs),
                    _DetailRow(
                      icon: Icons.access_time_outlined,
                      label: 'Time',
                      value: timeStr,
                      cs: cs,
                    ),
                    _Divider(cs: cs),
                    _DetailRow(
                      icon: session.attendanceMode == 'OFFLINE'
                          ? Icons.location_on_outlined
                          : Icons.video_call_outlined,
                      label: 'Mode',
                      value: session.attendanceMode == 'OFFLINE'
                          ? 'Offline'
                          : session.attendanceMode == 'VIRTUAL'
                              ? 'Virtual'
                              : 'Not specified',
                      cs: cs,
                    ),
                    if (session.venue != null &&
                        session.venue!.isNotEmpty) ...[
                      _Divider(cs: cs),
                      _DetailRow(
                        icon: Icons.place_outlined,
                        label: 'Venue / Link',
                        value: session.venue!,
                        cs: cs,
                      ),
                    ],
                    _Divider(cs: cs),
                    _DetailRow(
                      icon: Icons.people_outline,
                      label: 'Eligible Students',
                      value: session.studentCount == 0
                          ? 'None uploaded'
                          : '${session.studentCount} student'
                              '${session.studentCount == 1 ? '' : 's'}',
                      cs: cs,
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 28),

            // Permission note for viewers
            if (session.myRole == 'VIEWER') ...[
              _InfoBanner(
                icon: Icons.visibility_outlined,
                message:
                    'You have view-only access to this session.',
                cs: cs,
              ),
              const SizedBox(height: 20),
            ],

            // Action section
            _ActionSection(session: session, cs: cs, context: context),
          ],
        ),
      ),
    );
  }
}

// ── Action section ────────────────────────────────────────────────────────────

class _ActionSection extends StatelessWidget {
  final PlacementSessionModel session;
  final ColorScheme cs;
  final BuildContext context;

  const _ActionSection({
    required this.session,
    required this.cs,
    required this.context,
  });

  void _showComingSoon(BuildContext ctx, String feature) {
    ScaffoldMessenger.of(ctx).showSnackBar(
      SnackBar(
        content: Text('$feature — coming soon.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext ctx) {
    final theme = Theme.of(ctx);

    switch (session.status) {
      case 'DRAFT':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'This session is scheduled.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: cs.onSurface.withValues(alpha: 0.65),
              ),
            ),
            const SizedBox(height: 16),
            if (session.isOwnerOrEditor) ...[
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: const Icon(Icons.play_arrow_outlined),
                  label: const Text('Start Session'),
                  onPressed: () => _showComingSoon(ctx, 'Starting session'),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Edit Session'),
                  onPressed: () => _showComingSoon(ctx, 'Editing session'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ],
          ],
        );

      case 'ACTIVE':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _InfoBanner(
              icon: Icons.sensors,
              message: 'This session is currently live.',
              cs: cs,
              color: cs.primary,
            ),
            const SizedBox(height: 16),
            if (session.isOwnerOrEditor)
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: const Icon(Icons.how_to_reg_outlined),
                  label: const Text('Take Attendance'),
                  onPressed: () => Navigator.pushNamed(
                    ctx,
                    '/placement_scanner',
                    arguments: session,
                  ),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
          ],
        );

      case 'COMPLETED':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                icon: const Icon(Icons.bar_chart_outlined),
                label: const Text('View Report'),
                onPressed: () => Navigator.pushNamed(
                  ctx,
                  '/placement_report',
                  arguments: session,
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.green.shade600,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Consumer<PlacementProvider>(
              builder: (_, provider, child) => SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  icon: provider.isDownloadingExcel
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.download_outlined),
                  label: Text(provider.isDownloadingExcel
                      ? 'Downloading…'
                      : 'Download Excel'),
                  onPressed: provider.isDownloadingExcel
                      ? null
                      : () async {
                          final messenger = ScaffoldMessenger.of(ctx);
                          final path = await provider.downloadReportExcel(
                              session.id, session.title);
                          if (path != null) {
                            messenger.showSnackBar(SnackBar(
                              content: const Text('Excel downloaded!',
                                  style: TextStyle(
                                      fontWeight: FontWeight.bold)),
                              backgroundColor: Colors.green,
                              action: SnackBarAction(
                                label: 'Open',
                                textColor: Colors.white,
                                onPressed: () => OpenFile.open(path),
                              ),
                            ));
                          } else {
                            messenger.showSnackBar(SnackBar(
                              content: Text(
                                provider.downloadError ??
                                    'Download failed.',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold),
                              ),
                              backgroundColor: Colors.red.shade700,
                            ));
                          }
                        },
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ),
          ],
        );

      case 'CANCELLED':
        return _InfoBanner(
          icon: Icons.cancel_outlined,
          message: 'This session has been cancelled.',
          cs: cs,
          color: Colors.grey.shade500,
        );

      default:
        return const SizedBox.shrink();
    }
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────

class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (status) {
      'ACTIVE' => ('● Live', Colors.blue.shade600),
      'DRAFT' => ('Scheduled', Colors.orange.shade700),
      'COMPLETED' => ('Completed', Colors.green.shade700),
      _ => ('Cancelled', Colors.grey.shade500),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

class _RoleBadge extends StatelessWidget {
  final String role;
  final ColorScheme cs;

  const _RoleBadge({required this.role, required this.cs});

  @override
  Widget build(BuildContext context) {
    final (label, bg, fg) = switch (role) {
      'OWNER' => ('Owner', cs.primaryContainer, cs.primary),
      'EDITOR' => ('Editor', cs.secondaryContainer, cs.secondary),
      _ => ('Viewer', cs.surfaceContainerHighest, cs.onSurfaceVariant),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: fg,
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final ColorScheme cs;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.cs,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: cs.onSurface.withValues(alpha: 0.45)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    color: cs.onSurface.withValues(alpha: 0.5),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  final ColorScheme cs;
  const _Divider({required this.cs});

  @override
  Widget build(BuildContext context) {
    return Divider(
      height: 1,
      thickness: 1,
      color: cs.outlineVariant.withValues(alpha: 0.5),
    );
  }
}

class _InfoBanner extends StatelessWidget {
  final IconData icon;
  final String message;
  final ColorScheme cs;
  final Color? color;

  const _InfoBanner({
    required this.icon,
    required this.message,
    required this.cs,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? cs.onSurface.withValues(alpha: 0.5);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: c),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(fontSize: 13, color: c),
            ),
          ),
        ],
      ),
    );
  }
}
