// lib/screens/dashboard.dart
// ✅ Design MZ Logistic — Navy #1A2B4A + Amber #F59E0B
// ✅ Logique originale 100% conservée

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/storage.dart';
import '../services/courier_auto_location_service.dart';
import '../theme/theme_controller.dart';
import '../widgets/global_theme_toggle.dart';
import 'tournee_map_screen.dart';

// ── Palette MZ ────────────────────────────────────────────────
const _kNavy    = Color(0xFF1A2B4A);
const _kAmber   = Color(0xFFF59E0B);
const _kNavy2   = Color(0xFF243656);

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool loading         = true;
  bool assignedLoading = true;
  String msg           = '';
  String assignedMsg   = '';
  Map<String, dynamic>? me;
  List<Map<String, dynamic>> assignedColis = [];

  @override
  void initState() {
    super.initState();
    loadMe();
  }

  // ── Load data (original) ─────────────────────────────────
  Future<void> loadMe() async {
    setState(() {
      loading = assignedLoading = true;
      msg = assignedMsg = '';
    });
    try {
      final data = await Api.getJson('/auth/me', withAuth: true);
      List<Map<String, dynamic>> nextAssigned = [];
      String nextAssignedMsg = '';
      try {
        final assignedData =
            await Api.getJson('/courier/colis/assigned', withAuth: true);
        nextAssigned = _readList(assignedData);
        if (nextAssigned.isNotEmpty) {
          debugPrint('FIRST COLIS KEYS: ${nextAssigned.first.keys.toList()}');
          debugPrint('FIRST COLIS DATA: ${nextAssigned.first}');
        }
      } on ApiException catch (e) {
        if (e.statusCode == 401 || e.statusCode == 403) rethrow;
        nextAssignedMsg = e.message;
      }
      setState(() {
        me             = data;
        assignedColis  = nextAssigned;
        assignedMsg    = nextAssignedMsg;
      });
    } on ApiException catch (e) {
      if (e.statusCode == 401 || e.statusCode == 403) {
        await CourierAutoLocationService.instance.stop(markOffline: false);
        await Storage.clearToken();
        if (!mounted) return;
        Navigator.pushNamedAndRemoveUntil(
            context, '/login', (_) => false,
            arguments: e.message);
        return;
      }
      setState(() => msg = e.message);
    } finally {
      if (mounted) setState(() => loading = assignedLoading = false);
    }
  }

  List<Map<String, dynamic>> _readList(Map<String, dynamic> response) {
    for (final key in ['data', 'colis', 'items']) {
      final raw = response[key];
      if (raw is List) {
        return raw
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }
    }
    return [];
  }

  Future<void> logout() async {
    await CourierAutoLocationService.instance.stop();
    await Storage.clearToken();
    if (!mounted) return;
    Navigator.pushNamedAndRemoveUntil(context, '/', (_) => false);
  }

  void openMenuSheet() {
    final isDark     = Theme.of(context).brightness == Brightness.dark;
    final controller = ThemeController.of(context);

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: isDark ? const Color(0xFF0F1B2D) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (sheetCtx) {
        return SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
                20, 14, 20, 24 + MediaQuery.of(sheetCtx).padding.bottom),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              // Handle
              Container(
                width: 44, height: 5,
                decoration: BoxDecoration(
                  color: isDark ? Colors.white24 : Colors.black12,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 20),
              _SheetTile(
                icon: Icons.event_note_outlined,
                iconColor: _kAmber,
                title: 'Mes congés',
                subtitle: 'Envoyer une demande et suivre l\'historique',
                onTap: () {
                  Navigator.pop(sheetCtx);
                  Navigator.pushNamed(context, '/conges');
                },
              ),
              const SizedBox(height: 10),
              _SheetTile(
                icon: isDark
                    ? Icons.light_mode_outlined
                    : Icons.dark_mode_outlined,
                iconColor: const Color(0xFF4C70FF),
                title: isDark ? 'Mode clair' : 'Mode sombre',
                subtitle: 'Changer l\'apparence de l\'application',
                onTap: () async {
                  Navigator.pop(sheetCtx);
                  await controller.toggle();
                },
              ),
              const SizedBox(height: 10),
              _SheetTile(
                icon: Icons.logout_rounded,
                iconColor: const Color(0xFFEF4444),
                title: 'Se déconnecter',
                subtitle: 'Quitter l\'espace livreur',
                onTap: () {
                  Navigator.pop(sheetCtx);
                  logout();
                },
              ),
            ]),
          ),
        );
      },
    );
  }

  // ── Helpers (original) ────────────────────────────────────
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
      case 'temporary_leave': return const Color(0xFFF59E0B);
      case 'contract_ended':  return const Color(0xFFEF4444);
      default:                return const Color(0xFF22C55E);
    }
  }

  double? _toDouble(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }

  String _firstText(List<dynamic> values, {String fallback = ''}) {
    for (final v in values) {
      final t = v?.toString().trim() ?? '';
      if (t.isNotEmpty && t != 'null') return t;
    }
    return fallback;
  }

  Map<String, dynamic> _depotForLivreur() {
    final rawRegion = _firstText([
      me?['assigned_region'], me?['region'], me?['gouvernorat'],
    ]).toLowerCase();
    if (rawRegion.contains('sousse')) {
      return {
        'label': 'Dépôt Sousse', 'adresse': 'Sousse, Tunisie',
        'latitude': 35.77005959180682, 'longitude': 10.594931528518906,
        'depot_depart': 'sousse',
      };
    }
    if (rawRegion.contains('kairouan')) {
      return {
        'label': 'Dépôt Kairouan', 'adresse': 'Kairouan, Tunisie',
        'latitude': 35.68779123889766, 'longitude': 10.083732874866017,
        'depot_depart': 'kairouan',
      };
    }
    return {
      'label': 'Dépôt', 'adresse': '',
      'latitude': null, 'longitude': null, 'depot_depart': rawRegion,
    };
  }

  void _showAssignedMessage(String message) {
    setState(() => assignedMsg = message);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  void _openPlanificationMap() {
    if (assignedColis.isEmpty) {
      _showAssignedMessage(assignedMsg.isNotEmpty
          ? assignedMsg
          : 'Aucun colis affecté pour afficher la carte.');
      return;
    }
    final depot = _depotForLivreur();
    final stops = <Map<String, dynamic>>[];
    for (var i = 0; i < assignedColis.length; i++) {
      final colis = assignedColis[i];
      final lat = _toDouble(colis['latitude'] ?? colis['lat'] ??
          colis['client_latitude'] ?? colis['destination_latitude'] ??
          colis['destinataire_latitude'] ?? colis['adresse_latitude'] ??
          colis['latitude_livraison'] ?? colis['livraison_latitude'] ??
          colis['lat_livraison'] ?? colis['gps_lat'] ??
          colis['gps_latitude'] ?? colis['coord_lat'] ??
          colis['coordonnees_latitude']);
      final lng = _toDouble(colis['longitude'] ?? colis['lng'] ??
          colis['lon'] ?? colis['client_longitude'] ??
          colis['destination_longitude'] ?? colis['destinataire_longitude'] ??
          colis['adresse_longitude'] ?? colis['longitude_livraison'] ??
          colis['livraison_longitude'] ?? colis['lng_livraison'] ??
          colis['lon_livraison'] ?? colis['gps_lng'] ??
          colis['gps_longitude'] ?? colis['coord_lng'] ??
          colis['coordonnees_longitude']);
      debugPrint('COLIS GPS CHECK id=${colis["id"]} lat=$lat lng=$lng');
      if (lat == null || lng == null) continue;
      stops.add({
        'ordre': int.tryParse('${colis["ordre"] ?? i + 1}') ?? i + 1,
        'colis_id': colis['id'],
        'numero_suivi': _firstText([colis['numero_suivi'], colis['barcode_value'], colis['code']]),
        'adresse': _firstText([colis['adresse'], colis['adresse_livraison'], colis['rue']], fallback: 'Adresse non définie'),
        'latitude': lat, 'longitude': lng,
        'nom_destinataire': _firstText([colis['nom_destinataire'], colis['destinataire'], colis['client_name']]),
        'telephone_destinataire': _firstText([colis['telephone_destinataire'], colis['phone_destinataire'], colis['telephone'], colis['phone']]),
        'poids': colis['poids'],
        'tracking_stage': colis['tracking_stage'],
      });
    }
    if (stops.isEmpty) {
      _showAssignedMessage('Aucun colis avec coordonnées GPS. Vérifie la console.');
      return;
    }
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => TourneeMapScreen(tournee: {
        'id': DateTime.now().millisecondsSinceEpoch,
        'nom': 'Ma tournée',
        'depot_depart': depot['depot_depart'],
        'depot_label': depot['label'],
        'depot_adresse': depot['adresse'],
        'depot_latitude': depot['latitude'],
        'depot_longitude': depot['longitude'],
        'nombre_colis': stops.length,
        'stops': stops,
      }),
    ));
  }

  String _formatDate(String? raw) {
    if (raw == null || raw.trim().isEmpty) return 'Non définie';
    final p = DateTime.tryParse(raw);
    if (p == null) return raw;
    return '${p.day.toString().padLeft(2, '0')}/${p.month.toString().padLeft(2, '0')}/${p.year}';
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

  // ── Build ─────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF080E1A) : const Color(0xFFF2F4F9);

    final name   = (me?['name']?.toString().trim().isNotEmpty == true)
        ? me!['name'].toString().trim() : 'Livreur';
    final region = me?['assigned_region']?.toString().trim();
    final status = (me?['courier_status']?.toString().trim().isNotEmpty == true)
        ? me!['courier_status'].toString() : 'active';

    final dayOffLabel  = _dayOffLabel(me?['day_off']?.toString());
    final statusLabel  = _statusLabel(status);
    final isDayOff     = status == 'day_off';
    final initials     = name.isNotEmpty
        ? name.trim().split(' ').take(2).map((w) => w[0].toUpperCase()).join()
        : 'L';

    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: loading
            ? const Center(
                child: CircularProgressIndicator(color: _kAmber))
            : RefreshIndicator(
                onRefresh: loadMe,
                color: _kAmber,
                child: ListView(
                  physics: const BouncingScrollPhysics(
                      parent: AlwaysScrollableScrollPhysics()),
                  children: [
                    // ══ HEADER ══════════════════════════════
                    _DashHeader(
                      isDark:      isDark,
                      name:        name,
                      initials:    initials,
                      region:      region,
                      status:      status,
                      statusColor: _statusColor(status),
                      statusLabel: statusLabel,
                      dayOffLabel: dayOffLabel,
                      isDayOff:    isDayOff,
                      onMenu:      openMenuSheet,
                    ),

                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 20, 18, 28),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Day off banner
                          if (isDayOff) ...[
                            _DayOffBanner(dayLabel: dayOffLabel),
                            const SizedBox(height: 16),
                          ],

                          // Error
                          if (msg.isNotEmpty) ...[
                            _ErrorBox(message: msg),
                            const SizedBox(height: 16),
                          ],

                          // ── Quick actions label
                          _SectionLabel(label: 'Accès rapide'),
                          const SizedBox(height: 12),

                          // ── Grid cards
                          LayoutBuilder(builder: (ctx, box) {
                            final small = box.maxWidth < 520;
                            return GridView.count(
                              crossAxisCount: 2,
                              crossAxisSpacing: 12,
                              mainAxisSpacing: 12,
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              childAspectRatio: small ? 1.03 : 1.18,
                              children: [
                                _QuickCard(
                                  isDark:    isDark,
                                  icon:      Icons.event_note_outlined,
                                  iconColor: const Color(0xFF4C70FF),
                                  title:     'Mes congés',
                                  subtitle:  'Demandes et historique',
                                  onTap: () => Navigator.pushNamed(context, '/conges'),
                                ),
                                _QuickCard(
                                  isDark:    isDark,
                                  icon:      Icons.route_outlined,
                                  iconColor: _kAmber,
                                  title:     'Planification',
                                  subtitle:  assignedLoading
                                      ? 'Chargement...'
                                      : '${assignedColis.length} colis affectés',
                                  onTap: assignedLoading ? () {} : _openPlanificationMap,
                                ),
                                _QuickCard(
                                  isDark:    isDark,
                                  icon:      Icons.inventory_2_outlined,
                                  iconColor: const Color(0xFF22C55E),
                                  title:     'Colis affectés',
                                  subtitle:  assignedLoading
                                      ? 'Chargement...'
                                      : assignedMsg.isNotEmpty
                                          ? 'Erreur chargement'
                                          : '${assignedColis.length} colis',
                                  onTap: () => Navigator.pushNamed(context, '/colis-affectes'),
                                ),

                                _QuickCard(
                                  isDark:    isDark,
                                  icon:      Icons.qr_code_scanner_rounded,
                                  iconColor: const Color(0xFF9B87F5),
                                  title:     'Scanner colis',
                                  subtitle:  'En transit, livré, retour...',
                                  onTap: () => Navigator.pushNamed(context, '/scan'),
                                ),
                              ],
                            );
                          }),

                          const SizedBox(height: 16),

                          // ── Navigation rapide card
                          _NavCard(isDark: isDark),
                        ],
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
//  WIDGETS
// ══════════════════════════════════════════════════════════════

// ── Dashboard Header ──────────────────────────────────────────
class _DashHeader extends StatelessWidget {
  final bool     isDark;
  final String   name;
  final String   initials;
  final String?  region;
  final String   status;
  final Color    statusColor;
  final String   statusLabel;
  final String   dayOffLabel;
  final bool     isDayOff;
  final VoidCallback onMenu;

  const _DashHeader({
    required this.isDark,
    required this.name,
    required this.initials,
    required this.region,
    required this.status,
    required this.statusColor,
    required this.statusLabel,
    required this.dayOffLabel,
    required this.isDayOff,
    required this.onMenu,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 26),
      decoration: BoxDecoration(
        color: _kNavy,
        borderRadius: const BorderRadius.only(
          bottomLeft:  Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
        boxShadow: [
          BoxShadow(
            color: _kNavy.withOpacity(0.35),
            blurRadius: 28, offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          // Top row
          Row(
            children: [
              // Avatar
              Container(
                width: 48, height: 48,
                decoration: BoxDecoration(
                  color: _kAmber,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white24, width: 2),
                ),
                child: Center(
                  child: Text(
                    initials,
                    style: const TextStyle(
                      color: _kNavy,
                      fontWeight: FontWeight.w900,
                      fontSize: 17,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // Name + greeting
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Bonjour, $name 👋',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.3,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      (region != null && region!.isNotEmpty)
                          ? region! : 'Région non assignée',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.55),
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              // Theme + menu
              const ThemeIconButton(),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: onMenu,
                child: Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: const Icon(Icons.menu_rounded,
                      color: Colors.white, size: 20),
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Status chips row
          Row(
            children: [
              // Status chip
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: statusColor.withOpacity(0.4)),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Container(
                    width: 7, height: 7,
                    decoration: BoxDecoration(
                      color: statusColor, shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(statusLabel,
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 12, fontWeight: FontWeight.w800,
                      )),
                ]),
              ),

              const SizedBox(width: 8),

              // Day off chip
              if (dayOffLabel != 'Non défini')
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    color: isDayOff
                        ? _kAmber.withOpacity(0.18)
                        : Colors.white.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isDayOff
                          ? _kAmber.withOpacity(0.45)
                          : Colors.white24,
                    ),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.weekend_outlined,
                        size: 13,
                        color: isDayOff
                            ? _kAmber
                            : Colors.white.withOpacity(0.55)),
                    const SizedBox(width: 5),
                    Text(dayOffLabel,
                        style: TextStyle(
                          color: isDayOff
                              ? _kAmber
                              : Colors.white.withOpacity(0.55),
                          fontSize: 12, fontWeight: FontWeight.w700,
                        )),
                  ]),
                ),

              const Spacer(),

              // MZ badge
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: _kAmber.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: _kAmber.withOpacity(0.35)),
                ),
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.verified_rounded, color: _kAmber, size: 12),
                  SizedBox(width: 4),
                  Text('MZ Logistic',
                      style: TextStyle(
                        color: _kAmber,
                        fontSize: 11, fontWeight: FontWeight.w800,
                      )),
                ]),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Section Label ─────────────────────────────────────────────
class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Row(children: [
      Container(
        width: 4, height: 18,
        decoration: BoxDecoration(
          color: _kAmber,
          borderRadius: BorderRadius.circular(4),
        ),
      ),
      const SizedBox(width: 10),
      Text(label,
          style: TextStyle(
            color: isDark ? Colors.white : _kNavy,
            fontSize: 16,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.3,
          )),
    ]);
  }
}

// ── Quick Card PRO ────────────────────────────────────────────
class _QuickCard extends StatefulWidget {
  final bool isDark;
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _QuickCard({
    required this.isDark,
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  State<_QuickCard> createState() => _QuickCardState();
}

class _QuickCardState extends State<_QuickCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDark;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapCancel: () => setState(() => _pressed = false),
      onTapUp: (_) {
        setState(() => _pressed = false);
        widget.onTap();
      },
      child: AnimatedScale(
        scale: _pressed ? 0.965 : 1,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: isDark
                  ? Colors.white.withOpacity(0.08)
                  : const Color(0xFFDDE5F3),
            ),
            boxShadow: [
              BoxShadow(
                color: widget.iconColor.withOpacity(isDark ? 0.20 : 0.13),
                blurRadius: 22,
                offset: const Offset(0, 10),
              ),
              BoxShadow(
                color: _kNavy.withOpacity(isDark ? 0.22 : 0.06),
                blurRadius: 12,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(22),
            child: Stack(
              children: [
                // Big faded background icon
                Positioned(
                  right: -18,
                  bottom: -22,
                  child: Icon(
                    widget.icon,
                    size: 92,
                    color: widget.iconColor.withOpacity(isDark ? 0.08 : 0.07),
                  ),
                ),

                // Soft top glow
                Positioned(
                  right: -28,
                  top: -30,
                  child: Container(
                    width: 92,
                    height: 92,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: widget.iconColor.withOpacity(
                        isDark ? 0.10 : 0.12,
                      ),
                    ),
                  ),
                ),

                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                widget.iconColor.withOpacity(0.20),
                                widget.iconColor.withOpacity(0.08),
                              ],
                            ),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: widget.iconColor.withOpacity(0.25),
                            ),
                          ),
                          child: Icon(
                            widget.icon,
                            color: widget.iconColor,
                            size: 23,
                          ),
                        ),
                        const Spacer(),
                        Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            color: isDark
                                ? Colors.white.withOpacity(0.06)
                                : widget.iconColor.withOpacity(0.08),
                            borderRadius: BorderRadius.circular(13),
                            border: Border.all(
                              color: isDark
                                  ? Colors.white.withOpacity(0.08)
                                  : widget.iconColor.withOpacity(0.12),
                            ),
                          ),
                          child: Icon(
                            Icons.chevron_right_rounded,
                            color: isDark
                                ? Colors.white54
                                : widget.iconColor.withOpacity(0.75),
                            size: 22,
                          ),
                        ),
                      ],
                    ),

                    const Spacer(),

                    Text(
                      widget.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isDark ? Colors.white : _kNavy,
                        fontSize: 15.5,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.35,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      widget.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isDark
                            ? Colors.white.withOpacity(0.42)
                            : const Color(0xFF7D8AAA),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),

                    const SizedBox(height: 12),

                    Container(
                      height: 3,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(999),
                        gradient: LinearGradient(
                          colors: [
                            widget.iconColor,
                            widget.iconColor.withOpacity(0.25),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}










// ── Navigation Card ───────────────────────────────────────────
class _NavCard extends StatelessWidget {
  final bool isDark;
  const _NavCard({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_kNavy, _kNavy2],
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: _kNavy.withOpacity(0.4),
            blurRadius: 20, offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                color: _kAmber.withOpacity(0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.explore_outlined,
                  color: _kAmber, size: 20),
            ),
            const SizedBox(width: 12),
            const Text('Navigation rapide',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16, fontWeight: FontWeight.w900,
                )),
          ]),
          const SizedBox(height: 12),
          Text(
            'Accède à ton profil ou gère tes congés directement depuis ici.',
            style: TextStyle(
              color: Colors.white.withOpacity(0.62),
              fontSize: 13, height: 1.55,
            ),
          ),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () => Navigator.pushNamed(context, '/profile'),
                icon: const Icon(Icons.person_outline_rounded, size: 18),
                label: const Text('Profil',
                    style: TextStyle(fontWeight: FontWeight.w900)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kAmber,
                  foregroundColor: _kNavy,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => Navigator.pushNamed(context, '/conges'),
                icon: const Icon(Icons.event_note_outlined, size: 18),
                label: const Text('Congés',
                    style: TextStyle(fontWeight: FontWeight.w900)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Colors.white30),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ),
          ]),
        ],
      ),
    );
  }
}

// ── Day Off Banner ────────────────────────────────────────────
class _DayOffBanner extends StatelessWidget {
  final String dayLabel;
  const _DayOffBanner({required this.dayLabel});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8E7),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _kAmber.withOpacity(0.4)),
      ),
      child: Row(children: [
        Container(
          width: 38, height: 38,
          decoration: BoxDecoration(
            color: _kAmber.withOpacity(0.15),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(Icons.event_busy_outlined, color: _kAmber),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            'Aujourd\'hui est ton jour de repos ($dayLabel).',
            style: const TextStyle(
              color: Color(0xFF6D4700),
              fontWeight: FontWeight.w800, height: 1.4,
            ),
          ),
        ),
      ]),
    );
  }
}

// ── Error Box ─────────────────────────────────────────────────
class _ErrorBox extends StatelessWidget {
  final String message;
  const _ErrorBox({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFEF4444).withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.3)),
      ),
      child: Row(children: [
        const Icon(Icons.error_outline_rounded,
            color: Color(0xFFEF4444), size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Text(message,
              style: const TextStyle(
                color: Color(0xFFEF4444),
                fontWeight: FontWeight.w700,
              )),
        ),
      ]),
    );
  }
}

// ── Bottom Sheet Tile ─────────────────────────────────────────
class _SheetTile extends StatelessWidget {
  final IconData     icon;
  final Color        iconColor;
  final String       title;
  final String       subtitle;
  final VoidCallback onTap;

  const _SheetTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isDark
                ? const Color(0xFF1A2438)
                : const Color(0xFFF6F8FD),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: iconColor.withOpacity(0.2)),
              ),
              child: Icon(icon, color: iconColor),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                        color: isDark ? Colors.white : _kNavy,
                        fontWeight: FontWeight.w900, fontSize: 15,
                      )),
                  const SizedBox(height: 3),
                  Text(subtitle,
                      style: TextStyle(
                        color: isDark
                            ? Colors.white38
                            : const Color(0xFF8899BB),
                        fontSize: 12, height: 1.4,
                      )),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded,
                color: isDark ? Colors.white24 : const Color(0xFFCCD4E8)),
          ]),
        ),
      ),
    );
  }
}
