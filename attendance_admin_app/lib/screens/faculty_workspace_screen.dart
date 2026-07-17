import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/attendance_provider.dart';
import '../providers/attendance_history_provider.dart';

class FacultyWorkspaceScreen extends StatefulWidget {
  const FacultyWorkspaceScreen({super.key});

  @override
  State<FacultyWorkspaceScreen> createState() => _FacultyWorkspaceScreenState();
}

class _FacultyWorkspaceScreenState extends State<FacultyWorkspaceScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AttendanceHistoryProvider>(context, listen: false)
          .fetchSessions(refresh: true);
    });
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning,';
    if (hour < 17) return 'Good Afternoon,';
    return 'Good Evening,';
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
            // ── Greeting header (in the scroll content, not in SliverAppBar) ──
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // Greeting + name
                  Text(
                    _greeting(),
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

                  // Active session banner (only when a session is running)
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

            // ── Recent sessions list ──
            Consumer<AttendanceHistoryProvider>(
              builder: (context, historyProvider, child) {
                if (historyProvider.isLoadingSessions &&
                    historyProvider.sessions.isEmpty) {
                  return const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.all(40.0),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                  );
                }

                if (historyProvider.sessions.isEmpty) {
                  return SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      child: Column(
                        children: [
                          Icon(Icons.history_edu,
                              size: 52,
                              color: Colors.grey.shade300),
                          const SizedBox(height: 12),
                          Text(
                            historyProvider.errorMessage ??
                                'No recent sessions found.',
                            style: TextStyle(color: Colors.grey.shade500),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                final recentSessions =
                    historyProvider.sessions.take(3).toList();

                return SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20.0),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) =>
                          _RecentSessionTile(session: recentSessions[index]),
                      childCount: recentSessions.length,
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

  Widget _buildQuickActionsGrid(BuildContext context, ColorScheme cs) {
    return Row(
      children: [
        Expanded(
          child: _ActionCard(
            icon: Icons.add_circle_outline,
            title: 'New Session',
            bgColor: cs.primaryContainer.withValues(alpha: 0.6),
            iconColor: cs.primary,
            onTap: () => Navigator.pushNamed(context, '/create_session'),
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
  final dynamic session;

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
    final dateStr = DateFormat('dd MMM yyyy').format(session.date.toLocal());
    // Use session time string if available — avoids the UTC→IST 5:30am display bug
    final sessionTitle = session.sessionTime as String? ?? dateStr;
    final color = _statusColor(session.status as String);

    return Card(
      margin: const EdgeInsets.only(bottom: 10.0),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        onTap: () =>
            Navigator.pushNamed(context, '/session_details', arguments: session),
        leading: CircleAvatar(
          backgroundColor: color.withValues(alpha: 0.12),
          child: Icon(Icons.access_time_outlined, color: color, size: 20),
        ),
        title: Text(
          sessionTitle,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          dateStr,
          style: TextStyle(
              fontSize: 12, color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              '${session.attendanceCount}',
              style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: theme.colorScheme.primary),
            ),
            Text(
              'students',
              style: TextStyle(
                  fontSize: 10,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
            ),
          ],
        ),
      ),
    );
  }
}
