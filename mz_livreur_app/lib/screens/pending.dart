// lib/screens/pending.dart
// ✅ Design MZ Logistic — Navy + Amber
// ✅ Logique originale 100% conservée

import 'package:flutter/material.dart';
import '../widgets/global_theme_toggle.dart';
import 'login.dart';

const _kNavy  = Color(0xFF1A2B4A);
const _kAmber = Color(0xFFF59E0B);
const _kGrey  = Color(0xFF6B7280);

class PendingScreen extends StatelessWidget {
  final String email;
  const PendingScreen({super.key, required this.email});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080E1A) : const Color(0xFFF2F4F9),
      body: SafeArea(
        child: Column(children: [
          // ── Header ───────────────────────────────────────
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(20, 18, 16, 28),
            decoration: BoxDecoration(
              color: _kNavy,
              borderRadius: const BorderRadius.only(
                bottomLeft:  Radius.circular(28),
                bottomRight: Radius.circular(28),
              ),
              boxShadow: [BoxShadow(
                color: _kNavy.withOpacity(0.3),
                blurRadius: 22,
                offset: const Offset(0, 8),
              )],
            ),
            child: Column(children: [
              Row(children: [
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.arrow_back_ios_new_rounded,
                      color: Colors.white, size: 20),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                ),
                const Expanded(
                  child: Text('Validation en attente', style: TextStyle(
                    color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900,
                  )),
                ),
                const ThemeIconButton(),
              ]),
              const SizedBox(height: 20),
              Row(children: [
                Container(
                  width: 56, height: 56,
                  decoration: BoxDecoration(
                    color: _kAmber,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white24, width: 2.5),
                  ),
                  child: const Center(child: Icon(
                    Icons.hourglass_bottom_rounded,
                    color: _kNavy, size: 26,
                  )),
                ),
                const SizedBox(width: 14),
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Compte en attente', style: TextStyle(
                      color: Colors.white, fontSize: 17, fontWeight: FontWeight.w900,
                    )),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: _kAmber.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: _kAmber.withOpacity(0.4)),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Container(width: 6, height: 6, decoration: const BoxDecoration(
                          color: _kAmber, shape: BoxShape.circle,
                        )),
                        const SizedBox(width: 5),
                        const Text('En attente de validation', style: TextStyle(
                          color: _kAmber, fontSize: 11, fontWeight: FontWeight.w800,
                        )),
                      ]),
                    ),
                  ],
                )),
              ]),
            ]),
          ),

          // ── Body ─────────────────────────────────────────
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 28),
              children: [
                // ── Info card ─────────────────────────────
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isDark
                          ? Colors.white.withOpacity(0.07)
                          : const Color(0xFFE4E9F4),
                    ),
                    boxShadow: [BoxShadow(
                      color: _kNavy.withOpacity(isDark ? 0.18 : 0.05),
                      blurRadius: 16, offset: const Offset(0, 5),
                    )],
                  ),
                  child: Column(children: [
                    // Email row
                    Row(children: [
                      Container(
                        width: 42, height: 42,
                        decoration: BoxDecoration(
                          color: _kAmber.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(13),
                        ),
                        child: const Icon(Icons.alternate_email_rounded,
                            color: _kAmber, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Email associé', style: TextStyle(
                            fontSize: 11, color: _kGrey,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.5,
                          )),
                          const SizedBox(height: 2),
                          Text(email, style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w800,
                            color: isDark ? Colors.white : _kNavy,
                          )),
                        ],
                      )),
                    ]),

                    Divider(
                      height: 28,
                      color: isDark
                          ? Colors.white.withOpacity(0.08)
                          : const Color(0xFFE4E9F4),
                    ),

                    // Description row
                    Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Container(
                        width: 32, height: 32,
                        decoration: BoxDecoration(
                          color: _kAmber.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.info_outline_rounded,
                            color: _kAmber, size: 17),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Text(
                        'Votre compte est en cours de validation par un administrateur. '
                        'Après approbation, vous recevrez un email de confirmation. '
                        'Vous pourrez ensuite vous connecter.',
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark
                              ? Colors.white70
                              : const Color(0xFF4B5563),
                          height: 1.65,
                        ),
                      )),
                    ]),
                  ]),
                ),

                const SizedBox(height: 14),

                // ── Amber hint banner ─────────────────────
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: _kAmber.withOpacity(0.07),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: _kAmber.withOpacity(0.28)),
                  ),
                  child: Row(children: [
                    const Icon(Icons.access_time_rounded,
                        color: _kAmber, size: 17),
                    const SizedBox(width: 9),
                    Expanded(child: Text(
                      'Délai habituel : 24 à 48 heures ouvrées.',
                      style: TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w700,
                        color: isDark
                            ? Colors.white70
                            : _kNavy.withOpacity(0.7),
                      ),
                    )),
                  ]),
                ),

                const SizedBox(height: 32),

                // ── Return button ─────────────────────────
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton.icon(
                    onPressed: () => Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                    ),
                    icon: const Icon(Icons.arrow_back_rounded, size: 18),
                    label: const Text('Retour login',
                        style: TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 15)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _kNavy,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ]),
      ),
    );
  }
}
