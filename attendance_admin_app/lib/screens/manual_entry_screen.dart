import 'package:flutter/material.dart';

class ManualEntryScreen extends StatelessWidget {
  const ManualEntryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Manual Entry')),
      body: const Center(child: Text('Manual Entry Placeholder')),
    );
  }
}
