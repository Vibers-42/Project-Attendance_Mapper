import 'package:flutter/material.dart';
import '../widgets/action_card.dart';

class PlacementHomeScreen extends StatelessWidget {
  const PlacementHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Placements'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Quick Actions',
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: ActionCard(
                      icon: Icons.add_circle_outline,
                      title: 'Create Placement\nSession',
                      bgColor: cs.primaryContainer.withValues(alpha: 0.6),
                      iconColor: cs.primary,
                      onTap: () => Navigator.pushNamed(
                          context, '/placement_create_session'),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: ActionCard(
                      icon: Icons.list_alt_outlined,
                      title: 'Placement\nSessions',
                      bgColor: cs.secondaryContainer.withValues(alpha: 0.6),
                      iconColor: cs.secondary,
                      onTap: () => Navigator.pushNamed(
                          context, '/placement_sessions'),
                    ),
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
