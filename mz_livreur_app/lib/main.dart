import 'package:flutter/material.dart';

import 'theme/app_theme.dart';
import 'theme/theme_controller.dart';
import 'core/parcel_deep_link.dart';
import 'screens/boot.dart';
import 'screens/home.dart';
import 'screens/register.dart';
import 'screens/login.dart';
import 'screens/forgot_password.dart';
import 'screens/verify_otp.dart';
import 'screens/reset_password.dart';
import 'screens/assigned_parcels.dart';
import 'screens/dashboard.dart';
import 'screens/leave_requests.dart';
import 'screens/parcel_overview.dart' as overview;
import 'screens/parcel_scan.dart' as scan;
import 'screens/parcel_status.dart';
import 'screens/profile.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final controller = ThemeController();
  await controller.load();
  runApp(MyApp(themeController: controller));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key, required this.themeController});

  final ThemeController themeController;

  static const _knownRoutes = <String>{
    '/home',
    '/register',
    '/login',
    '/forgot-password',
    '/verify-otp',
    '/reset-password',
    '/dashboard',
    '/colis-affectes',
    '/conges',
    '/profile',
    '/scan',
    '/scan-pickup',
    '/scan-warehouse',
    '/scan-route-progress',
    '/colis-action',
    '/colis-not-delivered',
    '/colis-returned',
  };

  static String _codeFromRoute(String route) {
    return extractParcelCode(route);
  }

  static String _normalizeStartupRoute(String rawRoute) {
    return normalizeCourierRoute(rawRoute, knownRoutes: _knownRoutes);
  }

  static String _codeFromArguments(Object? args) {
    if (args is String) return args;
    if (args is Map && args['code'] != null) return args['code'].toString();
    return '';
  }

  static Map<String, dynamic>? _colisFromArguments(Object? args) {
    if (args is Map && args['colis'] is Map) {
      return Map<String, dynamic>.from(args['colis'] as Map);
    }
    return null;
  }

  Route<dynamic>? _generateRoute(RouteSettings settings) {
    final routeName = settings.name ?? '';
    final normalized = _normalizeStartupRoute(routeName);

    if (normalized.startsWith('/scan')) {
      final argumentCode = _codeFromArguments(settings.arguments);
      final routeCode = _codeFromRoute(normalized);
      final code = argumentCode.isNotEmpty ? argumentCode : routeCode;
      return MaterialPageRoute(
        settings: RouteSettings(
          name: normalized,
          arguments: settings.arguments,
        ),
        builder: (_) => scan.ParcelScanScreen(initialCode: code),
      );
    }

    if (normalized.startsWith('/colis-action')) {
      final argumentCode = _codeFromArguments(settings.arguments);
      final routeCode = _codeFromRoute(normalized);
      final code = argumentCode.isNotEmpty ? argumentCode : routeCode;
      return MaterialPageRoute(
        settings: RouteSettings(
          name: normalized,
          arguments: settings.arguments,
        ),
        builder: (_) => ParcelStatusScreen(
          initialCode: code,
          initialData: _colisFromArguments(settings.arguments),
        ),
      );
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return ThemeControllerScope(
      controller: themeController,
      child: AnimatedBuilder(
        animation: themeController,
        builder: (context, _) {
          return MaterialApp(
            debugShowCheckedModeBanner: false,
            title: 'MZ Livreur',
            themeMode: themeController.mode,
            theme: AppTheme.light(),
            darkTheme: AppTheme.dark(),
            onGenerateInitialRoutes: (String initialRoute) {
              final normalizedRoute = _normalizeStartupRoute(initialRoute);
              return [
                MaterialPageRoute(
                  settings: const RouteSettings(name: '/boot'),
                  builder: (_) => BootScreen(initialRoute: normalizedRoute),
                ),
              ];
            },
            routes: {
              '/home': (_) => const HomeScreen(),
              '/register': (_) => const RegisterScreen(),
              '/login': (_) => const LoginScreen(),
              '/forgot-password': (_) => const ForgotPasswordScreen(),
              '/verify-otp': (_) => const VerifyOtpScreen(),
              '/reset-password': (_) => const ResetPasswordScreen(),
              '/dashboard': (_) => const DashboardScreen(),
              '/colis-affectes': (_) => const AssignedParcelsScreen(),
              '/conges': (_) => const LeaveRequestsScreen(),
              '/profile': (_) => const ProfileScreen(),
              '/scan': (_) => const scan.ParcelScanScreen(),
              '/scan-pickup': (_) => const scan.ParcelScanScreen(),
              '/scan-warehouse': (_) => const scan.ParcelScanScreen(),
              '/scan-route-progress': (_) => const scan.ParcelScanScreen(),
              '/colis-action': (_) => const ParcelStatusScreen(),
              '/colis-not-delivered': (_) =>
                  const overview.ParcelOverviewScreen(
                    mode: overview.ParcelOverviewMode.notDelivered,
                  ),
              '/colis-returned': (_) => const overview.ParcelOverviewScreen(
                mode: overview.ParcelOverviewMode.returned,
              ),
            },
            onGenerateRoute: _generateRoute,
            onUnknownRoute: (_) =>
                MaterialPageRoute(builder: (_) => const HomeScreen()),
          );
        },
      ),
    );
  }
}
