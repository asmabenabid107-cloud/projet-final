// lib/screens/home.dart
// ✅ Aucune dépendance externe — fonctionne avec pubspec.yaml existant
// ✅ Remplace complètement l'ancien home.dart

import 'package:flutter/material.dart';

// ── Couleurs MZ Logistic ─────────────────────────────────────
const kNavy    = Color(0xFF1A2B4A);
const kAmber   = Color(0xFFF59E0B);
const kWhite   = Colors.white;
const kGrey    = Color(0xFF6B7280);
const kBgLight = Color(0xFFF8F9FB);

// ────────────────────────────────────────────────────────────
//  IMPORTANT: gardez le même nom de classe que dans main.dart
//  Si main.dart utilise "HomeScreen" → class HomeScreen
//  Si main.dart utilise "HomePage"   → class HomePage
//  Vérifiez main.dart et adaptez ici
// ────────────────────────────────────────────────────────────
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBgLight,
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            children: [
              _HomeHeader(),
              _HeroSection(),
              _FeaturesRow(),
              _ActionButtons(),
              _Footer(),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Header ───────────────────────────────────────────────────
class _HomeHeader extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      decoration: const BoxDecoration(
        color: kNavy,
        borderRadius: BorderRadius.only(
          bottomLeft:  Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Logo
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              RichText(
                text: const TextSpan(
                  children: [
                    TextSpan(
                      text: 'MZ',
                      style: TextStyle(
                        color: kAmber,
                        fontSize: 30,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -1,
                      ),
                    ),
                    TextSpan(
                      text: ' Logistic',
                      style: TextStyle(
                        color: kWhite,
                        fontSize: 24,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 3),
              const Text(
                'Livraison Rapide et Fiable',
                style: TextStyle(
                  color: Color(0xFF8899BB),
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 0.4,
                ),
              ),
            ],
          ),
          // Badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: kAmber.withOpacity(0.15),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: kAmber.withOpacity(0.4)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.verified_rounded, color: kAmber, size: 14),
                SizedBox(width: 6),
                Text(
                  'Espace Livreur',
                  style: TextStyle(
                    color: kAmber,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Hero Section ─────────────────────────────────────────────
class _HeroSection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
      child: Column(
        children: [
          // ── Truck Image ──────────────────────────────────
          Container(
            width: double.infinity,
            height: 210,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: kNavy.withOpacity(0.15),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: Image.asset(
                'assets/images/mz_truck.png',
                fit: BoxFit.cover,
                // Fallback si image non trouvée
                errorBuilder: (_, __, ___) => Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [kNavy, kNavy.withOpacity(0.75)],
                    ),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.local_shipping_rounded,
                          size: 72, color: kAmber),
                      const SizedBox(height: 12),
                      const Text(
                        'MZ Logistic',
                        style: TextStyle(
                          color: kWhite,
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          const SizedBox(height: 24),

          // ── Motivational Card ────────────────────────────
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: kWhite,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: const Color(0xFFE8ECF4)),
              boxShadow: [
                BoxShadow(
                  color: kNavy.withOpacity(0.06),
                  blurRadius: 18,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Quote icon container
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: kAmber.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: const Icon(
                    Icons.format_quote_rounded,
                    color: kAmber,
                    size: 22,
                  ),
                ),
                const SizedBox(height: 14),

                const Text(
                  'Rejoignez notre équipe de livreurs professionnels !',
                  style: TextStyle(
                    color: kNavy,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    height: 1.4,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Votre avenir est garanti avec MZ Logistic. '
                  'Créez votre compte dès aujourd\'hui — une fois '
                  'validé par l\'admin, vous recevrez une notification '
                  'et vous pourrez commencer à livrer immédiatement. '
                  'Chaque journée est une nouvelle opportunité ! 🚀',
                  style: TextStyle(
                    color: kGrey,
                    fontSize: 14,
                    height: 1.7,
                    fontWeight: FontWeight.w400,
                  ),
                ),

                const SizedBox(height: 16),

                // Day quote
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        kNavy.withOpacity(0.04),
                        kAmber.withOpacity(0.07),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: kAmber.withOpacity(0.22)),
                  ),
                  child: Row(
                    children: [
                      const Text('☀️', style: TextStyle(fontSize: 20)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          '"Chaque matin est une chance de faire mieux qu\'hier."',
                          style: TextStyle(
                            color: kNavy.withOpacity(0.72),
                            fontSize: 13,
                            fontStyle: FontStyle.italic,
                            fontWeight: FontWeight.w500,
                            height: 1.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Features Row ─────────────────────────────────────────────
class _FeaturesRow extends StatelessWidget {
  static const List<Map<String, dynamic>> _items = [
    {
      'icon':  Icons.speed_rounded,
      'label': 'Rapide',
      'color': Color(0xFF4C70FF),
    },
    {
      'icon':  Icons.verified_rounded,
      'label': 'Fiable',
      'color': Color(0xFF22C55E),
    },
    {
      'icon':  Icons.lock_rounded,
      'label': 'Sécurisé',
      'color': Color(0xFFF59E0B),
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
      child: Row(
        children: List.generate(_items.length, (i) {
          final item  = _items[i];
          final color = item['color'] as Color;
          return Expanded(
            child: Container(
              margin: EdgeInsets.only(right: i < _items.length - 1 ? 10 : 0),
              padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 8),
              decoration: BoxDecoration(
                color: kWhite,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFFE8ECF4)),
                boxShadow: [
                  BoxShadow(
                    color: color.withOpacity(0.09),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(item['icon'] as IconData,
                        color: color, size: 22),
                  ),
                  const SizedBox(height: 9),
                  Text(
                    item['label'] as String,
                    style: const TextStyle(
                      color: kNavy,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
}

// ── Action Buttons ───────────────────────────────────────────
class _ActionButtons extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
      child: Column(
        children: [
          // ── Inscription ──────────────────────────────────
          SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton.icon(
              onPressed: () => Navigator.pushNamed(context, '/register'),
              icon: const Icon(Icons.person_add_rounded, size: 20),
              label: const Text(
                'Créer mon compte',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.2,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: kNavy,
                foregroundColor: kWhite,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ),

          const SizedBox(height: 12),

          // ── Connexion ────────────────────────────────────
          SizedBox(
            width: double.infinity,
            height: 56,
            child: OutlinedButton.icon(
              onPressed: () => Navigator.pushNamed(context, '/login'),
              icon: const Icon(Icons.login_rounded, size: 20),
              label: const Text(
                'Se connecter',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.2,
                ),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: kNavy,
                side: const BorderSide(color: kNavy, width: 1.8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ),

          const SizedBox(height: 16),

          // ── Info box ─────────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF8E7),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: kAmber.withOpacity(0.3)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.info_outline_rounded,
                    color: kAmber, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Après inscription, votre compte sera validé par '
                    'l\'administrateur. Vous recevrez une notification '
                    'dès l\'approbation de votre demande.',
                    style: TextStyle(
                      color: kNavy.withOpacity(0.72),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      height: 1.55,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Footer ───────────────────────────────────────────────────
class _Footer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 36),
      child: Column(
        children: [
          Divider(color: const Color(0xFFE8ECF4), thickness: 1),
          const SizedBox(height: 16),
          Text(
            '© 2025 MZ Logistic — Tous droits réservés',
            style: TextStyle(
              color: kGrey.withOpacity(0.65),
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 5),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.email_outlined,
                  size: 13, color: kAmber.withOpacity(0.8)),
              const SizedBox(width: 5),
              Text(
                'mzlogistic2025@gmail.com',
                style: TextStyle(
                  color: kAmber.withOpacity(0.85),
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
