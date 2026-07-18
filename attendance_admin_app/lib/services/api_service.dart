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

}

class _AuthInterceptor extends Interceptor {
  final SecureStorageService _storageService;

  _AuthInterceptor(this._storageService, ApiConfigService _);

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
    if (err.response?.statusCode == 401) {
      _storageService.deleteToken();
    }
    super.onError(err, handler);
  }
}
