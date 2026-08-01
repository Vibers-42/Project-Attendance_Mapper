import 'package:dio/dio.dart';
import 'secure_storage_service.dart';
import 'api_config_service.dart';

class ApiService {
  late final Dio _dio;
  final SecureStorageService _storageService;
  final ApiConfigService _configService;
  final _authInterceptor = _AuthInterceptor._instance;

  ApiService(this._storageService, this._configService) {
    _dio = Dio(
      BaseOptions(
        baseUrl: _configService.baseUrl,
        connectTimeout: const Duration(seconds: 45),
        receiveTimeout: const Duration(seconds: 45),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _authInterceptor._storageService = _storageService;
    _dio.interceptors.add(_authInterceptor);
  }

  /// Register a callback that fires whenever the backend returns 401.
  /// Wire this in main.dart to AuthProvider.logout() so the app clears
  /// in-memory state and navigates back to the login screen.
  void setOnUnauthorized(Future<void> Function() callback) {
    _authInterceptor._onUnauthorized = callback;
  }

  Dio get client {
    _dio.options.baseUrl = _configService.baseUrl;
    return _dio;
  }
}

class _AuthInterceptor extends Interceptor {
  // Singleton so ApiService can register the callback before runApp.
  static final _AuthInterceptor _instance = _AuthInterceptor._();
  _AuthInterceptor._();

  SecureStorageService? _storageService;
  Future<void> Function()? _onUnauthorized;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    try {
      final token = await _storageService?.getToken();
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      handler.next(options);
    } catch (error) {
      handler.reject(
        DioException(
          requestOptions: options,
          error: error,
          type: DioExceptionType.unknown,
        ),
      );
    }
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final isLoginRequest = err.requestOptions.path.contains('/auth/login');
    final status = err.response?.statusCode;
    // 401 = token missing/expired/revoked; 403 = account deactivated/role changed.
    // Both require clearing credentials and forcing re-login.
    if ((status == 401 || status == 403) && !isLoginRequest) {
      await _storageService?.clearAll();
      await _onUnauthorized?.call();
    }
    handler.next(err);
  }
}
