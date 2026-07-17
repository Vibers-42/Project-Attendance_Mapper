import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _facultyIdController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _facultyIdController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    final facultyId = _facultyIdController.text.trim();
    final password = _passwordController.text;
    final authProvider = context.read<AuthProvider>();
    final success = await authProvider.login(facultyId, password);

    if (!mounted) return;

    if (!success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(authProvider.errorMessage ?? 'Login failed'),
          backgroundColor: Colors.red.shade700,
        ),
      );
    }
    if (success && mounted) {
      Navigator.of(context).pushReplacementNamed('/recovery');
    }
  }

  InputDecoration _dec(String label, IconData icon, {Widget? suffix}) {
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon),
      suffixIcon: suffix,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
            color: Theme.of(context).colorScheme.primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Theme.of(context).colorScheme.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
            color: Theme.of(context).colorScheme.error, width: 2),
      ),
      filled: true,
      fillColor: Theme.of(context).colorScheme.surfaceContainerLowest,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final authProvider = Provider.of<AuthProvider>(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(
                    Icons.assignment_ind_rounded,
                    size: 72,
                    color: colorScheme.primary,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Attendance Mapping',
                    textAlign: TextAlign.center,
                    style: textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: colorScheme.primary,
                    ),
                  ),
                  Text(
                    'System',
                    textAlign: TextAlign.center,
                    style: textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: colorScheme.primary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Sign in to continue',
                    textAlign: TextAlign.center,
                    style: textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurface.withValues(alpha: 0.5),
                    ),
                  ),
                  const SizedBox(height: 40),

                  TextFormField(
                    controller: _facultyIdController,
                    decoration: _dec('Faculty ID', Icons.badge_outlined),
                    textInputAction: TextInputAction.next,
                    enabled: !authProvider.isLoading,
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Faculty ID is required' : null,
                  ),
                  const SizedBox(height: 16),

                  TextFormField(
                    controller: _passwordController,
                    decoration: _dec(
                      'Password',
                      Icons.lock_outline,
                      suffix: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          color: colorScheme.onSurface.withValues(alpha: 0.5),
                        ),
                        onPressed: () =>
                            setState(() => _obscurePassword = !_obscurePassword),
                      ),
                    ),
                    obscureText: _obscurePassword,
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) =>
                        authProvider.isLoading ? null : _handleLogin(),
                    enabled: !authProvider.isLoading,
                    validator: (v) =>
                        (v == null || v.isEmpty) ? 'Password is required' : null,
                  ),
                  const SizedBox(height: 28),

                  FilledButton(
                    onPressed: authProvider.isLoading ? null : _handleLogin,
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: authProvider.isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Sign In',
                            style: TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w600)),
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
