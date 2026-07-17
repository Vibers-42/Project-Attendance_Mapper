import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import 'secure_storage_service.dart';

class ApiService {
  late final Dio _dio;
  final SecureStorageService _storageService;

  ApiService(this._storageService) {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(_AuthInterceptor(_storageService));
  }

  Dio get client => _dio;
}

class _AuthInterceptor extends Interceptor {
  final SecureStorageService _storageService;

  _AuthInterceptor(this._storageService);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    // Inject the JWT token if available
    final token = await _storageService.getToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    super.onRequest(options, handler);
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
