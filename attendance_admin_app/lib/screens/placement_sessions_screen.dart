import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/placement_session_model.dart';
import '../providers/placement_provider.dart';
import '../utils/app_route_observer.dart';

class PlacementSessionsScreen extends StatefulWidget {
  const PlacementSessionsScreen({super.key});

  @override
  State<PlacementSessionsScreen> createState() =>
      _PlacementSessionsScreenState();
}

class _PlacementSessionsScreenState extends State<PlacementSessionsScreen>
    with RouteAware {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<PlacementProvider>(context, listen: false).fetchSessions();
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

  // Refresh when returning from the session detail screen.
  @override
  void didPopNext() {
    Provider.of<PlacementProvider>(context, listen: false).fetchSessions();
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Placement Sessions'),
          centerTitle: true,
          bottom: const TabBar(
            isScrollable: false,
            tabs: [
              Tab(text: 'All'),
              Tab(text: 'Scheduled'),
              Tab(text: 'Live'),
              Tab(text: 'Completed'),
            ],
          ),
        ),
        body: Consumer<PlacementProvider>(
          builder: (context, provider, _) {
            // Initial loading (no data yet)
            if (provider.isLoadingSessions && provider.sessions.isEmpty) {
              return const Center(child: CircularProgressIndicator());
            }

            // Error with no cached data
            if (provider.sessionsError != null && provider.sessions.isEmpty) {
              return _ErrorView(
                message: provider.sessionsError!,
                onRetry: () => provider.fetchSessions(),
              );
            }

            final all = provider.sessions;
            final scheduled =
                all.where((s) => s.status == 'DRAFT').toList();
            final live =
                all.where((s) => s.status == 'ACTIVE').toList();
            final completed = all
                .where((s) =>
                    s.status == 'COMPLETED' || s.status == 'CANCELLED')
                .toList();

            return TabBarView(
              children: [
                _SessionTab(
                  sessions: all,
                  isRefreshing: provider.isLoadingSessions,
                  onRefresh: () => provider.fetchSessions(),
                  emptyMessage: 'No placement sessions yet.',
                  emptyIcon: Icons.work_history_outlined,
                ),
                _SessionTab(
                  sessions: scheduled,
                  isRefreshing: provider.isLoadingSessions,
                  onRefresh: () => provider.fetchSessions(),
                  emptyMessage: 'No scheduled sessions.',
                  emptyIcon: Icons.event_outlined,
                ),
                _SessionTab(
                  sessions: live,
                  isRefreshing: provider.isLoadingSessions,
                  onRefresh: () => provider.fetchSessions(),
                  emptyMessage: 'No live sessions.',
                  emptyIcon: Icons.sensors_outlined,
                ),
                _SessionTab(
                  sessions: completed,
                  isRefreshing: provider.isLoadingSessions,
                  onRefresh: () => provider.fetchSessions(),
                  emptyMessage: 'No completed sessions.',
                  emptyIcon: Icons.check_circle_outline,
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ── Tab content ───────────────────────────────────────────────────────────────

class _SessionTab extends StatelessWidget {
  final List<PlacementSessionModel> sessions;
  final bool isRefreshing;
  final Future<void> Function() onRefresh;
  final String emptyMessage;
  final IconData emptyIcon;

  const _SessionTab({
    required this.sessions,
    required this.isRefreshing,
    required this.onRefresh,
    required this.emptyMessage,
    required this.emptyIcon,
  });

  @override
  Widget build(BuildContext context) {
    if (sessions.isEmpty) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.25),
            _EmptyState(message: emptyMessage, icon: emptyIcon),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        itemCount: sessions.length,
        itemBuilder: (context, index) =>
            _SessionCard(session: sessions[index]),
      ),
    );
  }
}

// ── Session card ──────────────────────────────────────────────────────────────

class _SessionCard extends StatelessWidget {
  final PlacementSessionModel session;

  const _SessionCard({required this.session});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    final dateStr =
        DateFormat('dd MMM yyyy').format(session.date.toLocal());
    final timeStr = DateFormat('h:mm a').format(session.date.toLocal());

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: cs.outlineVariant),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _openDetail(context),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Status + role row
              Row(
                children: [
                  _StatusBadge(status: session.status),
                  const Spacer(),
                  if (session.myRole != null)
                    _RoleBadge(role: session.myRole!, cs: cs),
                ],
              ),
              const SizedBox(height: 10),

              // Drive name
              Text(
                session.title,
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 6),

              // Date + time
              _MetaRow(
                icon: Icons.calendar_today_outlined,
                label: _relativeDate(session.date),
                cs: cs,
              ),

              // Attendance mode
              if (session.attendanceMode != null) ...[
                const SizedBox(height: 4),
                _MetaRow(
                  icon: session.attendanceMode == 'OFFLINE'
                      ? Icons.location_on_outlined
                      : Icons.video_call_outlined,
                  label: session.attendanceMode == 'OFFLINE'
                      ? 'Offline'
                      : 'Virtual',
                  cs: cs,
                ),
              ],

              // Venue
              if (session.venue != null &&
                  session.venue!.isNotEmpty) ...[
                const SizedBox(height: 4),
                _MetaRow(
                  icon: Icons.place_outlined,
                  label: session.venue!,
                  cs: cs,
                ),
              ],

              // Student count
              const SizedBox(height: 4),
              _MetaRow(
                icon: Icons.people_outline,
                label: '${session.studentCount} eligible student'
                    '${session.studentCount == 1 ? '' : 's'}',
                cs: cs,
              ),

              const SizedBox(height: 14),

              // Action button
              _ActionButton(session: session, onTap: () => _openDetail(context)),
            ],
          ),
        ),
      ),
    );
  }

  String _relativeDate(DateTime date) {
    final local = date.toLocal();
    final today = DateTime.now();
    final diff = DateTime(today.year, today.month, today.day)
        .difference(DateTime(local.year, local.month, local.day))
        .inDays;
    final time = DateFormat('h:mm a').format(local);
    if (diff == 0) return 'Today  ·  $time';
    if (diff == 1) return 'Yesterday  ·  $time';
    if (diff < 7) return '$diff days ago  ·  $time';
    return '${DateFormat('dd MMM yyyy').format(local)}  ·  $time';
  }

  void _openDetail(BuildContext context) {
    Navigator.pushNamed(
      context,
      '/placement_session_detail',
      arguments: session,
    );
  }
}

// ── Action button ─────────────────────────────────────────────────────────────

class _ActionButton extends StatelessWidget {
  final PlacementSessionModel session;
  final VoidCallback onTap;

  const _ActionButton({required this.session, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    if (session.status == 'CANCELLED') {
      return const SizedBox.shrink();
    }

    final label = switch (session.status) {
      'COMPLETED' => 'View Report',
      'ACTIVE' => 'Resume',
      _ => session.isOwnerOrEditor ? 'Resume' : 'View',
    };

    final icon = switch (session.status) {
      'COMPLETED' => Icons.bar_chart_outlined,
      'ACTIVE' => Icons.play_arrow_outlined,
      _ => Icons.arrow_forward_outlined,
    };

    final isLive = session.status == 'ACTIVE';

    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        icon: Icon(icon, size: 18),
        label: Text(label),
        onPressed: onTap,
        style: FilledButton.styleFrom(
          backgroundColor: isLive ? cs.primary : cs.secondaryContainer,
          foregroundColor: isLive ? cs.onPrimary : cs.onSecondaryContainer,
          padding: const EdgeInsets.symmetric(vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ),
    );
  }
}

// ── Status badge ──────────────────────────────────────────────────────────────

class _StatusBadge extends StatefulWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  State<_StatusBadge> createState() => _StatusBadgeState();
}

class _StatusBadgeState extends State<_StatusBadge>
    with SingleTickerProviderStateMixin {
  AnimationController? _pulse;

  @override
  void initState() {
    super.initState();
    if (widget.status == 'ACTIVE') {
      _pulse = AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 900),
      )..repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _pulse?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (widget.status) {
      'ACTIVE' => ('Live', Colors.blue.shade600),
      'DRAFT' => ('Scheduled', Colors.orange.shade700),
      'COMPLETED' => ('Completed', Colors.green.shade700),
      _ => ('Cancelled', Colors.grey.shade500),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (widget.status == 'ACTIVE' && _pulse != null) ...[
            AnimatedBuilder(
              animation: _pulse!,
              builder: (_, __) => Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: color.withValues(alpha: 0.45 + 0.55 * _pulse!.value),
                ),
              ),
            ),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Role badge ────────────────────────────────────────────────────────────────

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
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: fg,
        ),
      ),
    );
  }
}

// ── Meta row ──────────────────────────────────────────────────────────────────

class _MetaRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final ColorScheme cs;

  const _MetaRow({
    required this.icon,
    required this.label,
    required this.cs,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 14, color: cs.onSurface.withValues(alpha: 0.45)),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: cs.onSurface.withValues(alpha: 0.65),
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  final String message;
  final IconData icon;

  const _EmptyState({required this.message, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 40),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 56, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          Text(
            message,
            style: TextStyle(
              fontSize: 15,
              color: Colors.grey.shade500,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ── Error view ────────────────────────────────────────────────────────────────

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
