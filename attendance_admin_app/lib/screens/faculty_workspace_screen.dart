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
    // Pre-fetch the latest history silently to populate the "Recent Activity" feed
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AttendanceHistoryProvider>(context, listen: false)
          .fetchSessions(refresh: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final authProvider = Provider.of<AuthProvider>(context);
    final attendanceProvider = Provider.of<AttendanceProvider>(context);
    
    final faculty = authProvider.currentUser;
    final String welcomeName = faculty != null ? faculty.name : 'Faculty';
    final String currentDate = DateFormat('EEEE, MMMM d').format(DateTime.now());

    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // 1. Welcome Header App Bar
            SliverAppBar(
              expandedHeight: 120.0,
              floating: true,
              pinned: true,
              elevation: 0,
              flexibleSpace: FlexibleSpaceBar(
                titlePadding: const EdgeInsets.only(left: 20, bottom: 16, right: 20),
                title: Text(
                  'Good Morning,\n$welcomeName',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.onSurface,
                  ),
                ),
              ),
              actions: [
                // Connectivity Indicator (Mocked online state for now)
                Padding(
                  padding: const EdgeInsets.only(right: 20, top: 16),
                  child: Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: Colors.green,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text('Online', style: theme.textTheme.bodySmall?.copyWith(color: Colors.green)),
                    ],
                  ),
                ),
              ],
            ),
            
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  Text(currentDate, style: theme.textTheme.titleMedium?.copyWith(color: Colors.grey.shade600)),
                  const SizedBox(height: 24),
                  
                  // 2. Active Session Card (Only shows if a session is currently running)
                  if (attendanceProvider.hasActiveSession) ...[
                    _ActiveSessionCard(provider: attendanceProvider),
                    const SizedBox(height: 24),
                  ],

                  // 3. Quick Actions
                  Text('Quick Actions', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  _buildQuickActionsGrid(context),
                  const SizedBox(height: 32),

                  // 4. Recent Activity
                  Text('Recent Activity', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                ]),
              ),
            ),
            
            // Recent Activity List (SliverList for seamless scrolling)
            Consumer<AttendanceHistoryProvider>(
              builder: (context, historyProvider, child) {
                if (historyProvider.isLoadingSessions && historyProvider.sessions.isEmpty) {
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
                      padding: const EdgeInsets.all(40.0),
                      child: Center(
                        child: Text(
                          historyProvider.errorMessage ?? 'No recent sessions found.',
                          style: TextStyle(color: Colors.grey.shade600),
                        ),
                      ),
                    ),
                  );
                }

                // Show only the 3 most recent sessions on the workspace
                final recentSessions = historyProvider.sessions.take(3).toList();
                
                return SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20.0),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final session = recentSessions[index];
                        return _RecentSessionTile(session: session);
                      },
                      childCount: recentSessions.length,
                    ),
                  ),
                );
              },
            ),
            
            // Bottom Padding
            const SliverToBoxAdapter(child: SizedBox(height: 40)),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActionsGrid(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ActionCard(
            icon: Icons.add_circle,
            title: 'New Session',
            color: Colors.blue.shade100,
            iconColor: Colors.blue.shade700,
            onTap: () => Navigator.pushNamed(context, '/create_session'),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: _ActionCard(
            icon: Icons.history,
            title: 'History',
            color: Colors.purple.shade100,
            iconColor: Colors.purple.shade700,
            onTap: () => Navigator.pushNamed(context, '/view_attendance'),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: _ActionCard(
            icon: Icons.person,
            title: 'Account',
            color: Colors.orange.shade100,
            iconColor: Colors.orange.shade700,
            onTap: () => Navigator.pushNamed(context, '/faculty_account'),
          ),
        ),
      ],
    );
  }
}

class _ActiveSessionCard extends StatelessWidget {
  final AttendanceProvider provider;

  const _ActiveSessionCard({required this.provider});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [theme.colorScheme.primary, theme.colorScheme.tertiary],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: theme.colorScheme.primary.withValues(alpha: 0.3),
            blurRadius: 10,
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
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text('ACTIVE SESSION', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                    ),
                    const Spacer(),
                    const Icon(Icons.arrow_forward_ios, color: Colors.white, size: 16),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  provider.subject ?? 'Unknown Subject',
                  style: theme.textTheme.titleLarge?.copyWith(color: Colors.white, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  'Room: ${provider.roomNumber ?? 'N/A'}',
                  style: theme.textTheme.bodyMedium?.copyWith(color: Colors.white.withValues(alpha: 0.9)),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Icon(Icons.people, color: Colors.white, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      '${provider.presentCount} Students Scanned',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final Color color;
  final Color iconColor;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.title,
    required this.color,
    required this.iconColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20.0),
          child: Column(
            children: [
              Icon(icon, color: iconColor, size: 32),
              const SizedBox(height: 12),
              Text(
                title,
                style: TextStyle(
                  color: iconColor,
                  fontWeight: FontWeight.bold,
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

class _RecentSessionTile extends StatelessWidget {
  final dynamic session; // Using dynamic here to avoid importing model if not strictly needed, but better to type it.
  
  const _RecentSessionTile({required this.session});

  Color _getStatusColor(String status) {
    switch (status) {
      case 'SUBMITTED': return Colors.green;
      case 'PENDING': return Colors.orange;
      case 'IN_PROGRESS': return Colors.blue;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateStr = DateFormat('MMM d, hh:mm a').format(session.date.toLocal());

    return Card(
      margin: const EdgeInsets.only(bottom: 12.0),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: ListTile(
        onTap: () => Navigator.pushNamed(context, '/session_details', arguments: session),
        leading: CircleAvatar(
          backgroundColor: _getStatusColor(session.status).withValues(alpha: 0.1),
          child: Icon(Icons.meeting_room, color: _getStatusColor(session.status)),
        ),
        title: Text('Room ${session.roomId ?? 'N/A'}', style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text(dateStr),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('${session.attendanceCount}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const Text('students', style: TextStyle(fontSize: 10)),
          ],
        ),
      ),
    );
  }
}
