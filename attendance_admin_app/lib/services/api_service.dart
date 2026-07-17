import 'package:dio/dio.dart';
import 'secure_storage_service.dart';
import 'api_config_service.dart';

class ApiService {
  late final Dio _dio;
  final SecureStorageService _storageService;
  final ApiConfigService _configService;

  ApiService(this._storageService, this._configService) {
    _dio = Dio(
      BaseOptions(
        baseUrl: _configService.baseUrl,
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 12),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(_AuthInterceptor(_storageService, _configService));
  }

  Dio get client {
    _dio.options.baseUrl = _configService.baseUrl;
    return _dio;
  }

  ApiConfigService get configService => _configService;

  /// Returns true when the server responds (even with 401/404).
  Future<bool> testConnection() async {
    try {
      await client.get(
        '/students',
        options: Options(
          connectTimeout: const Duration(seconds: 5),
          receiveTimeout: const Duration(seconds: 5),
          validateStatus: (status) => status != null && status < 500,
        ),
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}

class _AuthInterceptor extends Interceptor {
  final SecureStorageService _storageService;
  final ApiConfigService _configService;

  _AuthInterceptor(this._storageService, this._configService);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    try {
      final token = await _storageService.getToken();
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
  void onError(DioException err, ErrorInterceptorHandler handler) {
    // Handle 401 Unauthorized globally (session expired or invalid token)
    if (err.response?.statusCode == 401) {
      // In a more complex setup, you'd trigger a logout event stream here
      // For now, the provider handles specific 401s, but clearing token is safe
      _storageService.deleteToken();
    }
    super.onError(err, handler);
  }
}
