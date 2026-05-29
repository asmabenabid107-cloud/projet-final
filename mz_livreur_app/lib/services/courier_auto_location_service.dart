import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:geolocator/geolocator.dart';

import '../core/api.dart';

class CourierAutoLocationService with WidgetsBindingObserver {
  CourierAutoLocationService._();

  static final CourierAutoLocationService instance =
      CourierAutoLocationService._();

  static const Duration defaultInterval = Duration(seconds: 7);

  Timer? _timer;
  bool _wanted = false;
  bool _busy = false;
  bool _observerAttached = false;
  bool _foreground = true;
  Duration _interval = defaultInterval;

  bool get isRunning => _timer?.isActive ?? false;

  Future<void> start({Duration interval = defaultInterval}) async {
    _wanted = true;
    _interval = interval;
    _foreground = WidgetsBinding.instance.lifecycleState != AppLifecycleState.paused;

    if (!_observerAttached) {
      WidgetsBinding.instance.addObserver(this);
      _observerAttached = true;
    }

    final allowed = await _ensurePermission();
    if (!allowed) {
      debugPrint('GPS tracking: permission non accordee.');
      return;
    }

    _scheduleTimer();
    unawaited(_sendCurrentLocation());
  }

  Future<void> stop({bool markOffline = true}) async {
    _wanted = false;
    _timer?.cancel();
    _timer = null;

    if (_observerAttached) {
      WidgetsBinding.instance.removeObserver(this);
      _observerAttached = false;
    }

    if (markOffline) {
      await _markOffline();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed ||
        state == AppLifecycleState.inactive;

    if (!_wanted) {
      return;
    }

    if (_foreground) {
      _scheduleTimer();
      unawaited(_sendCurrentLocation());
      return;
    }

    _timer?.cancel();
    _timer = null;
    unawaited(_markOffline());
  }

  void _scheduleTimer() {
    if (!_wanted || !_foreground) {
      return;
    }

    if (_timer?.isActive ?? false) {
      return;
    }

    _timer = Timer.periodic(_interval, (_) {
      unawaited(_sendCurrentLocation());
    });
  }

  Future<bool> _ensurePermission() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return false;
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  Future<void> _sendCurrentLocation() async {
    if (_busy || !_wanted || !_foreground) {
      return;
    }

    _busy = true;

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 8),
        ),
      );

      await Api.postJson(
        '/courier/tracking/location',
        body: {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracy': position.accuracy,
          'speed': position.speed.isFinite ? position.speed : null,
          'heading': position.heading.isFinite ? position.heading : null,
          'recorded_at': DateTime.now().toUtc().toIso8601String(),
        },
        withAuth: true,
      );
    } catch (e) {
      debugPrint('GPS tracking: $e');
    } finally {
      _busy = false;
    }
  }

  Future<void> _markOffline() async {
    try {
      await Api.postJson(
        '/courier/tracking/offline',
        body: const {},
        withAuth: true,
      );
    } catch (e) {
      debugPrint('GPS tracking offline: $e');
    }
  }
}
