// lib/screens/assigned_parcels.dart
// ✅ Design MZ Logistic — Navy + Amber
// ✅ Logique originale 100% conservée

import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/storage.dart';
import '../widgets/global_theme_toggle.dart';

const _kNavy  = Color(0xFF1A2B4A);
const _kAmber = Color(0xFFF59E0B);

class AssignedParcelsScreen extends StatefulWidget {
  const AssignedParcelsScreen({super.key});
  @override
  State<AssignedParcelsScreen> createState() => _AssignedParcelsScreenState();
}

class _AssignedParcelsScreenState extends State<AssignedParcelsScreen> {
  bool loading = true;
  String msg   = '';
  List<Map<String, dynamic>> assignedColis = [];

  @override
  void initState() {
    super.initState();
    loadAssignedColis();
  }

  // ── Logic (original) ─────────────────────────────────────
  List<Map<String, dynamic>> _readList(Map<String, dynamic> response) {
    for (final key in ['data', 'colis', 'items']) {
      final raw = response[key];
      if (raw is List) {
        return raw.whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e)).toList();
      }
    }
    return [];
  }

  Future<void> loadAssignedColis() async {
    setState(() { loading = true; msg = ''; });
    try {
      final data = await Api.getJson('/courier/colis/assigned', withAuth: true);
      if (!mounted) return;
      setState(() => assignedColis = _readList(data));
    } on ApiException catch (e) {
      if (e.statusCode == 401 || e.statusCode == 403) {
        await Storage.clearToken();
        if (!mounted) return;
        Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false,
            arguments: e.message);
        return;
      }
      if (!mounted) return;
      setState(() { assignedColis = []; msg = e.message; });
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  String _parcelStatusLabel(String? status) {
    final raw = (status ?? '').toLowerCase();
    if (raw.contains('relivr') || raw.contains('report')) return 'À relivrer';
    if (raw.contains('transit')) return 'En transit';
    if (raw.contains('livr'))    return 'Livré';
    if (raw.contains('retour'))  return 'Retour';
    if (raw.contains('annul'))   return 'Annulé';
    return 'En attente';
  }

  Color _parcelColor(Map<String, dynamic> item) {
    final statut      = (item['statut']?.toString() ?? '').toLowerCase();
    final stage       = (item['tracking_stage']?.toString() ?? '').toLowerCase();
    final returnedAt  = item['returned_at']?.toString() ?? '';
    final deliveredAt = item['delivered_at']?.toString() ?? '';
    if (returnedAt.isNotEmpty || stage.contains('return') ||
        statut.contains('retour')) return const Color(0xFFEF4444);
    if (deliveredAt.isNotEmpty || stage == 'delivered' ||
        statut.contains('livr'))  return const Color(0xFF22C55E);
    return _kAmber;
  }

  String _parcelStageLabel(String? stage) {
    final raw = (stage ?? '').toLowerCase();
    if (raw == 'return_pending') return 'Dépôt retour expéditeur';
    if (raw == 'returned')       return 'Retour confirmé';
    if (raw.contains('return'))  return 'Retour expéditeur';
    if (raw == 'picked_up' || raw.contains('picked')) return 'Récupéré';
    if (raw == 'out_for_delivery' ||
        (raw.contains('out') && raw.contains('delivery'))) return 'En transit';
    if (raw == 'at_warehouse' || raw.contains('warehouse')) return 'Au dépôt';
    if (raw == 'delivered' || raw.contains('deliver')) return 'Livré';
    return 'En attente';
  }

  String _formatDateTime(String? value) {
    if (value == null || value.trim().isEmpty) return '-';
    final p = DateTime.tryParse(value);
    if (p == null) return value;
    final l = p.toLocal();
    String d(int n) => n.toString().padLeft(2, '0');
    return '${d(l.day)}/${d(l.month)}/${l.year} ${d(l.hour)}:${d(l.minute)}';
  }

  String _parcelCode(Map<String, dynamic> item) {
    final b = item['barcode_value']?.toString().trim() ?? '';
    if (b.isNotEmpty) return b;
    return item['numero_suivi']?.toString().trim() ?? '';
  }

  void _openColis(Map<String, dynamic> item) {
    final code = _parcelCode(item);
    if (code.isEmpty) { setState(() => msg = 'Code colis introuvable.'); return; }
    Navigator.pushNamed(
      context,
      '/colis-action?code=${Uri.encodeQueryComponent(code)}',
      arguments: {'code': code, 'colis': item},
    );
  }

  // ── Build ─────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080E1A) : const Color(0xFFF2F4F9),
      body: SafeArea(
        child: Column(children: [
          _PageHeader(
            isDark:    isDark,
            count:     loading ? null : assignedColis.length,
            onRefresh: loading ? null : loadAssignedColis,
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: loadAssignedColis,
              color: _kAmber,
              child: loading
                  ? const Center(child: CircularProgressIndicator(color: _kAmber))
                  : ListView(
                      physics: const BouncingScrollPhysics(
                          parent: AlwaysScrollableScrollPhysics()),
                      padding: const EdgeInsets.fromLTRB(18, 20, 18, 28),
                      children: [
                        if (msg.isNotEmpty) ...[
                          _Banner(message: msg, isSuccess: false),
                          const SizedBox(height: 14),
                        ],
                        if (assignedColis.isEmpty && msg.isEmpty)
                          _EmptyState(isDark: isDark)
                        else
                          ...List.generate(assignedColis.length, (i) {
                            final item  = assignedColis[i];
                            final color = _parcelColor(item);
                            return Padding(
                              padding: EdgeInsets.only(
                                  bottom: i < assignedColis.length - 1 ? 10 : 0),
                              child: _ParcelTile(
                                isDark:      isDark,
                                item:        item,
                                statusLabel: _parcelStatusLabel(item['statut']?.toString()),
                                stageLabel:  _parcelStageLabel(item['tracking_stage']?.toString()),
                                dateLabel:   _formatDateTime(item['out_for_delivery_at']?.toString()),
                                statusColor: color,
                                onTap:       () => _openColis(item),
                              ),
                            );
                          }),
                      ],
                    ),
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

class _PageHeader extends StatelessWidget {
  final bool isDark;
  final int? count;
  final VoidCallback? onRefresh;
  const _PageHeader({required this.isDark, required this.count, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 18, 16, 24),
      decoration: BoxDecoration(
        color: _kNavy,
        borderRadius: const BorderRadius.only(
          bottomLeft:  Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
        boxShadow: [BoxShadow(
          color: _kNavy.withOpacity(0.3), blurRadius: 24,
          offset: const Offset(0, 8),
        )],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.arrow_back_ios_new_rounded,
                color: Colors.white, size: 20),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
          ),
          const SizedBox(width: 8),
          const Expanded(child: Text('Colis affectés', style: TextStyle(
            color: Colors.white, fontSize: 19, fontWeight: FontWeight.w900,
          ))),
          const ThemeIconButton(),
          const SizedBox(width: 4),
          IconButton(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh_rounded, color: Colors.white70, size: 22),
          ),
        ]),
        const SizedBox(height: 16),
        Row(children: [
          _StatChip(
            icon:  Icons.inventory_2_outlined,
            color: const Color(0xFF22C55E),
            label: 'Total',
            value: count == null ? '...' : '$count',
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: _kAmber.withOpacity(0.15),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _kAmber.withOpacity(0.3)),
            ),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.touch_app_outlined, color: _kAmber, size: 14),
              SizedBox(width: 6),
              Text('Tap pour agir', style: TextStyle(
                color: _kAmber, fontSize: 12, fontWeight: FontWeight.w700,
              )),
            ]),
          ),
        ]),
      ]),
    );
  }
}

class _StatChip extends StatelessWidget {
  final IconData icon;
  final Color    color;
  final String   label;
  final String   value;
  const _StatChip({required this.icon, required this.color,
      required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, color: color, size: 16),
        const SizedBox(width: 8),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(
            color: color.withOpacity(0.7), fontSize: 10, fontWeight: FontWeight.w700,
          )),
          Text(value, style: TextStyle(
            color: color, fontSize: 16, fontWeight: FontWeight.w900,
          )),
        ]),
      ]),
    );
  }
}

class _Banner extends StatelessWidget {
  final String message;
  final bool   isSuccess;
  const _Banner({required this.message, required this.isSuccess});

  @override
  Widget build(BuildContext context) {
    final color = isSuccess ? const Color(0xFF22C55E) : const Color(0xFFEF4444);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(children: [
        Icon(isSuccess ? Icons.check_circle_outline_rounded
            : Icons.error_outline_rounded, color: color, size: 18),
        const SizedBox(width: 9),
        Expanded(child: Text(message, style: TextStyle(
          color: color, fontWeight: FontWeight.w700, fontSize: 13,
        ))),
      ]),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final bool isDark;
  const _EmptyState({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: isDark ? Colors.white.withOpacity(0.07) : const Color(0xFFE4E9F4),
        ),
      ),
      child: Column(children: [
        Container(
          width: 64, height: 64,
          decoration: BoxDecoration(
            color: _kAmber.withOpacity(0.1), shape: BoxShape.circle,
          ),
          child: const Icon(Icons.inbox_outlined, color: _kAmber, size: 32),
        ),
        const SizedBox(height: 16),
        Text('Aucun colis affecté', style: TextStyle(
          color: isDark ? Colors.white : _kNavy,
          fontSize: 16, fontWeight: FontWeight.w800,
        )),
        const SizedBox(height: 8),
        Text('Tes colis affectés apparaîtront ici.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isDark ? Colors.white38 : const Color(0xFF8899BB),
              fontSize: 13, height: 1.5,
            )),
      ]),
    );
  }
}

class _ParcelTile extends StatelessWidget {
  final bool   isDark;
  final Map<String, dynamic> item;
  final String statusLabel;
  final String stageLabel;
  final String dateLabel;
  final Color  statusColor;
  final VoidCallback onTap;
  const _ParcelTile({
    required this.isDark, required this.item, required this.statusLabel,
    required this.stageLabel, required this.dateLabel,
    required this.statusColor, required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final numero       = item['numero_suivi']?.toString() ?? '-';
    final destinataire = item['nom_destinataire']?.toString() ?? '-';
    final adresse      = item['adresse_livraison']?.toString() ??
        item['adresse']?.toString() ?? '-';
    final ordre        = item['ordre']?.toString() ?? '';

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Ink(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isDark
                  ? Colors.white.withOpacity(0.07)
                  : const Color(0xFFE4E9F4),
            ),
            boxShadow: [BoxShadow(
              color: _kNavy.withOpacity(isDark ? 0.15 : 0.04),
              blurRadius: 12, offset: const Offset(0, 4),
            )],
          ),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            // Status icon
            Container(
              width: 46, height: 46,
              decoration: BoxDecoration(
                color: statusColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: statusColor.withOpacity(0.2)),
              ),
              child: Icon(Icons.local_shipping_outlined,
                  color: statusColor, size: 22),
            ),
            const SizedBox(width: 12),

            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Numéro + ordre
                Row(children: [
                  Expanded(child: Text(numero,
                      maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isDark ? Colors.white : _kNavy,
                        fontWeight: FontWeight.w900, fontSize: 14,
                      ))),
                  if (ordre.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: _kAmber.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: _kAmber.withOpacity(0.3)),
                      ),
                      child: Text('#$ordre', style: const TextStyle(
                        color: _kAmber, fontSize: 11, fontWeight: FontWeight.w800,
                      )),
                    ),
                  ],
                ]),
                const SizedBox(height: 5),

                Text(destinataire, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: isDark ? Colors.white70 : _kNavy,
                      fontWeight: FontWeight.w700, fontSize: 13,
                    )),
                const SizedBox(height: 3),

                Text(adresse, maxLines: 2, overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: isDark ? Colors.white38 : const Color(0xFF8899BB),
                      fontSize: 12, height: 1.4,
                    )),
                const SizedBox(height: 10),

                Wrap(spacing: 6, runSpacing: 6, children: [
                  _Pill(label: statusLabel, color: statusColor),
                  _Pill(label: stageLabel, muted: true, isDark: isDark),
                  if (dateLabel != '-')
                    _Pill(label: dateLabel, muted: true, isDark: isDark),
                ]),
              ],
            )),

            const SizedBox(width: 6),
            Icon(Icons.chevron_right_rounded,
                color: isDark ? Colors.white24 : const Color(0xFFCCD4E8)),
          ]),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final String label;
  final Color? color;
  final bool   muted;
  final bool   isDark;
  const _Pill({required this.label, this.color, this.muted = false, this.isDark = false});

  @override
  Widget build(BuildContext context) {
    final c = color ?? _kAmber;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: muted
            ? (isDark ? Colors.white.withOpacity(0.05) : const Color(0xFFF2F4F9))
            : c.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: muted
              ? (isDark ? Colors.white12 : const Color(0xFFE4E9F4))
              : c.withOpacity(0.3),
        ),
      ),
      child: Text(label, style: TextStyle(
        color: muted
            ? (isDark ? Colors.white38 : const Color(0xFF8899BB))
            : c,
        fontSize: 11, fontWeight: FontWeight.w800,
      )),
    );
  }
}
