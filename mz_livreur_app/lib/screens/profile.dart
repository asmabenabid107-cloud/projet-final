// lib/screens/profile.dart
// ✅ Design MZ Logistic — Navy + Amber
// ✅ Logique originale 100% conservée

import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/storage.dart';
import '../widgets/global_theme_toggle.dart';

const _kNavy  = Color(0xFF1A2B4A);
const _kAmber = Color(0xFFF59E0B);
const _kGrey  = Color(0xFF6B7280);

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final name     = TextEditingController();
  final email    = TextEditingController();
  final phone    = TextEditingController(text: '+216 ');

  bool loading = true;
  bool saving  = false;
  String msg   = '';
  Map<String, dynamic>? me;

  @override
  void initState() {
    super.initState();
    phone.addListener(_formatPhoneLive);
    loadProfile();
  }

  @override
  void dispose() {
    phone.removeListener(_formatPhoneLive);
    name.dispose(); email.dispose(); phone.dispose();
    super.dispose();
  }

  // ── Phone logic (original) ──────────────────────────────
  void _setPhone(String value) {
    if (phone.text == value) return;
    phone.value = TextEditingValue(
      text: value,
      selection: TextSelection.collapsed(offset: value.length),
    );
  }

  String _formatLocalPhone(String local) {
    if (local.isEmpty) return '';
    if (local.length <= 2) return local;
    if (local.length <= 5) return '${local.substring(0, 2)} ${local.substring(2)}';
    return '${local.substring(0, 2)} ${local.substring(2, 5)} ${local.substring(5)}';
  }

  void _formatPhoneLive() {
    final raw = phone.text;
    if (!raw.startsWith('+216')) {
      final digits = raw.replaceAll(RegExp(r'\D'), '');
      final local  = digits.startsWith('216') ? digits.substring(3) : digits;
      _setPhone('+216 ${_formatLocalPhone(local)}');
      return;
    }
    final digits = raw.replaceFirst('+216', '').replaceAll(RegExp(r'\D'), '');
    final local  = digits.length > 8 ? digits.substring(0, 8) : digits;
    _setPhone('+216 ${_formatLocalPhone(local)}');
  }

  String _cleanPhone(String v) => v.replaceAll(' ', '');
  bool _validPhone(String v) =>
      RegExp(r'^\+216\d{8}$').hasMatch(_cleanPhone(v));

  String _formatDate(String? raw) {
    if (raw == null || raw.trim().isEmpty) return 'Non définie';
    final p = DateTime.tryParse(raw);
    if (p == null) return raw;
    return '${p.day.toString().padLeft(2,'0')}/${p.month.toString().padLeft(2,'0')}/${p.year}';
  }

  String _statusLabel(String s) {
    switch (s) {
      case 'day_off':         return 'Jour de repos';
      case 'temporary_leave': return 'Congé temporaire';
      case 'contract_ended':  return 'Contrat terminé';
      default:                return 'Actif';
    }
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'day_off':
      case 'temporary_leave': return _kAmber;
      case 'contract_ended':  return const Color(0xFFEF4444);
      default:                return const Color(0xFF22C55E);
    }
  }

  String _dayOffLabel(String? raw) {
    switch ((raw ?? '').trim().toLowerCase()) {
      case 'monday':    return 'Lundi';
      case 'tuesday':   return 'Mardi';
      case 'wednesday': return 'Mercredi';
      case 'thursday':  return 'Jeudi';
      case 'friday':    return 'Vendredi';
      case 'saturday':  return 'Samedi';
      case 'sunday':    return 'Dimanche';
      default:          return 'Non défini';
    }
  }

  Future<void> _handleSessionError(ApiException e) async {
    if (e.statusCode == 401 || e.statusCode == 403) {
      await Storage.clearToken();
      if (!mounted) return;
      Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false,
          arguments: e.message);
      return;
    }
    setState(() => msg = e.message);
  }

  Future<void> loadProfile() async {
    setState(() { loading = true; msg = ''; });
    try {
      final data = await Api.getJson('/auth/me', withAuth: true);
      setState(() {
        me         = data;
        name.text  = data['name']?.toString() ?? '';
        email.text = data['email']?.toString() ?? '';
        final rawPhone = data['phone']?.toString() ?? '+216 ';
        _setPhone(rawPhone.startsWith('+216') ? rawPhone : '+216 ');
        _formatPhoneLive();
      });
    } on ApiException catch (e) {
      await _handleSessionError(e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> saveProfile() async {
    FocusScope.of(context).unfocus();
    setState(() => msg = '');
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => saving = true);
    try {
      final data = await Api.patchJson('/auth/me', body: {
        'full_name': name.text.trim(),
        'email':     email.text.trim(),
        'phone':     _cleanPhone(phone.text),
      });
      setState(() { me = data; msg = 'Profil mis à jour avec succès.'; });
    } on ApiException catch (e) {
      await _handleSessionError(e);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark  = Theme.of(context).brightness == Brightness.dark;
    final region  = me?['assigned_region']?.toString().trim();
    final depot   = me?['assigned_depot']?.toString().trim();
    final status  = me?['courier_status']?.toString() ?? 'active';
    final contEnd = me?['contract_end_date']?.toString();
    final dayOff  = _dayOffLabel(me?['day_off']?.toString());
    final isSuccess = msg.contains('succès') || msg.contains('succes');

    final nameStr = (me?['name']?.toString().trim().isNotEmpty == true)
        ? me!['name'].toString().trim() : 'Livreur';
    final initials = nameStr.trim().split(' ')
        .take(2).map((w) => w[0].toUpperCase()).join();

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080E1A) : const Color(0xFFF2F4F9),
      body: SafeArea(
        child: Column(children: [
          // ── Header ───────────────────────────────────────
          _ProfileHeader(
            isDark:    isDark,
            initials:  initials,
            name:      nameStr,
            status:    status,
            statusLabel: _statusLabel(status),
            statusColor: _statusColor(status),
            onRefresh: loadProfile,
          ),

          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator(color: _kAmber))
                : ListView(
                    padding: const EdgeInsets.fromLTRB(18, 20, 18, 32),
                    children: [
                      // ── Message ───────────────────────────
                      if (msg.isNotEmpty) ...[
                        _MsgBanner(message: msg, isSuccess: isSuccess),
                        const SizedBox(height: 16),
                      ],

                      // ── Info badges row ───────────────────
                      _InfoBadgesCard(
                        isDark:  isDark,
                        region:  region,
                        depot:   depot,
                        status:  status,
                        statusLabel: _statusLabel(status),
                        statusColor: _statusColor(status),
                        dayOff:  dayOff,
                        contEnd: contEnd != null && contEnd.isNotEmpty
                            ? 'Fin : ${_formatDate(contEnd)}'
                            : 'Contrat non défini',
                      ),

                      const SizedBox(height: 20),

                      // ── Section title ─────────────────────
                      _SectionTitle(label: 'Modifier mes informations'),
                      const SizedBox(height: 12),

                      // ── Edit form card ────────────────────
                      _EditFormCard(
                        isDark:    isDark,
                        formKey:   _formKey,
                        nameCtrl:  name,
                        emailCtrl: email,
                        phoneCtrl: phone,
                        saving:    saving,
                        validPhone: _validPhone,
                        onSave:    saveProfile,
                      ),
                    ],
                  ),
          ),
        ]),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
//  WIDGETS
// ══════════════════════════════════════════════════════════════

class _ProfileHeader extends StatelessWidget {
  final bool   isDark;
  final String initials;
  final String name;
  final String status;
  final String statusLabel;
  final Color  statusColor;
  final VoidCallback onRefresh;
  const _ProfileHeader({
    required this.isDark, required this.initials, required this.name,
    required this.status, required this.statusLabel, required this.statusColor,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 18, 16, 24),
      decoration: BoxDecoration(
        color: _kNavy,
        borderRadius: const BorderRadius.only(
          bottomLeft:  Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
        boxShadow: [BoxShadow(
          color: _kNavy.withOpacity(0.35), blurRadius: 28,
          offset: const Offset(0, 10),
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
          const Expanded(child: Text('Mon profil', style: TextStyle(
            color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900,
          ))),
          const ThemeIconButton(),
          const SizedBox(width: 4),
          IconButton(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh_rounded,
                color: Colors.white70, size: 22),
          ),
        ]),
        const SizedBox(height: 20),
        // Avatar + name
        Row(children: [
          Container(
            width: 56, height: 56,
            decoration: BoxDecoration(
              color: _kAmber, shape: BoxShape.circle,
              border: Border.all(color: Colors.white24, width: 2.5),
            ),
            child: Center(child: Text(initials, style: const TextStyle(
              color: _kNavy, fontWeight: FontWeight.w900, fontSize: 20,
            ))),
          ),
          const SizedBox(width: 14),
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: const TextStyle(
                color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900,
                letterSpacing: -0.3,
              )),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: statusColor.withOpacity(0.4)),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Container(width: 6, height: 6, decoration: BoxDecoration(
                    color: statusColor, shape: BoxShape.circle,
                  )),
                  const SizedBox(width: 5),
                  Text(statusLabel, style: TextStyle(
                    color: statusColor, fontSize: 11, fontWeight: FontWeight.w800,
                  )),
                ]),
              ),
            ],
          )),
          // MZ badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: _kAmber.withOpacity(0.15),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: _kAmber.withOpacity(0.35)),
            ),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.verified_rounded, color: _kAmber, size: 12),
              SizedBox(width: 4),
              Text('Livreur', style: TextStyle(
                color: _kAmber, fontSize: 11, fontWeight: FontWeight.w800,
              )),
            ]),
          ),
        ]),
      ]),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String label;
  const _SectionTitle({required this.label});
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Row(children: [
      Container(width: 4, height: 18, decoration: BoxDecoration(
        color: _kAmber, borderRadius: BorderRadius.circular(4),
      )),
      const SizedBox(width: 10),
      Text(label, style: TextStyle(
        color: isDark ? Colors.white : _kNavy,
        fontSize: 15, fontWeight: FontWeight.w900,
      )),
    ]);
  }
}

class _MsgBanner extends StatelessWidget {
  final String message;
  final bool   isSuccess;
  const _MsgBanner({required this.message, required this.isSuccess});
  @override
  Widget build(BuildContext context) {
    final color = isSuccess ? const Color(0xFF22C55E) : const Color(0xFFEF4444);
    final icon  = isSuccess
        ? Icons.check_circle_outline_rounded : Icons.error_outline_rounded;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 9),
        Expanded(child: Text(message, style: TextStyle(
          color: color, fontWeight: FontWeight.w700,
          fontSize: 13, height: 1.5,
        ))),
      ]),
    );
  }
}

class _InfoBadgesCard extends StatelessWidget {
  final bool   isDark;
  final String? region;
  final String? depot;
  final String  status;
  final String  statusLabel;
  final Color   statusColor;
  final String  dayOff;
  final String  contEnd;
  const _InfoBadgesCard({
    required this.isDark, required this.region, required this.depot,
    required this.status, required this.statusLabel, required this.statusColor,
    required this.dayOff, required this.contEnd,
  });

  @override
  Widget build(BuildContext context) {
    final badges = [
      _BadgeData(icon: Icons.location_on_outlined,
          label: (region != null && region!.isNotEmpty) ? region! : 'Région non assignée',
          color: const Color(0xFF4C70FF)),
      _BadgeData(icon: Icons.warehouse_outlined,
          label: (depot != null && depot!.isNotEmpty) ? 'Dépôt : $depot' : 'Dépôt non assigné',
          color: const Color(0xFF9B87F5)),
      _BadgeData(icon: Icons.shield_outlined,
          label: statusLabel, color: statusColor),
      _BadgeData(icon: Icons.weekend_outlined,
          label: 'Repos : $dayOff', color: _kAmber),
      _BadgeData(icon: Icons.calendar_today_outlined,
          label: contEnd, color: const Color(0xFF22C55E)),
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark ? Colors.white.withOpacity(0.07) : const Color(0xFFE4E9F4),
        ),
        boxShadow: [BoxShadow(
          color: _kNavy.withOpacity(isDark ? 0.18 : 0.05),
          blurRadius: 16, offset: const Offset(0, 5),
        )],
      ),
      child: Wrap(spacing: 8, runSpacing: 8, children: badges.map((b) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: BoxDecoration(
            color: b.color.withOpacity(0.08),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: b.color.withOpacity(0.25)),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(b.icon, color: b.color, size: 13),
            const SizedBox(width: 5),
            Text(b.label, style: TextStyle(
              color: b.color, fontSize: 12, fontWeight: FontWeight.w800,
            )),
          ]),
        );
      }).toList()),
    );
  }
}

class _BadgeData {
  final IconData icon;
  final String   label;
  final Color    color;
  const _BadgeData({required this.icon, required this.label, required this.color});
}

class _EditFormCard extends StatelessWidget {
  final bool   isDark;
  final GlobalKey<FormState>  formKey;
  final TextEditingController nameCtrl;
  final TextEditingController emailCtrl;
  final TextEditingController phoneCtrl;
  final bool   saving;
  final bool Function(String) validPhone;
  final VoidCallback onSave;

  const _EditFormCard({
    required this.isDark, required this.formKey,
    required this.nameCtrl, required this.emailCtrl, required this.phoneCtrl,
    required this.saving, required this.validPhone, required this.onSave,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: isDark ? Colors.white.withOpacity(0.07) : const Color(0xFFE4E9F4),
        ),
        boxShadow: [BoxShadow(
          color: _kNavy.withOpacity(isDark ? 0.18 : 0.06),
          blurRadius: 20, offset: const Offset(0, 6),
        )],
      ),
      child: Form(
        key: formKey,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          // Nom
          _MzField(isDark: isDark, controller: nameCtrl, enabled: !saving,
              label: 'Nom complet', hint: 'Ahmed Ben Ali',
              icon: Icons.person_outline_rounded,
              textInputAction: TextInputAction.next,
              validator: (v) {
                if ((v ?? '').trim().length < 2) return 'Nom invalide';
                return null;
              }),
          const SizedBox(height: 14),

          // Email
          _MzField(isDark: isDark, controller: emailCtrl, enabled: !saving,
              label: 'Email', hint: 'votre@email.com',
              icon: Icons.alternate_email_rounded,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              validator: (v) {
                final s = (v ?? '').trim();
                if (!s.contains('@') || !s.contains('.')) return 'Email invalide';
                return null;
              }),
          const SizedBox(height: 14),

          // Téléphone
          _MzField(isDark: isDark, controller: phoneCtrl, enabled: !saving,
              label: 'Téléphone', hint: '+216 12 345 678',
              icon: Icons.phone_outlined,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.done,
              validator: (v) {
                if (!validPhone((v ?? '').trim())) {
                  return 'Téléphone invalide (+216 + 8 chiffres)';
                }
                return null;
              }),

          const SizedBox(height: 20),

          // Save button
          SizedBox(
            width: double.infinity, height: 52,
            child: ElevatedButton(
              onPressed: saving ? null : onSave,
              style: ElevatedButton.styleFrom(
                backgroundColor: _kNavy,
                foregroundColor: Colors.white,
                disabledBackgroundColor: _kNavy.withOpacity(0.5),
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: saving
                  ? const Row(mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(width: 18, height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white)),
                        SizedBox(width: 12),
                        Text('Enregistrement...', style: TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 15)),
                      ])
                  : const Row(mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.save_rounded, size: 18),
                        SizedBox(width: 8),
                        Text('Enregistrer', style: TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 15)),
                      ]),
            ),
          ),
        ]),
      ),
    );
  }
}

class _MzField extends StatelessWidget {
  final bool   isDark;
  final TextEditingController controller;
  final bool   enabled;
  final String label;
  final String hint;
  final IconData icon;
  final TextInputType?     keyboardType;
  final TextInputAction?   textInputAction;
  final String? Function(String?)? validator;

  const _MzField({
    required this.isDark, required this.controller, required this.enabled,
    required this.label, required this.hint, required this.icon,
    this.keyboardType, this.textInputAction, this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller:      controller,
      enabled:         enabled,
      keyboardType:    keyboardType,
      textInputAction: textInputAction,
      validator:       validator,
      style: TextStyle(
        color: isDark ? Colors.white : _kNavy,
        fontWeight: FontWeight.w600, fontSize: 15,
      ),
      decoration: InputDecoration(
        labelText:  label,
        hintText:   hint,
        prefixIcon: Icon(icon, size: 20, color: _kAmber),
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
          borderSide: const BorderSide(color: Color(0xFFEF4444), width: 1.4),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFEF4444), width: 1.8),
        ),
      ),
    );
  }
}
