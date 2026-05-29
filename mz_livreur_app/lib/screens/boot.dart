// lib/screens/boot.dart
// ✅ Design MZ Logistic — Navy + Amber splash screen
// ✅ Logique originale 100% conservée

import 'dart:async';
import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/storage.dart';
import '../services/courier_auto_location_service.dart';

const _kNavy  = Color(0xFF1A2B4A);
const _kAmber = Color(0xFFF59E0B);
const _kNavy2 = Color(0xFF243656);

class BootScreen extends StatefulWidget {
  final String initialRoute;
  const BootScreen({super.key, required this.initialRoute});
  @override
  State<BootScreen> createState() => _BootScreenState();
}

class _BootScreenState extends State<BootScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double>    _fadeAnim;
  late final Animation<double>    _scaleAnim;

  bool get _isProtected =>
      widget.initialRoute.startsWith('/scan') ||
      widget.initialRoute.startsWith('/colis-action');

  @override
  void initState() {
    super.initState();

    // ── Animation setup ────────────────────────────────────
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _fadeAnim = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _scaleAnim = Tween<double>(begin: 0.82, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOutBack),
    );
    _ctrl.forward();

    // ── Boot logic (original) ───────────────────────────────
    _boot();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _boot() async {
    // Wait min 1.8s so splash is visible
    await Future.delayed(const Duration(milliseconds: 1800));

    String? token;
    try {
      token = await Storage.getToken();
    } catch (_) {
      token = null;
    }

    if (!mounted) return;

    final loggedIn = token != null && token.trim().isNotEmpty;

    if (!loggedIn) {
      if (_isProtected) {
        Navigator.pushNamedAndRemoveUntil(
          context, '/login', (_) => false,
          arguments: {
            'message': 'Connecte-toi pour ouvrir le colis.',
            'redirect': widget.initialRoute,
          },
        );
        return;
      }
      Navigator.pushNamedAndRemoveUntil(
          context, widget.initialRoute, (_) => false);
      return;
    }

    try {
      await Api.getJson('/auth/me', withAuth: true);
      unawaited(CourierAutoLocationService.instance.start());
      if (!mounted) return;
      Navigator.pushNamedAndRemoveUntil(
        context,
        _isProtected ? widget.initialRoute : '/dashboard',
        (_) => false,
      );
    } on ApiException catch (e) {
      if (e.statusCode == 401 || e.statusCode == 403) {
        await CourierAutoLocationService.instance.stop(markOffline: false);
        await Storage.clearToken();
        if (!mounted) return;
        Navigator.pushNamedAndRemoveUntil(
          context, '/login', (_) => false,
          arguments: e.message,
        );
        return;
      }
      if (!mounted) return;
      Navigator.pushNamedAndRemoveUntil(
        context,
        _isProtected ? widget.initialRoute : '/dashboard',
        (_) => false,
      );
    } catch (_) {
      if (!mounted) return;
      Navigator.pushNamedAndRemoveUntil(
        context,
        _isProtected ? widget.initialRoute : '/dashboard',
        (_) => false,
      );
    }
  }

  // ── Build ─────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kNavy,
      body: Stack(
        children: [
          // Background decoration
          Positioned(
            top: -80, right: -60,
            child: Container(
              width: 280, height: 280,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _kAmber.withOpacity(0.07),
              ),
            ),
          ),
          Positioned(
            bottom: -100, left: -80,
            child: Container(
              width: 320, height: 320,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.04),
              ),
            ),
          ),

          // Content
          Center(
            child: FadeTransition(
              opacity: _fadeAnim,
              child: ScaleTransition(
                scale: _scaleAnim,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Logo container
                    Container(
                      width: 100, height: 100,
                      decoration: BoxDecoration(
                        color: _kAmber,
                        borderRadius: BorderRadius.circular(28),
                        boxShadow: [
                          BoxShadow(
                            color: _kAmber.withOpacity(0.45),
                            blurRadius: 32, spreadRadius: 4,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Text('MZ', style: TextStyle(
                          color: _kNavy,
                          fontSize: 36,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -2,
                        )),
                      ),
                    ),

                    const SizedBox(height: 28),

                    // App name
                    RichText(
                      text: const TextSpan(children: [
                        TextSpan(
                          text: 'MZ',
                          style: TextStyle(
                            color: _kAmber,
                            fontSize: 34,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -1.5,
                          ),
                        ),
                        TextSpan(
                          text: ' Logistic',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.w500,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ]),
                    ),

                    const SizedBox(height: 8),

                    Text(
                      'Livraison Rapide et Fiable',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.5),
                        fontSize: 14,
                        fontWeight: FontWeight.w400,
                        letterSpacing: 0.5,
                      ),
                    ),

                    const SizedBox(height: 60),

                    // Loading indicator
                    SizedBox(
                      width: 32, height: 32,
                      child: CircularProgressIndicator(
                        color: _kAmber,
                        strokeWidth: 2.5,
                        backgroundColor: _kAmber.withOpacity(0.15),
                      ),
                    ),

                    const SizedBox(height: 16),

                    Text(
                      'Chargement...',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.4),
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Bottom badge
          Positioned(
            bottom: 36, left: 0, right: 0,
            child: FadeTransition(
              opacity: _fadeAnim,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.06),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.verified_rounded,
                        color: _kAmber, size: 14),
                    const SizedBox(width: 6),
                    Text('Espace Livreur', style: TextStyle(
                      color: Colors.white.withOpacity(0.65),
                      fontSize: 12, fontWeight: FontWeight.w600,
                    )),
                  ]),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
