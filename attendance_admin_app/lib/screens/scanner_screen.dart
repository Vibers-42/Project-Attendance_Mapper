import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:vibration/vibration.dart';
import 'package:permission_handler/permission_handler.dart';
import '../providers/attendance_provider.dart';

class ScannerScreen extends StatelessWidget {
  const ScannerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Attendance System'),
          centerTitle: true,
          bottom: const TabBar(
            tabs: [
              Tab(text: 'SCANNER', icon: Icon(Icons.qr_code_scanner)),
              Tab(text: 'LIVE ATTENDANCE', icon: Icon(Icons.people_alt)),
            ],
          ),
        ),
        body: const TabBarView(
          physics: NeverScrollableScrollPhysics(), // Prevents swipe interference with scanner
          children: [
            ScannerTab(),
            LiveAttendanceTab(),
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

class _ScannerTabState extends State<ScannerTab> {
  late final MobileScannerController _scannerController;
  final TextEditingController _manualEntryController = TextEditingController();
  
  bool _hasPermission = false;
  bool _isCheckingPermission = true;

  @override
  void initState() {
    super.initState();
    _scannerController = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
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

  Future<void> _processRollNumber(String rollNumber) async {
    if (rollNumber.isEmpty) return;
    
    final provider = Provider.of<AttendanceProvider>(context, listen: false);
    
    final errorMsg = provider.addStudent(rollNumber);
    
    if (errorMsg != null) {
      _showSnackbar(errorMsg, isError: true);
    } else {
      _showSnackbar('✓ Attendance Recorded: ${provider.lastScanned}', isError: false);
      try {
        bool? hasVibrator = await Vibration.hasVibrator();
        if (hasVibrator == true) {
          Vibration.vibrate(duration: 150);
        }
      } catch (e) {
        // Ignore vibration errors on unsupported devices/emulators
      }
    }
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
                MobileScanner(
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
                Consumer<AttendanceProvider>(
                  builder: (context, provider, child) {
                    return Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Last Scanned', style: theme.textTheme.labelLarge?.copyWith(color: Colors.grey)),
                            const SizedBox(height: 4),
                            Text(
                              provider.lastScanned ?? 'None',
                              style: theme.textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: provider.lastScanned != null ? theme.colorScheme.primary : Colors.grey,
                                letterSpacing: 1,
                              ),
                            ),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('Present Count', style: theme.textTheme.labelLarge?.copyWith(color: Colors.grey)),
                            const SizedBox(height: 4),
                            Text(
                              '${provider.presentCount}',
                              style: theme.textTheme.headlineMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: theme.colorScheme.primary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    );
                  }
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
      Navigator.of(context).pop(); // Go back to details screen
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
    final provider = Provider.of<AttendanceProvider>(context);
    
    // Filter list based on search query
    final students = provider.scannedStudents.where((roll) {
      return roll.contains(_searchQuery.toUpperCase());
    }).toList();

    return Column(
      children: [
        // Present Count Header
        Container(
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
                  '${provider.presentCount}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                backgroundColor: theme.colorScheme.primary,
                labelStyle: TextStyle(color: theme.colorScheme.onPrimary),
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
            ],
          ),
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
          child: students.isEmpty
              ? Center(
                  child: Text(
                    _searchQuery.isEmpty ? 'No Attendance Recorded Yet' : 'No results found',
                    style: const TextStyle(color: Colors.grey, fontSize: 16),
                  ),
                )
              : ListView.builder(
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
                          style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1)
                        ),
                        trailing: IconButton(
                          icon: const Icon(Icons.delete_outline, color: Colors.red),
                          onPressed: () => provider.removeStudent(rollNumber),
                          tooltip: 'Delete Attendance',
                        ),
                      ),
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
