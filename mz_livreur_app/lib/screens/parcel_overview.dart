// lib/screens/parcel_overview.dart


import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../core/api.dart';
import '../widgets/global_theme_toggle.dart';

const _kNavy   = Color(0xFF1A2B4A);
const _kAmber  = Color(0xFFF59E0B);
const _kGrey   = Color(0xFF6B7280);
const _kPurple = Color(0xFF8B5CF6);

enum ParcelOverviewMode { notDelivered, returned }

class ParcelOverviewScreen extends StatefulWidget {
  const ParcelOverviewScreen({super.key, required this.mode});
  final ParcelOverviewMode mode;
  @override
  State<ParcelOverviewScreen> createState() => _ParcelOverviewScreenState();
}

class _ParcelOverviewScreenState extends State<ParcelOverviewScreen> {
  final MobileScannerController _scannerController = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates, facing: CameraFacing.back);
  final TextEditingController _manualReturnController = TextEditingController();

  bool _loading      = true;
  bool _submitting   = false;
  bool _scanEnabled  = true;
  bool _torchEnabled = false;
  String  _message        = '';
  bool    _messageIsError = false;
  List<Map<String, dynamic>> _items = const [];

  @override
  void initState() { super.initState(); _loadItems(); }

  @override
  void dispose() {
    _scannerController.dispose();
    _manualReturnController.dispose();
    super.dispose();
  }

  // ── Getters (original) ────────────────────────────────────
  String get _title => widget.mode == ParcelOverviewMode.notDelivered
      ? 'Colis à relivrer' : 'Retours expéditeur';

  String get _subtitle => widget.mode == ParcelOverviewMode.notDelivered
      ? 'Les colis revenus au dépôt pour être repris demain en livraison.'
      : 'Les colis déposés au dépôt pour retour expéditeur, ou ceux déjà retournés.';

  String get _endpoint => widget.mode == ParcelOverviewMode.notDelivered
      ? '/courier/colis/not-delivered' : '/courier/colis/returned';

  List<String> get _fallbackEndpoints => widget.mode == ParcelOverviewMode.notDelivered
      ? [_endpoint, '/courier/colis/undelivered'] : [_endpoint];

  String get _emptyMessage => widget.mode == ParcelOverviewMode.notDelivered
      ? 'Aucun colis à relivrer pour le moment.'
      : 'Aucun colis dans le flux retour expéditeur.';

  // ── Logic (original) ─────────────────────────────────────
  Future<void> _loadItems() async {
    setState(() { _loading = true; _message = ''; _messageIsError = false; });
    try {
      Map<String, dynamic>? data;
      ApiException? lastError;
      for (final endpoint in _fallbackEndpoints) {
        try {
          data = await Api.getJson(endpoint, withAuth: true); break;
        } on ApiException catch (e) {
          lastError = e;
          if (!(e.statusCode == 404 && endpoint != _fallbackEndpoints.last)) rethrow;
        }
      }
      if (data == null) throw lastError ?? ApiException(500, 'Impossible de charger les colis.');
      final rawItems = data['data'];
      final items = rawItems is List
          ? rawItems.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
          : <Map<String, dynamic>>[];
      if (!mounted) return;
      setState(() { _items = items; _message = ''; _messageIsError = false; });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() { _items = const []; _message = e.message; _messageIsError = true; });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool _canReportUndelivered(Map<String, dynamic> item) {
    final stage = item['tracking_stage']?.toString().toLowerCase() ?? '';
    return stage == 'out_for_delivery' &&
        (item['delivered_at']?.toString() ?? '').isEmpty &&
        (item['returned_at']?.toString() ?? '').isEmpty;
  }

  bool _canConfirmReturn(Map<String, dynamic> item) {
    final stage = item['tracking_stage']?.toString().toLowerCase() ?? '';
    return stage == 'return_pending' && (item['returned_at']?.toString() ?? '').isEmpty;
  }

  String _stageLabel(String? stage) {
    final raw = (stage ?? '').toLowerCase();
    if (raw == 'return_pending') return 'Dépôt retour expéditeur';
    if (raw == 'returned')       return 'Retour expéditeur';
    if (raw == 'out_for_delivery' || (raw.contains('out') && raw.contains('delivery'))) return 'Sorti du dépôt';
    if (raw == 'at_warehouse' || raw.contains('warehouse')) return 'Au dépôt';
    if (raw == 'picked_up' || raw.contains('picked')) return 'Récupéré';
    if (raw == 'delivered' || raw.contains('deliver')) return 'Livré';
    return 'En attente';
  }

  String _statusLabel(String? status) {
    final raw = (status ?? '').toLowerCase();
    if (raw.contains('relivr') || raw.contains('report')) return 'À relivrer';
    if (raw.contains('livr'))   return 'Livré';
    if (raw.contains('retour')) return 'Retour';
    if (raw.contains('transit')) return 'En transit';
    if (raw.contains('annul'))  return 'Annulé';
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

  Future<void> _openReasonDialog(Map<String, dynamic> colis) async {
    final ctrl = TextEditingController();
    final reason = await showDialog<String>(context: context,
      builder: (ctx) {
        String? localError;
        return StatefulBuilder(builder: (ctx, setSt) => AlertDialog(
          title: const Text('Motif à relivrer'),
          content: Column(mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(colis['numero_suivi']?.toString() ?? '-',
                style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            TextField(controller: ctrl, maxLines: 4,
                decoration: const InputDecoration(labelText: 'Motif',
                    hintText: 'Ex: client absent, immeuble fermé...')),
            if (localError != null) ...[
              const SizedBox(height: 10),
              Text(localError!, style: const TextStyle(
                  color: Color(0xFFEF4444), fontWeight: FontWeight.w700))],
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Annuler')),
            FilledButton(onPressed: () {
              final v = ctrl.text.trim();
              if (v.length < 3) { setSt(() => localError = 'Minimum 3 caractères.'); return; }
              Navigator.of(ctx).pop(v);
            }, child: const Text('Enregistrer'))],
        ));
      });
    ctrl.dispose();
    if (reason == null || reason.trim().isEmpty) return;
    await _markAsRescheduled(colis, reason);
  }

  Future<void> _markAsRescheduled(Map<String, dynamic> colis, String reason) async {
    final id = int.tryParse(colis['id']?.toString() ?? '');
    if (id == null || _submitting) return;
    setState(() { _submitting = true; _message = ''; _messageIsError = false; });
    try {
      final data = await Api.postJson('/courier/colis/$id/undelivered',
          body: {'reason': reason.trim()}, withAuth: true);
      if (!mounted) return;
      setState(() { _message = data['detail']?.toString() ?? 'Motif enregistré'; _messageIsError = false; });
      await _loadItems();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() { _message = e.message; _messageIsError = true; });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _confirmReturnFromList(Map<String, dynamic> colis) async {
    final id = int.tryParse(colis['id']?.toString() ?? '');
    if (id == null || _submitting) return;
    setState(() { _submitting = true; _message = ''; _messageIsError = false; });
    try {
      final data = await Api.postJson('/courier/colis/$id/confirm-return',
          body: const <String, dynamic>{}, withAuth: true);
      if (!mounted) return;
      setState(() { _message = data['detail']?.toString() ?? 'Retour confirmé'; _messageIsError = false; });
      await _loadItems();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() { _message = e.message; _messageIsError = true; });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _submitReturnByCode(String rawCode) async {
    final barcode = rawCode.trim();
    if (barcode.isEmpty || _submitting) return;
    await _scannerController.stop();
    setState(() { _submitting = true; _message = ''; _messageIsError = false;
      _scanEnabled = false; _manualReturnController.text = barcode; });
    try {
      final data = await Api.postJson('/courier/colis/scan/return-shipper',
          body: {'barcode_value': barcode}, withAuth: true);
      if (!mounted) return;
      setState(() { _message = data['detail']?.toString() ?? 'Retour confirmé'; _messageIsError = false; });
      await _loadItems();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() { _message = e.message; _messageIsError = true; });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _scanAgain() async {
    await _scannerController.start();
    if (!mounted) return;
    setState(() { _scanEnabled = true; _message = ''; });
  }

  // ── Build ─────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final modeColor = widget.mode == ParcelOverviewMode.notDelivered ? _kAmber : _kPurple;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080E1A) : const Color(0xFFF2F4F9),
      body: SafeArea(
        child: Column(children: [
          // ── Header ───────────────────────────────────────
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(20, 18, 16, 24),
            decoration: BoxDecoration(color: _kNavy,
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(28), bottomRight: Radius.circular(28)),
              boxShadow: [BoxShadow(color: _kNavy.withOpacity(0.3),
                  blurRadius: 22, offset: const Offset(0, 8))]),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                IconButton(onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.arrow_back_ios_new_rounded,
                        color: Colors.white, size: 20),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 36, minHeight: 36)),
                const SizedBox(width: 8),
                Expanded(child: Text(_title, style: const TextStyle(
                    color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900))),
                const ThemeIconButton(),
                const SizedBox(width: 4),
                IconButton(onPressed: _loadItems,
                    icon: const Icon(Icons.refresh_rounded, color: Colors.white70, size: 22)),
              ]),
              const SizedBox(height: 14),
              Row(children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(color: modeColor.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: modeColor.withOpacity(0.35))),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(widget.mode == ParcelOverviewMode.notDelivered
                        ? Icons.schedule_rounded : Icons.assignment_return_outlined,
                        color: modeColor, size: 14),
                    const SizedBox(width: 6),
                    Text('${_items.length} colis', style: TextStyle(
                        color: modeColor, fontSize: 12, fontWeight: FontWeight.w800)),
                  ])),
                const SizedBox(width: 10),
                Expanded(child: Text(_subtitle, style: TextStyle(
                    color: Colors.white.withOpacity(0.55), fontSize: 11, height: 1.4),
                    maxLines: 2, overflow: TextOverflow.ellipsis)),
              ]),
            ]),
          ),

          Expanded(child: RefreshIndicator(
            onRefresh: _loadItems, color: _kAmber,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 28),
              children: [
                // Message
                if (_message.isNotEmpty) ...[
                  _Banner(message: _message, isError: _messageIsError),
                  const SizedBox(height: 14),
                ],

                // Scanner for returned mode
                if (widget.mode == ParcelOverviewMode.returned) ...[
                  _ReturnScannerCard(
                    isDark: isDark,
                    scannerController: _scannerController,
                    manualController: _manualReturnController,
                    scanEnabled: _scanEnabled,
                    submitting: _submitting,
                    torchEnabled: _torchEnabled,
                    onDetect: (barcode) => _submitReturnByCode(barcode),
                    onSubmit: _submitReturnByCode,
                    onScanAgain: _scanAgain,
                    onToggleTorch: () async {
                      await _scannerController.toggleTorch();
                      if (!mounted) return;
                      setState(() => _torchEnabled = !_torchEnabled);
                    }),
                  const SizedBox(height: 16),
                ],

                // Loading
                if (_loading)
                  const Padding(padding: EdgeInsets.symmetric(vertical: 48),
                      child: Center(child: CircularProgressIndicator(color: _kAmber)))
                // Empty
                else if (_items.isEmpty && !_messageIsError)
                  _EmptyCard(isDark: isDark, message: _emptyMessage)
                // List
                else
                  ...List.generate(_items.length, (i) {
                    final item  = _items[i];
                    final stage = item['tracking_stage']?.toString();
                    final canReport  = widget.mode == ParcelOverviewMode.notDelivered && _canReportUndelivered(item);
                    final canConfirm = widget.mode == ParcelOverviewMode.returned      && _canConfirmReturn(item);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _ParcelCard(
                        isDark:       isDark,
                        item:         item,
                        stageLabel:   _stageLabel(stage),
                        statusLabel:  _statusLabel(item['statut']?.toString()),
                        canConfirm:   canConfirm,
                        modeColor:    modeColor,
                        mode:         widget.mode,
                        submitting:   _submitting,
                        formatDt:     _formatDateTime,
                        onReport:     canReport  ? () => _openReasonDialog(item) : null,
                        onConfirm:    canConfirm ? () => _confirmReturnFromList(item) : null,
                      ));
                  }),
              ],
            ),
          )),
        ]),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
//  WIDGETS
// ══════════════════════════════════════════════════════════════

class _Banner extends StatelessWidget {
  final String message; final bool isError;
  const _Banner({required this.message, required this.isError});
  @override
  Widget build(BuildContext context) {
    final color = isError ? const Color(0xFFEF4444) : const Color(0xFF22C55E);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.3))),
      child: Row(children: [
        Icon(isError ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded,
            color: color, size: 18),
        const SizedBox(width: 9),
        Expanded(child: Text(message, style: TextStyle(
            color: color, fontWeight: FontWeight.w700, fontSize: 13))),
      ]));
  }
}

class _EmptyCard extends StatelessWidget {
  final bool isDark; final String message;
  const _EmptyCard({required this.isDark, required this.message});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
    decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: isDark ? Colors.white.withOpacity(0.07) : const Color(0xFFE4E9F4))),
    child: Column(children: [
      Container(width: 56, height: 56,
          decoration: BoxDecoration(color: _kAmber.withOpacity(0.1), shape: BoxShape.circle),
          child: const Icon(Icons.inbox_outlined, color: _kAmber, size: 28)),
      const SizedBox(height: 14),
      Text(message, textAlign: TextAlign.center, style: TextStyle(
          color: isDark ? Colors.white54 : const Color(0xFF8899BB),
          fontWeight: FontWeight.w600, fontSize: 14)),
    ]));
}

class _ParcelCard extends StatelessWidget {
  final bool   isDark;
  final Map<String, dynamic> item;
  final String stageLabel, statusLabel;
  final bool   canConfirm, submitting;
  final Color  modeColor;
  final ParcelOverviewMode mode;
  final String Function(String?) formatDt;
  final VoidCallback? onReport, onConfirm;

  const _ParcelCard({
    required this.isDark, required this.item, required this.stageLabel,
    required this.statusLabel, required this.canConfirm, required this.modeColor,
    required this.mode, required this.submitting, required this.formatDt,
    required this.onReport, required this.onConfirm,
  });

  @override
  Widget build(BuildContext context) {
    final numero       = item['numero_suivi']?.toString() ?? '-';
    final destinataire = item['nom_destinataire']?.toString() ?? '-';
    final adresse      = item['adresse_livraison']?.toString() ?? '-';
    final barcode      = item['barcode_value']?.toString() ?? '-';
    final issueCount   = item['delivery_issue_count']?.toString() ?? '0';
    final lastReason   = item['last_delivery_issue_reason']?.toString() ?? '';
    final returnedAt   = item['returned_at']?.toString() ?? '';
    final outAt        = item['out_for_delivery_at']?.toString() ?? '';

    final showReportDone = mode == ParcelOverviewMode.notDelivered &&
        item['tracking_stage']?.toString().toLowerCase() == 'at_warehouse';
    final showReturnDone = mode == ParcelOverviewMode.returned && returnedAt.isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isDark ? Colors.white.withOpacity(0.07) : const Color(0xFFE4E9F4)),
          boxShadow: [BoxShadow(color: _kNavy.withOpacity(isDark ? 0.15 : 0.04),
              blurRadius: 12, offset: const Offset(0, 4))]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Top row
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(width: 44, height: 44,
              decoration: BoxDecoration(color: modeColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(13),
                  border: Border.all(color: modeColor.withOpacity(0.2))),
              child: Icon(mode == ParcelOverviewMode.notDelivered
                  ? Icons.schedule_rounded : Icons.assignment_return_outlined,
                  color: modeColor, size: 22)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(numero, style: TextStyle(
                color: isDark ? Colors.white : _kNavy,
                fontSize: 15, fontWeight: FontWeight.w900)),
            const SizedBox(height: 3),
            Text(destinataire, maxLines: 1, overflow: TextOverflow.ellipsis,
                style: TextStyle(color: isDark ? Colors.white70 : _kNavy,
                    fontWeight: FontWeight.w700, fontSize: 13)),
          ])),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
            decoration: BoxDecoration(
                color: (canConfirm ? _kPurple : modeColor).withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: (canConfirm ? _kPurple : modeColor).withOpacity(0.3))),
            child: Text(stageLabel, style: TextStyle(
                color: canConfirm ? _kPurple : modeColor,
                fontSize: 11, fontWeight: FontWeight.w800))),
        ]),
        const SizedBox(height: 10),

        // Address
        Text(adresse, style: TextStyle(
            color: isDark ? Colors.white38 : const Color(0xFF8899BB),
            fontSize: 12, height: 1.4)),
        const SizedBox(height: 12),

        // Info chips
        Wrap(spacing: 6, runSpacing: 6, children: [
          _InfoChip(isDark: isDark, label: 'Statut',   value: statusLabel),
          _InfoChip(isDark: isDark, label: 'Code',     value: barcode),
          _InfoChip(isDark: isDark, label: 'Sorti',    value: formatDt(outAt.isEmpty ? null : outAt)),
          _InfoChip(isDark: isDark, label: 'Tentatives', value: issueCount),
          if (lastReason.isNotEmpty)
            _InfoChip(isDark: isDark, label: 'Dernier motif', value: lastReason),
          if (mode == ParcelOverviewMode.returned)
            _InfoChip(isDark: isDark, label: 'Retour', value: formatDt(returnedAt.isEmpty ? null : returnedAt)),
        ]),

        // Action button
        if (onReport != null || onConfirm != null) ...[
          const SizedBox(height: 14),
          SizedBox(width: double.infinity, height: 48,
            child: ElevatedButton(
              onPressed: submitting ? null : (onReport ?? onConfirm),
              style: ElevatedButton.styleFrom(backgroundColor: _kNavy,
                  foregroundColor: Colors.white, elevation: 0,
                  disabledBackgroundColor: _kNavy.withOpacity(0.4),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
              child: Text(onReport != null ? 'Saisir le motif à relivrer'
                  : 'Confirmer le retour expéditeur',
                  style: const TextStyle(fontWeight: FontWeight.w800)))),
        ] else if (showReportDone) ...[
          const SizedBox(height: 10),
          _DoneNote(isDark: isDark,
              text: 'Motif déjà saisi. Ce colis peut être scanné demain pour une nouvelle sortie.'),
        ] else if (showReturnDone) ...[
          const SizedBox(height: 10),
          _DoneNote(isDark: isDark, text: 'Retour expéditeur déjà confirmé.'),
        ],
      ]),
    );
  }
}

class _DoneNote extends StatelessWidget {
  final bool isDark; final String text;
  const _DoneNote({required this.isDark, required this.text});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    decoration: BoxDecoration(color: const Color(0xFF22C55E).withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF22C55E).withOpacity(0.25))),
    child: Row(children: [
      const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF22C55E), size: 16),
      const SizedBox(width: 8),
      Expanded(child: Text(text, style: const TextStyle(
          color: Color(0xFF22C55E), fontWeight: FontWeight.w700, fontSize: 12, height: 1.4))),
    ]));
}

class _InfoChip extends StatelessWidget {
  final bool isDark; final String label; final String value;
  const _InfoChip({required this.isDark, required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
    decoration: BoxDecoration(
        color: isDark ? Colors.white.withOpacity(0.05) : const Color(0xFFF2F4F9),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.white.withOpacity(0.07) : const Color(0xFFE4E9F4))),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      Text(label, style: TextStyle(
          color: isDark ? Colors.white38 : const Color(0xFF8899BB),
          fontSize: 10, fontWeight: FontWeight.w700)),
      const SizedBox(height: 3),
      Text(value, style: TextStyle(
          color: isDark ? Colors.white : _kNavy, fontWeight: FontWeight.w800, fontSize: 12)),
    ]));
}

class _ReturnScannerCard extends StatelessWidget {
  final bool isDark, scanEnabled, submitting, torchEnabled;
  final MobileScannerController scannerController;
  final TextEditingController   manualController;
  final void Function(String)   onDetect, onSubmit;
  final VoidCallback onScanAgain, onToggleTorch;

  const _ReturnScannerCard({
    required this.isDark, required this.scannerController, required this.manualController,
    required this.scanEnabled, required this.submitting, required this.torchEnabled,
    required this.onDetect, required this.onSubmit,
    required this.onScanAgain, required this.onToggleTorch,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: isDark ? Colors.white.withOpacity(0.07) : const Color(0xFFE4E9F4)),
          boxShadow: [BoxShadow(color: _kNavy.withOpacity(isDark ? 0.18 : 0.05),
              blurRadius: 16, offset: const Offset(0, 5))]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 40, height: 40,
              decoration: BoxDecoration(color: _kPurple.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _kPurple.withOpacity(0.2))),
              child: const Icon(Icons.qr_code_scanner_rounded, color: _kPurple, size: 20)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Scanner retour expéditeur', style: TextStyle(
                color: isDark ? Colors.white : _kNavy,
                fontSize: 15, fontWeight: FontWeight.w900)),
            const SizedBox(height: 2),
            Text('Scanne directement ou confirme depuis la liste.',
                style: TextStyle(color: isDark ? Colors.white38 : const Color(0xFF8899BB),
                    fontSize: 11)),
          ])),
          // Torch
          GestureDetector(onTap: onToggleTorch,
              child: Container(width: 36, height: 36,
                  decoration: BoxDecoration(
                      color: torchEnabled ? _kAmber : (isDark ? Colors.white.withOpacity(0.07) : const Color(0xFFF2F4F9)),
                      borderRadius: BorderRadius.circular(11),
                      border: Border.all(color: torchEnabled ? _kAmber : (isDark ? Colors.white12 : const Color(0xFFE4E9F4)))),
                  child: Icon(torchEnabled ? Icons.flash_on_rounded : Icons.flash_off_rounded,
                      color: torchEnabled ? _kNavy : (isDark ? Colors.white54 : _kGrey), size: 18))),
        ]),
        const SizedBox(height: 14),

        ClipRRect(borderRadius: BorderRadius.circular(18),
          child: SizedBox(height: 220,
            child: Stack(children: [
              MobileScanner(controller: scannerController,
                  onDetect: (capture) {
                    if (!scanEnabled || submitting) return;
                    final barcode = capture.barcodes.isNotEmpty
                        ? capture.barcodes.first.rawValue ?? '' : '';
                    if (barcode.trim().isNotEmpty) onDetect(barcode);
                  }),
              Positioned.fill(child: IgnorePointer(child: Container(
                  margin: const EdgeInsets.all(20),
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: _kPurple, width: 2))))),
              if (submitting) const Positioned.fill(child: ColoredBox(
                  color: Color(0x66000000),
                  child: Center(child: CircularProgressIndicator(color: Colors.white)))),
            ]))),
        const SizedBox(height: 12),

        TextField(
          controller: manualController, enabled: !submitting,
          textInputAction: TextInputAction.done,
          onSubmitted: onSubmit,
          style: TextStyle(color: isDark ? Colors.white : _kNavy,
              fontWeight: FontWeight.w600),
          decoration: InputDecoration(
              labelText: 'Code barre', hintText: 'Ex: 625028080000',
              prefixIcon: const Icon(Icons.barcode_reader, color: _kPurple),
              labelStyle: TextStyle(color: isDark ? Colors.white54 : _kGrey, fontWeight: FontWeight.w600),
              filled: true,
              fillColor: isDark ? Colors.white.withOpacity(0.04) : const Color(0xFFF6F8FD),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(color: isDark ? Colors.white.withOpacity(0.08) : const Color(0xFFE4E9F4))),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: _kPurple, width: 1.8)))),
        const SizedBox(height: 12),

        Row(children: [
          Expanded(child: SizedBox(height: 48,
            child: ElevatedButton(
              onPressed: submitting ? null : () => onSubmit(manualController.text),
              style: ElevatedButton.styleFrom(backgroundColor: _kNavy,
                  foregroundColor: Colors.white, elevation: 0,
                  disabledBackgroundColor: _kNavy.withOpacity(0.4),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
              child: const Text('Confirmer le retour',
                  style: TextStyle(fontWeight: FontWeight.w800))))),
          const SizedBox(width: 10),
          SizedBox(height: 48,
            child: OutlinedButton(
              onPressed: onScanAgain,
              style: OutlinedButton.styleFrom(
                  foregroundColor: isDark ? Colors.white70 : _kNavy,
                  side: BorderSide(color: isDark ? Colors.white24 : _kNavy.withOpacity(0.25)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
              child: const Text('Scanner', style: TextStyle(fontWeight: FontWeight.w700)))),
        ]),
      ]),
    );
  }
}
