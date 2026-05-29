import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;

import 'storage.dart';

class ApiException implements Exception {
  final int status;
  final String message;

  ApiException(this.status, this.message);

  int get statusCode => status;

  @override
  String toString() => message;
}

class Api {
  static const Duration _timeout = Duration(seconds: 15);

  static const String _baseFromDefine = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static String get baseUrl {
    if (_baseFromDefine.isNotEmpty) return _baseFromDefine;

    // Flutter web on PC
    if (kIsWeb) return 'http://127.0.0.1:8000';

    // Téléphone Android réel:
    // بدّل 192.168.1.37 بـ IP متاع الـ PC متاعك على نفس الـ Wi-Fi
    //return 'http://192.168.1.15:8000';
    return 'http://192.168.1.14:8000';
    //return 'http://192.168.1.14:8000';
  }

  static Uri _u(String path) {
    final p = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$baseUrl$p');
  }

  static Map<String, String> _headers({String? token}) {
    final h = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token != null && token.isNotEmpty) {
      h['Authorization'] = 'Bearer $token';
    }

    return h;
  }

  static String _extractMessage(http.Response res) {
    try {
      final data = jsonDecode(res.body);
      if (data is Map && data['detail'] != null) {
        return data['detail'].toString();
      }
      if (data is Map && data['message'] != null) {
        return data['message'].toString();
      }
      return res.body.isEmpty ? 'Erreur serveur' : res.body;
    } catch (_) {
      return res.body.isEmpty ? 'Erreur serveur' : res.body;
    }
  }

  static Future<Map<String, dynamic>> getJson(
    String path, {
    bool withAuth = true,
  }) async {
    final token = withAuth ? await Storage.getToken() : null;

    http.Response res;
    try {
      res = await http
          .get(_u(path), headers: _headers(token: token))
          .timeout(_timeout);
    } on TimeoutException {
      throw ApiException(
        408,
        'Connexion expirée. Vérifie IP backend / Wi-Fi / firewall.',
      );
    } catch (e) {
      throw ApiException(
        0,
        'Impossible de joindre le serveur. Vérifie IP backend / Wi-Fi / firewall.',
      );
    }

    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, _extractMessage(res));
    }

    if (res.body.isEmpty) return {};

    final decoded = jsonDecode(res.body);
    if (decoded is Map<String, dynamic>) return decoded;
    return {'data': decoded};
  }

  static Future<Map<String, dynamic>> postJson(
    String path, {
    required Map<String, dynamic> body,
    bool withAuth = true,
  }) async {
    final token = withAuth ? await Storage.getToken() : null;

    http.Response res;
    try {
      res = await http
          .post(
            _u(path),
            headers: _headers(token: token),
            body: jsonEncode(body),
          )
          .timeout(_timeout);
    } on TimeoutException {
      throw ApiException(
        408,
        'Connexion expirée. Vérifie IP backend / Wi-Fi / firewall.',
      );
    } catch (e) {
      throw ApiException(
        0,
        'Impossible de joindre le serveur. Vérifie IP backend / Wi-Fi / firewall.',
      );
    }

    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, _extractMessage(res));
    }

    if (res.body.isEmpty) return {};

    final decoded = jsonDecode(res.body);
    if (decoded is Map<String, dynamic>) return decoded;
    return {'data': decoded};
  }

  static Future<Map<String, dynamic>> patchJson(
    String path, {
    required Map<String, dynamic> body,
    bool withAuth = true,
  }) async {
    final token = withAuth ? await Storage.getToken() : null;

    http.Response res;
    try {
      res = await http
          .patch(
            _u(path),
            headers: _headers(token: token),
            body: jsonEncode(body),
          )
          .timeout(_timeout);
    } on TimeoutException {
      throw ApiException(
        408,
        'Connexion expirée. Vérifie IP backend / Wi-Fi / firewall.',
      );
    } catch (e) {
      throw ApiException(
        0,
        'Impossible de joindre le serveur. Vérifie IP backend / Wi-Fi / firewall.',
      );
    }

    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, _extractMessage(res));
    }

    if (res.body.isEmpty) return {};

    final decoded = jsonDecode(res.body);
    if (decoded is Map<String, dynamic>) return decoded;
    return {'data': decoded};
  }
}
