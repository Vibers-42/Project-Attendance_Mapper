import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../providers/attendance_provider.dart';

class CreateSessionScreen extends StatefulWidget {
  const CreateSessionScreen({super.key});

  @override
  State<CreateSessionScreen> createState() => _CreateSessionScreenState();
}

class _CreateSessionScreenState extends State<CreateSessionScreen> {
  // Dummy Initial Data
  final TextEditingController _professorController = TextEditingController(text: 'Dr. Ramesh Kumar');
  final TextEditingController _roomController = TextEditingController();
  final TextEditingController _labInchargeController = TextEditingController();
  
  String? _selectedYear;
  String? _selectedSubject = 'Employability Skills';
  String? _selectedSessionTime;
  DateTime _selectedDate = DateTime.now();

  final List<String> _years = ['First Year', 'Second Year', 'Third Year', 'Fourth Year'];
  final List<String> _subjects = ['Employability Skills', 'Data Structures', 'Database Systems'];
  final List<String> _sessionTimes = ['09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00'];

  @override
  void dispose() {
    _professorController.dispose();
    _roomController.dispose();
    _labInchargeController.dispose();
    super.dispose();
  }

  Future<void> _selectDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2000),
      lastDate: DateTime(2101),
    );
    if (picked != null && picked != _selectedDate) {
      setState(() {
        _selectedDate = picked;
      });
    }
  }

  void _startAttendance() async {
    final provider = Provider.of<AttendanceProvider>(context, listen: false);
    
    // Save to Hive via Provider (now async and hits backend)
    final success = await provider.startSession(
      professorName: _professorController.text.trim(),
      year: _selectedYear,
      roomNumber: _roomController.text.trim(),
      date: _selectedDate,
      subject: _selectedSubject,
      sessionTime: _selectedSessionTime,
      labIncharge: _labInchargeController.text.trim(),
    );
    
    if (success && mounted) {
      Navigator.pushNamed(context, '/scanner');
    } else if (!success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.errorMessage ?? 'Failed to start session.'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Session'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Card(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Session Information',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Professor Name (Auto-filled)
                  TextField(
                    controller: _professorController,
                    decoration: const InputDecoration(
                      labelText: 'Professor Name',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.person),
                    ),
                    readOnly: true,
                  ),
                  const SizedBox(height: 16),

                  // Year Dropdown
                  DropdownButtonFormField<String>(
                    decoration: const InputDecoration(
                      labelText: 'Year',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.school),
                    ),
                    initialValue: _selectedYear,
                    items: _years.map((String year) {
                      return DropdownMenuItem<String>(
                        value: year,
                        child: Text(year),
                      );
                    }).toList(),
                    onChanged: (String? newValue) {
                      setState(() {
                        _selectedYear = newValue;
                      });
                    },
                  ),
                  const SizedBox(height: 16),

                  // Room Number
                  TextField(
                    controller: _roomController,
                    decoration: const InputDecoration(
                      labelText: 'Room Number',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.meeting_room),
                    ),
                    keyboardType: TextInputType.text,
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 16),

                  // Date Picker
                  InkWell(
                    onTap: () => _selectDate(context),
                    child: InputDecorator(
                      decoration: const InputDecoration(
                        labelText: 'Date',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.calendar_today),
                      ),
                      child: Text(
                        DateFormat('dd MMM yyyy').format(_selectedDate),
                        style: theme.textTheme.bodyLarge,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Subject Dropdown
                  DropdownButtonFormField<String>(
                    decoration: const InputDecoration(
                      labelText: 'Subject',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.book),
                    ),
                    initialValue: _selectedSubject,
                    items: _subjects.map((String subject) {
                      return DropdownMenuItem<String>(
                        value: subject,
                        child: Text(subject),
                      );
                    }).toList(),
                    onChanged: (String? newValue) {
                      setState(() {
                        _selectedSubject = newValue;
                      });
                    },
                  ),
                  const SizedBox(height: 16),

                  // Session Time Dropdown
                  DropdownButtonFormField<String>(
                    decoration: const InputDecoration(
                      labelText: 'Session Time',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.access_time),
                    ),
                    initialValue: _selectedSessionTime,
                    items: _sessionTimes.map((String time) {
                      return DropdownMenuItem<String>(
                        value: time,
                        child: Text(time),
                      );
                    }).toList(),
                    onChanged: (String? newValue) {
                      setState(() {
                        _selectedSessionTime = newValue;
                      });
                    },
                  ),
                  const SizedBox(height: 16),

                  // Lab Incharge
                  TextField(
                    controller: _labInchargeController,
                    decoration: const InputDecoration(
                      labelText: 'Lab Incharge',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.badge),
                    ),
                    textInputAction: TextInputAction.done,
                  ),
                  const SizedBox(height: 32),

                  // Start Attendance Button
                  Consumer<AttendanceProvider>(
                    builder: (context, provider, child) {
                      return FilledButton.icon(
                        onPressed: provider.isLoading ? null : _startAttendance,
                        icon: provider.isLoading 
                            ? const SizedBox(
                                width: 20, 
                                height: 20, 
                                child: CircularProgressIndicator(strokeWidth: 2)
                              )
                            : const Icon(Icons.qr_code_scanner),
                        label: Text(
                          provider.isLoading ? 'Creating Session...' : 'Start Attendance',
                          style: const TextStyle(fontSize: 16),
                        ),
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
