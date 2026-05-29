// lib/screens/verify_otp.dart
// ✅ Design MZ Logistic — self-contained
// ✅ Logique originale 100% conservée

import 'package:flutter/material.dart';
import '../core/api.dart';
import '../widgets/global_theme_toggle.dart';

const _kNavy  = Color(0xFF1A2B4A);
const _kAmber = Color(0xFFF59E0B);
const _kGrey  = Color(0xFF6B7280);

class VerifyOtpScreen extends StatefulWidget {
  const VerifyOtpScreen({super.key});
  @override
  State<VerifyOtpScreen> createState() => _VerifyOtpScreenState();
}

class _VerifyOtpScreenState extends State<VerifyOtpScreen> {
  final _formKey = GlobalKey<FormState>();
  final otp      = TextEditingController();
  bool   loading      = false;
  String msg          = '';
  String email        = '';
  bool   _readArgOnce = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_readArgOnce) return;
    _readArgOnce = true;
    final arg = ModalRoute.of(context)?.settings.arguments;
    if (arg is Map && arg['email'] is String) {
      email = (arg['email'] as String).trim();
    }
  }

  @override
  void dispose() { otp.dispose(); super.dispose(); }

  Future<void> submit() async {
    FocusScope.of(context).unfocus();
    setState(() => msg = '');
    final ok = _formKey.currentState?.validate() ?? false;
    if (!ok) return;
    setState(() => loading = true);
    try {
      await Api.postJson('/auth/verify-otp',
          body: {'email': email, 'otp_code': otp.text.trim()}, withAuth: false);
      if (!mounted) return;
      Navigator.pushNamed(context, '/reset-password',
          arguments: {'email': email, 'otp': otp.text.trim()});
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
      backgroundColor: isDark ? const Color(0xFF080E1A) : const Color(0xFFF2F4F9),
      body: SafeArea(
        child: Column(children: [
          _PageHeader(isDark: isDark, iconData: Icons.verified_outlined,
              title: 'Vérifier le code OTP',
              subtitle: email.isEmpty ? 'Entrez le code reçu.' : 'Code envoyé à $email'),
          Expanded(child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
            child: Column(children: [
              if (email.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  decoration: BoxDecoration(color: _kAmber.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: _kAmber.withOpacity(0.25))),
                  child: Row(children: [
                    const Icon(Icons.email_outlined, color: _kAmber, size: 18),
                    const SizedBox(width: 10),
                    Expanded(child: Text(email, style: TextStyle(
                        color: isDark ? Colors.white70 : _kNavy,
                        fontWeight: FontWeight.w700, fontSize: 14))),
                  ])),
                const SizedBox(height: 16),
              ],
              _InfoNote(isDark: isDark, icon: Icons.info_outline_rounded,
                  text: 'Entrez le code à 6 chiffres reçu par email. Le code expire après quelques minutes.'),
              const SizedBox(height: 20),
              _Card(isDark: isDark, child: Form(
                key: _formKey,
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  // OTP field — big centered digits
                  TextFormField(
                    controller: otp, enabled: !loading,
                    keyboardType: TextInputType.number,
                    textInputAction: TextInputAction.done,
                    textAlign: TextAlign.center, maxLength: 6,
                    onFieldSubmitted: (_) => loading ? null : submit(),
                    style: TextStyle(color: isDark ? Colors.white : _kNavy,
                        fontSize: 28, fontWeight: FontWeight.w900, letterSpacing: 12),
                    decoration: InputDecoration(
                      labelText: 'Code OTP', hintText: '000000', counterText: '',
                      hintStyle: const TextStyle(fontSize: 26, letterSpacing: 12, color: Colors.grey),
                      prefixIcon: const Icon(Icons.verified_outlined, color: _kAmber),
                      labelStyle: TextStyle(color: isDark ? Colors.white54 : _kGrey,
                          fontWeight: FontWeight.w600),
                      filled: true,
                      fillColor: isDark ? Colors.white.withOpacity(0.04) : const Color(0xFFF6F8FD),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide(color: isDark ? Colors.white.withOpacity(0.08) : const Color(0xFFE4E9F4))),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: _kAmber, width: 1.8)),
                      errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFEF4444), width: 1.4)),
                      focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFEF4444), width: 1.8))),
                    validator: (v) {
                      if ((v ?? '').trim().length != 6) return 'Le code doit contenir 6 chiffres';
                      return null;
                    }),
                  if (msg.isNotEmpty) ...[const SizedBox(height: 14), _ErrBanner(msg)],
                  const SizedBox(height: 20),
                  _Btn(label: 'Vérifier', icon: Icons.check_circle_outline_rounded,
                      loading: loading, onPressed: submit),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: loading ? null : () => Navigator.pop(context),
                    style: TextButton.styleFrom(foregroundColor: _kAmber),
                    child: const Text('Renvoyer le code',
                        style: TextStyle(fontWeight: FontWeight.w700))),
                ]),
              )),
            ]),
          )),
        ]),
      ),
    );
  }
}

// ── LOCAL WIDGETS ─────────────────────────────────────────────

class _PageHeader extends StatelessWidget {
  final bool isDark; final IconData iconData;
  final String title; final String subtitle;
  const _PageHeader({required this.isDark, required this.iconData,
      required this.title, required this.subtitle});
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 18, 16, 26),
      decoration: BoxDecoration(color: _kNavy,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(32), bottomRight: Radius.circular(32)),
        boxShadow: [BoxShadow(color: _kNavy.withOpacity(0.32),
            blurRadius: 26, offset: const Offset(0, 9))]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          IconButton(onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 36, minHeight: 36)),
          const Expanded(child: SizedBox()),
          const ThemeIconButton(),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(color: _kAmber.withOpacity(0.15),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: _kAmber.withOpacity(0.35))),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.verified_rounded, color: _kAmber, size: 12), SizedBox(width: 4),
              Text('MZ Logistic', style: TextStyle(color: _kAmber, fontSize: 11, fontWeight: FontWeight.w800))])),
        ]),
        const SizedBox(height: 20),
        Row(children: [
          Container(width: 48, height: 48,
              decoration: BoxDecoration(color: _kAmber.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: _kAmber.withOpacity(0.3))),
              child: Icon(iconData, color: _kAmber, size: 24)),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(color: Colors.white, fontSize: 20,
                fontWeight: FontWeight.w900, letterSpacing: -0.3)),
            const SizedBox(height: 5),
            Text(subtitle, style: TextStyle(
                color: Colors.white.withOpacity(0.55), fontSize: 12, height: 1.5)),
          ])),
        ]),
      ]),
    );
  }
}

class _InfoNote extends StatelessWidget {
  final bool isDark; final IconData icon; final String text;
  const _InfoNote({required this.isDark, required this.icon, required this.text});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
    decoration: BoxDecoration(color: _kAmber.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _kAmber.withOpacity(0.22))),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, color: _kAmber, size: 18), const SizedBox(width: 10),
      Expanded(child: Text(text, style: TextStyle(
          color: isDark ? Colors.white70 : _kNavy.withOpacity(0.72),
          fontSize: 13, fontWeight: FontWeight.w500, height: 1.55)))]));
}

class _Card extends StatelessWidget {
  final bool isDark; final Widget child;
  const _Card({required this.isDark, required this.child});
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity, padding: const EdgeInsets.all(22),
    decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: isDark ? Colors.white.withOpacity(0.07) : const Color(0xFFE4E9F4)),
        boxShadow: [BoxShadow(color: _kNavy.withOpacity(isDark ? 0.22 : 0.07),
            blurRadius: 22, offset: const Offset(0, 7))]),
    child: child);
}

class _Btn extends StatelessWidget {
  final String label; final IconData icon;
  final bool loading; final VoidCallback onPressed;
  const _Btn({required this.label, required this.icon, required this.loading, required this.onPressed});
  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity, height: 54,
    child: ElevatedButton(
      onPressed: loading ? null : onPressed,
      style: ElevatedButton.styleFrom(backgroundColor: _kNavy, foregroundColor: Colors.white,
          disabledBackgroundColor: _kNavy.withOpacity(0.5), elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
      child: loading
          ? const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
              SizedBox(width: 12),
              Text('Chargement...', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15))])
          : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(icon, size: 20), const SizedBox(width: 10),
              Text(label, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, letterSpacing: 0.2))])));
}

class _ErrBanner extends StatelessWidget {
  final String message;
  const _ErrBanner(this.message);
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    decoration: BoxDecoration(color: const Color(0xFFEF4444).withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.3))),
    child: Row(children: [
      const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 18),
      const SizedBox(width: 9),
      Expanded(child: Text(message, style: const TextStyle(
          color: Color(0xFFEF4444), fontWeight: FontWeight.w700, fontSize: 13, height: 1.5)))]));
}
