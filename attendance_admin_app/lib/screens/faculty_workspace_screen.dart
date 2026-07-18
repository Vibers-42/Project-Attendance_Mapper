import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/attendance_session_model.dart';
import '../providers/auth_provider.dart';
import '../providers/attendance_provider.dart';
import '../providers/attendance_history_provider.dart';
import '../utils/app_route_observer.dart';

class FacultyWorkspaceScreen extends StatefulWidget {
  const FacultyWorkspaceScreen({super.key});

  @override
  State<FacultyWorkspaceScreen> createState() => _FacultyWorkspaceScreenState();
}

class _FacultyWorkspaceScreenState extends State<FacultyWorkspaceScreen>
    with RouteAware {
  late final String _greeting;

  @override
  void initState() {
    super.initState();
    final hour = DateTime.now().hour;
    _greeting = hour < 12
        ? 'Good Morning,'
        : hour < 17
            ? 'Good Afternoon,'
            : 'Good Evening,';
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadRecentSessions();
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

  // Called when the workspace is revealed after a sub-route is popped (e.g. coming back from history)
  @override
  void didPopNext() {
    _loadRecentSessions();
  }

  void _loadRecentSessions() {
    Provider.of<AttendanceHistoryProvider>(context, listen: false)
        .fetchRecentSessions();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final faculty = Provider.of<AuthProvider>(context).currentUser;

    final String rawName = faculty?.name ?? 'Faculty';
    final String facultyName = rawName
        .split(' ')
        .map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1).toLowerCase())
        .join(' ');

    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // Greeting + name
                  Text(
                    _greeting,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: colorScheme.onSurface.withValues(alpha: 0.60),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    facultyName,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: colorScheme.primary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    DateFormat('EEEE, d MMMM').format(DateTime.now()),
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurface.withValues(alpha: 0.45),
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Active session banner
                  Selector<AttendanceProvider, bool>(
                    selector: (_, p) => p.hasActiveSession,
                    builder: (context, hasActive, _) {
                      if (!hasActive) return const SizedBox.shrink();
                      return const Column(
                        children: [
                          _ActiveSessionCard(),
                          SizedBox(height: 24),
                        ],
                      );
                    },
                  ),

                  // Quick Actions
                  Text(
                    'Quick Actions',
                    style: theme.textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 14),
                  _buildQuickActionsGrid(context, colorScheme),
                  const SizedBox(height: 32),

                  // Recent Activity header
                  Text(
                    'Recent Activity',
                    style: theme.textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 14),
                ]),
              ),
            ),

            // Recent sessions — uses the SEPARATE recentSessions list, never affected by filters
            Consumer<AttendanceHistoryProvider>(
              builder: (context, historyProvider, child) {
                if (historyProvider.isLoadingRecent &&
                    historyProvider.recentSessions.isEmpty) {
                  return const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.all(40.0),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                  );
                }

                if (historyProvider.recentSessions.isEmpty) {
                  return SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      child: Column(
                        children: [
                          Icon(Icons.history_edu,
                              size: 52, color: Colors.grey.shade300),
                          const SizedBox(height: 12),
                          Text(
                            'No recent sessions found.',
                            style: TextStyle(color: Colors.grey.shade500),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                return SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20.0),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) => _RecentSessionTile(
                          session: historyProvider.recentSessions[index]),
                      childCount: historyProvider.recentSessions.length,
                    ),
                  ),
                );
              },
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 40)),
          ],
        ),
      ),
    );
  }

  void _handleNewSession(BuildContext context) {
    final provider =
        Provider.of<AttendanceProvider>(context, listen: false);
    if (!provider.hasActiveSession) {
      Navigator.pushNamed(context, '/create_session');
      return;
    }

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Active Session Found'),
        content: const Text(
            'You already have a session in progress. Would you like to resume it or start a completely new one?'),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              Navigator.pushNamed(context, '/scanner');
            },
            child: const Text('Resume'),
          ),
          FilledButton(
            onPressed: () {
              provider.discardSession();
              Navigator.of(ctx).pop();
              Navigator.pushNamed(context, '/create_session');
            },
            child: const Text('Start New'),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActionsGrid(BuildContext context, ColorScheme cs) {
    return Row(
      children: [
        Expanded(
          child: _ActionCard(
            icon: Icons.add_circle_outline,
            title: 'New Session',
            bgColor: cs.primaryContainer.withValues(alpha: 0.6),
            iconColor: cs.primary,
            onTap: () => _handleNewSession(context),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: _ActionCard(
            icon: Icons.history_outlined,
            title: 'History',
            bgColor: cs.secondaryContainer.withValues(alpha: 0.6),
            iconColor: cs.secondary,
            onTap: () => Navigator.pushNamed(context, '/view_attendance'),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: _ActionCard(
            icon: Icons.person_outline,
            title: 'Account',
            bgColor: cs.tertiaryContainer.withValues(alpha: 0.6),
            iconColor: cs.tertiary,
            onTap: () => Navigator.pushNamed(context, '/faculty_account'),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _ActiveSessionCard extends StatelessWidget {
  const _ActiveSessionCard();

  @override
  Widget build(BuildContext context) {
    return Selector<AttendanceProvider,
        ({String? subject, String? roomNumber, int presentCount})>(
      selector: (_, p) => (
        subject: p.subject,
        roomNumber: p.roomNumber,
        presentCount: p.presentCount,
      ),
      builder: (context, info, _) {
        final theme = Theme.of(context);
        final cs = theme.colorScheme;

        return Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [cs.primary, cs.tertiary],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: cs.primary.withValues(alpha: 0.28),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => Navigator.pushNamed(context, '/scanner'),
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Text(
                            'ACTIVE SESSION',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.bold),
                          ),
                        ),
                        const Spacer(),
                        const Icon(Icons.arrow_forward_ios,
                            color: Colors.white, size: 16),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text(
                      info.subject ?? 'Unknown Subject',
                      style: theme.textTheme.titleLarge?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    if (info.roomNumber != null &&
                        info.roomNumber!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Room: ${info.roomNumber}',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: Colors.white.withValues(alpha: 0.85),
                        ),
                      ),
                    ],
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        const Icon(Icons.people_outline,
                            color: Colors.white, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          '${info.presentCount} Students Scanned',
                          style: const TextStyle(
                              color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final Color bgColor;
  final Color iconColor;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.title,
    required this.bgColor,
    required this.iconColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: bgColor,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 22.0),
          child: Column(
            children: [
              Icon(icon, color: iconColor, size: 30),
              const SizedBox(height: 10),
              Text(
                title,
                style: TextStyle(
                  color: iconColor,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _RecentSessionTile extends StatelessWidget {
  final AttendanceSessionModel session;

  const _RecentSessionTile({required this.session});

  Color _statusColor(String status) {
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
    final color = _statusColor(session.status);

    final subjectLabel = session.subjectName
        ?.replaceFirst('Employability Skills - ', 'ES - ');
    final yearLabel = session.academicYearName;
    final timeLabel = session.sessionTime;

    return Card(
      margin: const EdgeInsets.only(bottom: 10.0),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: cs.outlineVariant),
      ),
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, '/session_details',
            arguments: session),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              // Status dot
              CircleAvatar(
                radius: 20,
                backgroundColor: color.withValues(alpha: 0.12),
                child: Icon(Icons.receipt_long_outlined, color: color, size: 18),
              ),
              const SizedBox(width: 12),
              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      subjectLabel ?? timeLabel ?? dateStr,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14),
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 10,
                      children: [
                        if (yearLabel != null)
                          _TileMeta(Icons.school_outlined, yearLabel),
                        if (timeLabel != null)
                          _TileMeta(Icons.access_time_outlined, timeLabel),
                        _TileMeta(Icons.calendar_today_outlined, dateStr),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              // Count
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '${session.attendanceCount}',
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: cs.primary),
                  ),
                  Text(
                    'students',
                    style: TextStyle(
                        fontSize: 10,
                        color: cs.onSurface.withValues(alpha: 0.5)),
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

class _TileMeta extends StatelessWidget {
  final IconData icon;
  final String label;
  const _TileMeta(this.icon, this.label);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 11, color: cs.onSurface.withValues(alpha: 0.4)),
        const SizedBox(width: 3),
        Text(
          label,
          style: TextStyle(
              fontSize: 11, color: cs.onSurface.withValues(alpha: 0.55)),
        ),
      ],
    );
  }
}
