// lib/screens/register.dart
// ✅ Design MZ Logistic — tout dans un seul fichier
// ✅ Logique originale 100% conservée (phone format, validation, Api)

import 'package:flutter/material.dart';
import '../core/api.dart';
import '../widgets/global_theme_toggle.dart';

// ── Couleurs ──────────────────────────────────────────────────
const _kNavy  = Color(0xFF1A2B4A);
const _kAmber = Color(0xFFF59E0B);
const _kGrey  = Color(0xFF6B7280);

// ─────────────────────────────────────────────────────────────
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final name     = TextEditingController();
  final email    = TextEditingController();
  final phone    = TextEditingController(text: '+216 ');
  final password = TextEditingController();

  bool loading      = false;
  bool showPassword = false;
  String msg        = '';

  @override
  void initState() {
    super.initState();
    phone.addListener(_formatPhoneLive);
  }

  @override
  void dispose() {
    phone.removeListener(_formatPhoneLive);
    name.dispose();
    email.dispose();
    phone.dispose();
    password.dispose();
    super.dispose();
  }

  // ── Phone logic (original) ──────────────────────────────────
  void _formatPhoneLive() {
    final raw = phone.text;
    if (!raw.startsWith('+216')) {
      final digits = raw.replaceAll(RegExp(r'\D'), '');
      final local  = digits.startsWith('216') ? digits.substring(3) : digits;
      _setPhone('+216 ${_fmtLocal(local)}');
      return;
    }
    final after  = raw.replaceFirst('+216', '');
    final digits = after.replaceAll(RegExp(r'\D'), '');
    final local  = digits.length > 8 ? digits.substring(0, 8) : digits;
    _setPhone('+216 ${_fmtLocal(local)}');
  }

  String _fmtLocal(String local) {
    if (local.isEmpty) return '';
    if (local.length <= 2) return local;
    if (local.length <= 5) return '${local.substring(0, 2)} ${local.substring(2)}';
    return '${local.substring(0, 2)} ${local.substring(2, 5)} ${local.substring(5)}';
  }

  void _setPhone(String value) {
    if (phone.text == value) return;
    phone.value = TextEditingValue(
      text: value,
      selection: TextSelection.collapsed(offset: value.length),
    );
  }

  String _cleanPhone(String v) => v.replaceAll(' ', '');
  bool _validPhone(String v)   => RegExp(r'^\+216\d{8}$').hasMatch(_cleanPhone(v));
  bool _validPassword(String v)=> RegExp(r'^[A-Za-z]{6,}$').hasMatch(v.trim());

  // ── Submit (original) ───────────────────────────────────────
  Future<void> submit() async {
    FocusScope.of(context).unfocus();
    setState(() => msg = '');
    final ok = _formKey.currentState?.validate() ?? false;
    if (!ok) return;
    setState(() => loading = true);
    try {
      await Api.postJson(
        '/auth/courier/register',
        body: {
          'full_name': name.text.trim(),
          'email':     email.text.trim(),
          'phone':     _cleanPhone(phone.text),
          'password':  password.text.trim(),
        },
        withAuth: false,
      );
      if (!mounted) return;
      Navigator.pushReplacementNamed(
        context, '/login',
        arguments:
            'Inscription reçue. Attends la confirmation de l\'admin. '
            'Un email sera envoyé après validation.',
      );
    } on ApiException catch (e) {
      setState(() => msg = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor:
          isDark ? const Color(0xFF0A1120) : const Color(0xFFF4F6FB),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            children: [
              // ── Header ───────────────────────────────────
              _MzHeader(
                isDark:   isDark,
                title:    'Rejoignez-nous ! 🚚',
                subtitle: 'Créez votre compte livreur. L\'admin validera votre demande rapidement.',
              ),

              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                child: _MzCard(
                  isDark: isDark,
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Nom
                        _MzTextField(
                          controller:      name,
                          enabled:         !loading,
                          label:           'Nom complet',
                          hint:            'Ahmed Ben Ali',
                          icon:            Icons.person_outline_rounded,
                          textInputAction: TextInputAction.next,
                          validator: (v) {
                            if ((v ?? '').trim().length < 2) return 'Nom invalide';
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),

                        // Email
                        _MzTextField(
                          controller:      email,
                          enabled:         !loading,
                          label:           'Email',
                          hint:            'votre@email.com',
                          icon:            Icons.alternate_email_rounded,
                          keyboardType:    TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          validator: (v) {
                            final s = (v ?? '').trim();
                            if (!s.contains('@') || !s.contains('.')) {
                              return 'Email invalide';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),

                        // Téléphone
                        _MzTextField(
                          controller:      phone,
                          enabled:         !loading,
                          label:           'Téléphone',
                          hint:            '+216 12 345 678',
                          icon:            Icons.phone_outlined,
                          keyboardType:    TextInputType.phone,
                          textInputAction: TextInputAction.next,
                          validator: (v) {
                            if (!_validPhone((v ?? '').trim())) {
                              return 'Téléphone invalide (+216 + 8 chiffres)';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),

                        // Mot de passe
                        _MzTextField(
                          controller:      password,
                          enabled:         !loading,
                          label:           'Mot de passe',
                          hint:            'Minimum 6 lettres',
                          icon:            Icons.lock_outline_rounded,
                          obscureText:     !showPassword,
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) => loading ? null : submit(),
                          suffixIcon: IconButton(
                            onPressed: loading
                                ? null
                                : () => setState(
                                    () => showPassword = !showPassword),
                            icon: Icon(
                              showPassword
                                  ? Icons.visibility_off_rounded
                                  : Icons.visibility_rounded,
                              color: _kGrey, size: 20,
                            ),
                          ),
                          validator: (v) {
                            if (!_validPassword(v ?? '')) {
                              return 'Minimum 6 lettres alphabétiques';
                            }
                            return null;
                          },
                        ),

                        // Error
                        if (msg.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          _MzErrorBanner(message: msg),
                        ],

                        const SizedBox(height: 20),

                        // Submit
                        _MzPrimaryButton(
                          label:        'Créer mon compte',
                          loadingLabel: 'Création...',
                          loading:      loading,
                          onPressed:    submit,
                          icon:         Icons.person_add_rounded,
                        ),

                        const SizedBox(height: 12),

                        // Login link
                        OutlinedButton(
                          onPressed: loading
                              ? null
                              : () => Navigator.pushReplacementNamed(
                                  context, '/login'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: isDark ? Colors.white70 : _kNavy,
                            side: BorderSide(
                              color: isDark
                                  ? Colors.white24
                                  : _kNavy.withOpacity(0.25),
                            ),
                            minimumSize: const Size(double.infinity, 50),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: const Text(
                            'J\'ai déjà un compte',
                            style: TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),

                        const SizedBox(height: 16),

                        // Info note
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: _kAmber.withOpacity(0.08),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                                color: _kAmber.withOpacity(0.25)),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.info_outline_rounded,
                                  color: _kAmber, size: 17),
                              const SizedBox(width: 9),
                              Expanded(
                                child: Text(
                                  'Après validation admin, un email vous sera envoyé et la connexion sera possible.',
                                  style: TextStyle(
                                    color: isDark
                                        ? Colors.white70
                                        : _kNavy.withOpacity(0.7),
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
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
//  WIDGETS LOCAUX
// ══════════════════════════════════════════════════════════════

class _MzHeader extends StatelessWidget {
  final bool   isDark;
  final String title;
  final String subtitle;
  const _MzHeader({
    required this.isDark,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(24, 30, 24, 34),
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: _kNavy,
        borderRadius: const BorderRadius.only(
          bottomLeft:  Radius.circular(36),
          bottomRight: Radius.circular(36),
        ),
        boxShadow: [
          BoxShadow(
            color:  _kNavy.withOpacity(0.3),
            blurRadius: 28, offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              RichText(
                text: const TextSpan(children: [
                  TextSpan(
                    text: 'MZ',
                    style: TextStyle(
                      color: _kAmber, fontSize: 28,
                      fontWeight: FontWeight.w900, letterSpacing: -1,
                    ),
                  ),
                  TextSpan(
                    text: ' Logistic',
                    style: TextStyle(
                      color: Colors.white, fontSize: 22,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ]),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                decoration: BoxDecoration(
                  color: _kAmber.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: _kAmber.withOpacity(0.35)),
                ),
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.verified_rounded, color: _kAmber, size: 13),
                  SizedBox(width: 5),
                  Text('Espace Livreur',
                      style: TextStyle(
                        color: _kAmber, fontSize: 11,
                        fontWeight: FontWeight.w800,
                      )),
                ]),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text(title,
              style: const TextStyle(
                color: Colors.white, fontSize: 24,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.5, height: 1.2,
              )),
          const SizedBox(height: 8),
          Text(subtitle,
              style: TextStyle(
                color: Colors.white.withOpacity(0.62),
                fontSize: 13, fontWeight: FontWeight.w400, height: 1.6,
              )),
        ],
      ),
    );
  }
}

class _MzCard extends StatelessWidget {
  final bool   isDark;
  final Widget child;
  const _MzCard({required this.isDark, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark
              ? Colors.white.withOpacity(0.08)
              : const Color(0xFFE4E9F4),
        ),
        boxShadow: [
          BoxShadow(
            color: _kNavy.withOpacity(isDark ? 0.22 : 0.07),
            blurRadius: 24, offset: const Offset(0, 8),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _MzTextField extends StatelessWidget {
  final TextEditingController      controller;
  final bool                       enabled;
  final String                     label;
  final String                     hint;
  final IconData                   icon;
  final bool                       obscureText;
  final TextInputType?             keyboardType;
  final TextInputAction?           textInputAction;
  final void Function(String)?     onFieldSubmitted;
  final Widget?                    suffixIcon;
  final String? Function(String?)? validator;

  const _MzTextField({
    required this.controller,
    required this.enabled,
    required this.label,
    required this.hint,
    required this.icon,
    this.obscureText      = false,
    this.keyboardType,
    this.textInputAction,
    this.onFieldSubmitted,
    this.suffixIcon,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return TextFormField(
      controller:       controller,
      enabled:          enabled,
      obscureText:      obscureText,
      keyboardType:     keyboardType,
      textInputAction:  textInputAction,
      onFieldSubmitted: onFieldSubmitted,
      validator:        validator,
      style: TextStyle(
        color: isDark ? Colors.white : _kNavy,
        fontWeight: FontWeight.w600, fontSize: 15,
      ),
      decoration: InputDecoration(
        labelText:  label,
        hintText:   hint,
        prefixIcon: Icon(icon, size: 20, color: _kAmber),
        suffixIcon: suffixIcon,
        labelStyle: TextStyle(
          color: isDark ? Colors.white54 : _kGrey,
          fontWeight: FontWeight.w600, fontSize: 14,
        ),
        hintStyle: TextStyle(
          color: isDark ? Colors.white24 : _kGrey.withOpacity(0.5),
          fontSize: 14,
        ),
        filled:    true,
        fillColor: isDark
            ? Colors.white.withOpacity(0.04)
            : const Color(0xFFF6F8FD),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(
            color: isDark
                ? Colors.white.withOpacity(0.08)
                : const Color(0xFFE4E9F4),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: _kAmber, width: 1.8),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide:
              const BorderSide(color: Color(0xFFEF4444), width: 1.4),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide:
              const BorderSide(color: Color(0xFFEF4444), width: 1.8),
        ),
      ),
    );
  }
}

class _MzPrimaryButton extends StatelessWidget {
  final String       label;
  final String       loadingLabel;
  final bool         loading;
  final VoidCallback onPressed;
  final IconData     icon;

  const _MzPrimaryButton({
    required this.label,
    required this.loadingLabel,
    required this.loading,
    required this.onPressed,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: ElevatedButton(
        onPressed: loading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: _kNavy,
          foregroundColor: Colors.white,
          disabledBackgroundColor: _kNavy.withOpacity(0.5),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        child: loading
            ? const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 18, height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  ),
                  SizedBox(width: 12),
                  Text('Chargement...',
                      style: TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 15)),
                ],
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 20),
                  const SizedBox(width: 10),
                  Text(label,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15, letterSpacing: 0.2,
                      )),
                ],
              ),
      ),
    );
  }
}

class _MzErrorBanner extends StatelessWidget {
  final String message;
  const _MzErrorBanner({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFEF4444).withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.3)),
      ),
      child: Row(children: [
        const Icon(Icons.error_outline_rounded,
            color: Color(0xFFEF4444), size: 18),
        const SizedBox(width: 9),
        Expanded(
          child: Text(message,
              style: const TextStyle(
                color: Color(0xFFEF4444),
                fontWeight: FontWeight.w700, fontSize: 13, height: 1.5,
              )),
        ),
      ]),
    );
  }
}
