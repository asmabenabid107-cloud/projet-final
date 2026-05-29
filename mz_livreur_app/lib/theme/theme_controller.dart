import 'dart:ui';

import 'package:flutter/material.dart';

import '../core/storage.dart';

class ThemeController extends ChangeNotifier {
  ThemeMode _mode = PlatformDispatcher.instance.platformBrightness ==
          Brightness.light
      ? ThemeMode.light
      : ThemeMode.dark;

  ThemeMode get mode => _mode;

  bool get isDark => _mode == ThemeMode.dark;

  Future<void> load() async {
    final storedMode = await Storage.getThemeMode();
    if (storedMode == 'light') {
      _mode = ThemeMode.light;
    } else if (storedMode == 'dark') {
      _mode = ThemeMode.dark;
    }
    notifyListeners();
  }

  Future<void> toggle() async {
    _mode = _mode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    await Storage.setThemeMode(_mode == ThemeMode.dark ? 'dark' : 'light');
    notifyListeners();
  }

  static ThemeController of(BuildContext context) {
    final scope = context
        .dependOnInheritedWidgetOfExactType<ThemeControllerScope>();
    assert(scope != null, 'ThemeControllerScope is missing in the widget tree.');
    return scope!.controller;
  }
}

class ThemeControllerScope extends InheritedNotifier<ThemeController> {
  const ThemeControllerScope({
    super.key,
    required this.controller,
    required super.child,
  }) : super(notifier: controller);

  final ThemeController controller;

  @override
  bool updateShouldNotify(covariant ThemeControllerScope oldWidget) {
    return controller != oldWidget.controller;
  }
}
