// lib/screens/parcel_status.dart
// ✅ Design MZ Logistic — Navy + Amber
// ✅ Logique originale 100% conservée

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/parcel_deep_link.dart';
import '../core/storage.dart';
import '../widgets/global_theme_toggle.dart';

const _kNavy = Color(0xFF1A2B4A);
const _kAmber = Color(0xFFF59E0B);
const _kGrey = Color(0xFF6B7280);

enum ParcelStatusAction { inTransit, delivered, rescheduled, returnPending }

class ParcelStatusScreen extends StatefulWidget {
  const ParcelStatusScreen({super.key, this.initialCode, this.initialData});
  final String? initialCode;
  final Map<String, dynamic>? initialData;
  @override
  State<ParcelStatusScreen> createState() => _ParcelStatusScreenState();
}

class _ParcelStatusScreenState extends State<ParcelStatusScreen> {
  final TextEditingController _reasonController = TextEditingController();

  bool _loading = true;
  bool _historyLoading = false;
  bool _submitting = false;
  bool _calling = false;
  bool _messagePositive = false;
  String _message = '';
  String _historyMessage = '';
  String _code = '';
  Map<String, dynamic>? _colis;
  List<Map<String, dynamic>> _historyEvents = [];
  ParcelStatusAction? _selectedAction;
  ParcelStatusAction? _currentAction;

  // ── initState / dispose (original) ───────────────────────
  @override
  void initState() {
    super.initState();
    _colis = widget.initialData;
    _code = _extractScanCode(
      widget.initialCode ??
          _colis?['barcode_value']?.toString() ??
          _colis?['numero_suivi']?.toString(),
    );
    if (_colis != null) _currentAction = _currentActionFromData(_colis!);
    Future.microtask(_loadCurrentState);
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  // ── Logic (original — untouched) ─────────────────────────
  String _extractScanCode(String? rawValue) {
    return extractParcelCode(rawValue);
  }

  String? _apiAction(ParcelStatusAction? action) {
    switch (action) {
      case ParcelStatusAction.inTransit:
        return 'in_transit';
      case ParcelStatusAction.delivered:
        return 'delivered';
      case ParcelStatusAction.rescheduled:
        return 'not_delivered';
      case ParcelStatusAction.returnPending:
        return 'return_pending';
      case null:
        return null;
    }
  }

  String _actionLabel(ParcelStatusAction? action) {
    switch (action) {
      case ParcelStatusAction.inTransit:
        return 'En transit';
      case ParcelStatusAction.delivered:
        return 'Livré';
      case ParcelStatusAction.rescheduled:
        return 'À relivrer';
      case ParcelStatusAction.returnPending:
        return 'Retour expéditeur';
      case null:
        return '';
    }
  }

  IconData _actionIcon(ParcelStatusAction action) {
    switch (action) {
      case ParcelStatusAction.inTransit:
        return Icons.local_shipping_outlined;
      case ParcelStatusAction.delivered:
        return Icons.task_alt_rounded;
      case ParcelStatusAction.rescheduled:
        return Icons.event_repeat_rounded;
      case ParcelStatusAction.returnPending:
        return Icons.assignment_return_rounded;
    }
  }

  Color _actionColor(ParcelStatusAction action) {
    switch (action) {
      case ParcelStatusAction.inTransit:
        return _kAmber;
      case ParcelStatusAction.delivered:
        return const Color(0xFF22C55E);
      case ParcelStatusAction.rescheduled:
        return const Color(0xFF6366F1);
      case ParcelStatusAction.returnPending:
        return const Color(0xFFEF4444);
    }
  }

  ParcelStatusAction? _currentActionFromData(Map<String, dynamic> data) {
    final statut = (data['statut']?.toString() ?? '').toLowerCase();
    final stage = (data['tracking_stage']?.toString() ?? '').toLowerCase();
    final deliveredAt = data['delivered_at']?.toString() ?? '';
    final returnedAt = data['returned_at']?.toString() ?? '';
    final issueAt = data['last_delivery_issue_at']?.toString() ?? '';

    if (returnedAt.isNotEmpty ||
        statut.contains('retour') ||
        stage == 'return_pending' ||
        stage == 'returned')
      return ParcelStatusAction.returnPending;
    if (statut.contains('relivr') ||
        (issueAt.isNotEmpty && stage == 'at_warehouse'))
      return ParcelStatusAction.rescheduled;
    if (deliveredAt.isNotEmpty ||
        statut.contains('livr') ||
        stage == 'delivered')
      return ParcelStatusAction.delivered;
    if (statut.contains('transit') || stage == 'out_for_delivery')
      return ParcelStatusAction.inTransit;
    return null;
  }

  String _currentStateFromData(Map<String, dynamic> data) {
    final action = _currentActionFromData(data);
    final label = _actionLabel(action);
    return label.isNotEmpty
        ? label
        : _stageLabel(data['tracking_stage']?.toString());
  }

  bool get _isTerminalState {
    final data = _colis;
    if (data == null) return false;
    final stage = (data['tracking_stage']?.toString() ?? '').toLowerCase();
    final deliveredAt = data['delivered_at']?.toString() ?? '';
    final returnedAt = data['returned_at']?.toString() ?? '';
    return deliveredAt.isNotEmpty ||
        returnedAt.isNotEmpty ||
        stage == 'delivered' ||
        stage == 'returned';
  }

  bool get _isReturnLocked {
    final data = _colis;
    if (data == null) return false;
    final statut = (data['statut']?.toString() ?? '').toLowerCase();
    final stage = (data['tracking_stage']?.toString() ?? '').toLowerCase();
    return statut.contains('retour') || stage == 'return_pending';
  }

  bool get _isHistoryOnlyView {
    final initialStatus =
        (widget.initialData?['history_status']?.toString() ?? '').trim();
    if (initialStatus.isNotEmpty) return true;

    final data = _colis;
    if (data == null) return false;

    final statut = (data['statut']?.toString() ?? '').toLowerCase();
    final stage = (data['tracking_stage']?.toString() ?? '').toLowerCase();
    final deliveredAt = data['delivered_at']?.toString() ?? '';
    final returnedAt = data['returned_at']?.toString() ?? '';
    final issueAt = data['last_delivery_issue_at']?.toString() ?? '';
    final issueCount =
        int.tryParse(data['delivery_issue_count']?.toString() ?? '0') ?? 0;

    return deliveredAt.isNotEmpty ||
        returnedAt.isNotEmpty ||
        issueAt.isNotEmpty ||
        stage == 'delivered' ||
        stage == 'returned' ||
        stage == 'return_pending' ||
        statut.contains('livr') ||
        statut.contains('retour') ||
        statut.contains('relivr') ||
        statut.contains('report') ||
        (stage == 'at_warehouse' && issueCount > 0);
  }

  bool _canChooseAction(ParcelStatusAction action) {
    if (_loading || _submitting || _code.isEmpty || _colis == null)
      return false;
    if (_isTerminalState || _isReturnLocked) return false;
    return action != _currentAction;
  }

  List<Map<String, dynamic>> _readEventList(Map<String, dynamic> response) {
    for (final key in ['data', 'history', 'items']) {
      final raw = response[key];
      if (raw is List) {
        return raw
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList();
      }
    }
    return [];
  }

  List<Map<String, dynamic>> _buildFallbackHistoryEvents() {
    final colis = _colis;
    if (colis == null) return [];

    final events = <Map<String, dynamic>>[];

    void addEvent({
      required String kind,
      required String title,
      required String note,
      String? date,
    }) {
      final value = (date ?? '').trim();
      if (value.isEmpty) return;
      events.add({
        'kind': kind,
        'title': title,
        'note': note,
        'date': value,
        'is_notification': false,
      });
    }

    addEvent(
      kind: 'picked_up',
      title: 'Colis pris en charge',
      note: 'Le colis a ete recupere chez l expediteur.',
      date: colis['picked_up_at']?.toString(),
    );
    addEvent(
      kind: 'warehouse_in',
      title: 'Colis depose au depot',
      note: 'Le colis est arrive au depot.',
      date: colis['warehouse_received_at']?.toString(),
    );
    addEvent(
      kind: 'warehouse_out',
      title: 'Colis sorti du depot',
      note: 'Le colis a quitte le depot pour la livraison.',
      date: colis['out_for_delivery_at']?.toString(),
    );
    addEvent(
      kind: 'delivery_issue',
      title: 'Livraison reportee',
      note:
          colis['last_delivery_issue_reason']?.toString().trim().isNotEmpty ==
              true
          ? 'Motif: ${colis['last_delivery_issue_reason']}'
          : 'La livraison a ete reportee.',
      date: colis['last_delivery_issue_at']?.toString(),
    );
    addEvent(
      kind: 'return_pending',
      title: 'Retour expediteur a confirmer',
      note: 'Le colis attend son retour expediteur.',
      date:
          (colis['tracking_stage']?.toString() ?? '').toLowerCase() ==
              'return_pending'
          ? colis['last_delivery_issue_at']?.toString() ??
                colis['out_for_delivery_at']?.toString()
          : null,
    );
    addEvent(
      kind: 'delivered',
      title: 'Colis arrive a destination',
      note: 'La livraison a ete confirmee.',
      date: colis['delivered_at']?.toString(),
    );
    addEvent(
      kind: 'returned',
      title: 'Colis retourne a l expediteur',
      note: 'Le colis a ete remis a l expediteur.',
      date: colis['returned_at']?.toString(),
    );

    events.sort((a, b) {
      final left = DateTime.tryParse(a['date']?.toString() ?? '');
      final right = DateTime.tryParse(b['date']?.toString() ?? '');
      if (left == null && right == null) return 0;
      if (left == null) return -1;
      if (right == null) return 1;
      return left.compareTo(right);
    });

    return events;
  }

  Future<void> _loadHistoryForCurrentColis() async {
    final colisId = _currentColisId();
    if (colisId == null) {
      if (!mounted) return;
      setState(() {
        _historyLoading = false;
        _historyEvents = [];
        _historyMessage = '';
      });
      return;
    }

    setState(() {
      _historyLoading = true;
      _historyMessage = '';
    });

    try {
      final data = await Api.getJson(
        '/courier/colis/$colisId/history',
        withAuth: true,
      );
      final items = _readEventList(data);
      if (!mounted) return;
      setState(() {
        _historyEvents = items.isNotEmpty
            ? items
            : _buildFallbackHistoryEvents();
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      if (await _redirectIfAuthError(e)) return;
      setState(() {
        _historyEvents = _buildFallbackHistoryEvents();
        _historyMessage = e.statusCode == 404 ? '' : e.message;
      });
    } finally {
      if (mounted) setState(() => _historyLoading = false);
    }
  }

  Future<void> _loadCurrentState() async {
    if (_code.isEmpty) {
      setState(() {
        _loading = false;
        _messagePositive = false;
        _message = 'Aucun code colis à ouvrir.';
        _historyEvents = [];
        _historyMessage = '';
      });
      return;
    }
    setState(() {
      _loading = true;
      _messagePositive = false;
      _message = '';
    });
    try {
      final data = await Api.postJson(
        '/courier/colis/scan/inspect',
        body: {'barcode_value': _code},
        withAuth: true,
      );
      if (!mounted) return;
      setState(() {
        _colis = data;
        _currentAction = _currentActionFromData(data);
        _selectedAction = null;
        _messagePositive = false;
        _message = '';
      });
      Future.microtask(_loadHistoryForCurrentColis);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (await _redirectIfAuthError(e)) return;
      setState(() {
        _message = e.message;
        _messagePositive = false;
        _historyEvents = [];
        _historyMessage = '';
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _selectAction(ParcelStatusAction action) {
    if (!_canChooseAction(action)) {
      setState(() {
        _message = action == _currentAction
            ? 'Ce colis est déjà : ${_actionLabel(action)}.'
            : 'Ce colis ne peut plus changer de statut depuis cette interface.';
        _messagePositive = false;
      });
      return;
    }
    setState(() {
      _selectedAction = action;
      _messagePositive = false;
      _message = '';
      if (action != ParcelStatusAction.rescheduled &&
          action != ParcelStatusAction.returnPending)
        _reasonController.clear();
    });
  }

  Future<void> _submitAction() async {
    final action = _apiAction(_selectedAction);
    if (_code.isEmpty || action == null || _submitting || _loading) return;
    if (_selectedAction == _currentAction) {
      setState(() {
        _message = 'Ce colis est déjà : ${_actionLabel(_selectedAction)}.';
        _messagePositive = false;
      });
      return;
    }
    final reason = _reasonController.text.trim();
    if ((_selectedAction == ParcelStatusAction.rescheduled ||
            _selectedAction == ParcelStatusAction.returnPending) &&
        reason.length < 3) {
      setState(() {
        _message = 'Le motif doit contenir au moins 3 caractères.';
        _messagePositive = false;
      });
      return;
    }
    setState(() {
      _submitting = true;
      _messagePositive = false;
      _message = '';
    });
    try {
      final body = <String, dynamic>{'barcode_value': _code, 'action': action};
      if (_selectedAction == ParcelStatusAction.rescheduled ||
          _selectedAction == ParcelStatusAction.returnPending)
        body['reason'] = reason;
      final data = await Api.postJson(
        '/courier/colis/scan/action',
        body: body,
        withAuth: true,
      );
      if (!mounted) return;
      setState(() {
        _colis = data;
        _currentAction = _currentActionFromData(data);
        _selectedAction = null;
        _reasonController.clear();
        _message = data['detail']?.toString() ?? 'Statut mis à jour.';
        _messagePositive = true;
      });
      Future.microtask(_loadHistoryForCurrentColis);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (await _redirectIfAuthError(e)) return;
      setState(() {
        _message = e.message;
        _messagePositive = false;
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  int? _currentColisId() {
    final value = _colis?['id'];
    if (value is int) return value;
    return int.tryParse(value?.toString() ?? '');
  }

  String _recipientPhoneFromData(Map<String, dynamic>? data) {
    return data?['telephone_destinataire']?.toString().trim() ?? '';
  }

  String _dialablePhone(String value) {
    final raw = value.trim();
    final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return '';
    if (raw.startsWith('+')) return '+$digits';
    if (digits.startsWith('00') && digits.length > 2) {
      return '+${digits.substring(2)}';
    }
    return digits;
  }

  Future<void> _callRecipient() async {
    if (_calling) return;

    final colisId = _currentColisId();
    final phone = _recipientPhoneFromData(_colis);
    final dialablePhone = _dialablePhone(phone);

    if (colisId == null) {
      setState(() {
        _message = 'La fiche colis doit etre chargee avant l appel.';
        _messagePositive = false;
      });
      return;
    }

    if (dialablePhone.length < 6) {
      setState(() {
        _message = 'Numero destinataire indisponible ou invalide.';
        _messagePositive = false;
      });
      return;
    }

    setState(() {
      _calling = true;
      _message = '';
      _messagePositive = false;
    });

    try {
      final launched = await launchUrl(
        Uri.parse('tel:$dialablePhone'),
        mode: LaunchMode.externalApplication,
      );

      if (!launched) {
        if (!mounted) return;
        setState(() {
          _message = 'Impossible d ouvrir l application telephone.';
          _messagePositive = false;
        });
        return;
      }

      final log = await Api.postJson(
        '/courier/colis/$colisId/call',
        body: {},
        withAuth: true,
      );

      if (!mounted) return;
      setState(() {
        _message =
            log['detail']?.toString() ??
            'Appel destinataire enregistre dans l historique.';
        _messagePositive = true;
      });
      Future.microtask(_loadHistoryForCurrentColis);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (await _redirectIfAuthError(e)) return;
      setState(() {
        _message =
            'Appel ouvert, mais l historique n a pas pu etre mis a jour: ${e.message}';
        _messagePositive = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _message = 'Impossible d ouvrir l application telephone.';
        _messagePositive = false;
      });
    } finally {
      if (mounted) setState(() => _calling = false);
    }
  }

  Future<bool> _redirectIfAuthError(ApiException error) async {
    if (error.statusCode != 401 && error.statusCode != 403) return false;
    await Storage.clearToken();
    if (!mounted) return true;
    Navigator.pushNamedAndRemoveUntil(
      context,
      '/login',
      (_) => false,
      arguments: error.message,
    );
    return true;
  }

  String _statusLabel(String? status) {
    final raw = (status ?? '').toLowerCase();
    if (raw.contains('relivr') || raw.contains('report')) return 'À relivrer';
    if (raw.contains('transit')) return 'En transit';
    if (raw.contains('livr')) return 'Livré';
    if (raw.contains('retour')) return 'Retour';
    if (raw.contains('annul')) return 'Annulé';
    return 'En attente';
  }

  String _stageLabel(String? stage) {
    final raw = (stage ?? '').toLowerCase();
    if (raw == 'return_pending') return 'Dépôt retour expéditeur';
    if (raw == 'returned') return 'Retour expéditeur confirmé';
    if (raw.contains('return')) return 'Retour expéditeur';
    if (raw == 'picked_up' || raw.contains('picked'))
      return 'Récupéré chez expéditeur';
    if (raw == 'out_for_delivery' ||
        (raw.contains('out') && raw.contains('delivery')))
      return 'En transit';
    if (raw == 'at_warehouse' || raw.contains('warehouse')) return 'Au dépôt';
    if (raw == 'delivered' || raw.contains('deliver'))
      return 'Arrivé à destination';
    return 'En attente';
  }

  String _formatDateTime(String? value) {
    if (value == null || value.trim().isEmpty) return '-';
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return value;
    final local = parsed.toLocal();
    String dd(int n) => n.toString().padLeft(2, '0');
    return '${dd(local.day)}/${dd(local.month)}/${local.year} ${dd(local.hour)}:${dd(local.minute)}';
  }

  String _historyEventKind(Map<String, dynamic> event) {
    return (event['kind']?.toString() ?? '').trim().toLowerCase();
  }

  String _historyEventTitle(Map<String, dynamic> event) {
    final title = event['title']?.toString().trim() ?? '';
    if (title.isNotEmpty) return title;

    switch (_historyEventKind(event)) {
      case 'picked_up':
        return 'Colis pris en charge';
      case 'approved':
        return 'Colis valide';
      case 'rejected':
        return 'Colis refuse';
      case 'warehouse_in':
        return 'Colis depose au depot';
      case 'warehouse_out':
        return 'Colis sorti du depot';
      case 'courier_call':
        return 'Appel destinataire';
      case 'delivery_issue':
      case 'rescheduled':
        return 'Livraison reportee';
      case 'return_pending':
        return 'Retour expediteur a confirmer';
      case 'returned':
        return 'Colis retourne a l expediteur';
      case 'delivered':
        return 'Colis livre';
      case 'pending':
        return 'Colis en attente';
      case 'cancelled':
        return 'Colis annule';
      default:
        return 'Evenement colis';
    }
  }

  String _historyEventNote(Map<String, dynamic> event) {
    final note = event['note']?.toString().trim() ?? '';
    if (note.isNotEmpty) return note;

    switch (_historyEventKind(event)) {
      case 'picked_up':
        return 'Le colis a ete recupere chez l expediteur.';
      case 'warehouse_in':
        return 'Le colis est arrive au depot.';
      case 'warehouse_out':
        return 'Le colis est reparti pour la livraison.';
      case 'delivered':
        return 'La livraison a ete confirmee.';
      case 'courier_call':
        return 'Le livreur a tente de joindre le destinataire.';
      case 'delivery_issue':
      case 'rescheduled':
        return 'La livraison sera relancee plus tard.';
      case 'return_pending':
        return 'Le colis attend son retour expediteur.';
      case 'returned':
        return 'Le colis a ete remis a l expediteur.';
      default:
        return '';
    }
  }

  String _historyEventDate(Map<String, dynamic> event) {
    return event['date']?.toString() ??
        event['event_date']?.toString() ??
        event['created_at']?.toString() ??
        '';
  }

  Color _historyEventColor(Map<String, dynamic> event) {
    switch (_historyEventKind(event)) {
      case 'picked_up':
        return _kAmber;
      case 'approved':
      case 'delivered':
      case 'courier_call':
        return const Color(0xFF22C55E);
      case 'returned':
      case 'return_pending':
      case 'rejected':
      case 'cancelled':
        return const Color(0xFFEF4444);
      case 'delivery_issue':
      case 'rescheduled':
        return const Color(0xFF6366F1);
      case 'warehouse_in':
      case 'warehouse_out':
        return _kAmber;
      default:
        return _kGrey;
    }
  }

  IconData _historyEventIcon(Map<String, dynamic> event) {
    switch (_historyEventKind(event)) {
      case 'picked_up':
        return Icons.qr_code_scanner_rounded;
      case 'approved':
        return Icons.verified_rounded;
      case 'rejected':
      case 'cancelled':
        return Icons.block_rounded;
      case 'warehouse_in':
        return Icons.inventory_2_outlined;
      case 'warehouse_out':
        return Icons.local_shipping_outlined;
      case 'delivered':
        return Icons.task_alt_rounded;
      case 'courier_call':
        return Icons.call_rounded;
      case 'delivery_issue':
      case 'rescheduled':
        return Icons.event_repeat_rounded;
      case 'return_pending':
      case 'returned':
        return Icons.assignment_return_rounded;
      case 'pending':
        return Icons.hourglass_bottom_rounded;
      default:
        return Icons.history_rounded;
    }
  }

  String _historyEmptyMessage() {
    if (_historyMessage.trim().isNotEmpty) return _historyMessage.trim();
    if (_currentColisId() == null) {
      return 'L historique sera disponible apres le chargement complet de la fiche.';
    }
    return 'Aucun evenement n a encore ete enregistre pour ce colis.';
  }

  List<_DetailLine> _detailLines(Map<String, dynamic> colis) => [
    _DetailLine('Destinataire', colis['nom_destinataire']?.toString() ?? '-'),
    _DetailLine(
      'Téléphone',
      colis['telephone_destinataire']?.toString() ?? '-',
    ),
    _DetailLine('Adresse', colis['adresse_livraison']?.toString() ?? '-'),
    _DetailLine('Code QR', colis['barcode_value']?.toString() ?? _code),
    _DetailLine('Statut', _statusLabel(colis['statut']?.toString())),
    _DetailLine('Étape', _stageLabel(colis['tracking_stage']?.toString())),
    if ((colis['tournee_nom']?.toString() ?? '').isNotEmpty)
      _DetailLine('Tournée', colis['tournee_nom'].toString()),
    if ((colis['ordre']?.toString() ?? '').isNotEmpty)
      _DetailLine('Ordre', colis['ordre'].toString()),
    if ((colis['poids']?.toString() ?? '').isNotEmpty)
      _DetailLine('Poids', '${colis["poids"]} kg'),
    _DetailLine('Tentatives', colis['delivery_issue_count']?.toString() ?? '0'),
    if ((colis['last_delivery_issue_reason']?.toString() ?? '').isNotEmpty)
      _DetailLine(
        'Dernier motif',
        colis['last_delivery_issue_reason'].toString(),
      ),
    if ((colis['out_for_delivery_at']?.toString() ?? '').isNotEmpty)
      _DetailLine(
        'En transit le',
        _formatDateTime(colis['out_for_delivery_at']?.toString()),
      ),
    if ((colis['delivered_at']?.toString() ?? '').isNotEmpty)
      _DetailLine(
        'Livré le',
        _formatDateTime(colis['delivered_at']?.toString()),
      ),
    if ((colis['returned_at']?.toString() ?? '').isNotEmpty)
      _DetailLine(
        'Retour le',
        _formatDateTime(colis['returned_at']?.toString()),
      ),
  ];

  // ── Status color ──────────────────────────────────────────
  Color _currentStatusColor() {
    switch (_currentAction) {
      case ParcelStatusAction.delivered:
        return const Color(0xFF22C55E);
      case ParcelStatusAction.returnPending:
        return const Color(0xFFEF4444);
      case ParcelStatusAction.rescheduled:
        return const Color(0xFF6366F1);
      case ParcelStatusAction.inTransit:
        return _kAmber;
      case null:
        return _kGrey;
    }
  }

  // ── Build ─────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colis = _colis;
    final historyOnlyView = _isHistoryOnlyView;
    final currentLabel = colis == null ? '' : _currentStateFromData(colis);
    final recipientPhone = _recipientPhoneFromData(colis);
    final canCallRecipient =
        recipientPhone.isNotEmpty &&
        _currentColisId() != null &&
        !_loading &&
        !_submitting;
    final needsReason =
        _selectedAction == ParcelStatusAction.rescheduled ||
        _selectedAction == ParcelStatusAction.returnPending;
    final canSubmit =
        _selectedAction != null &&
        !_loading &&
        !_submitting &&
        _canChooseAction(_selectedAction!);

    return Scaffold(
      backgroundColor: isDark
          ? const Color(0xFF080E1A)
          : const Color(0xFFF2F4F9),
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ───────────────────────────────────────
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(20, 18, 16, 24),
              decoration: BoxDecoration(
                color: _kNavy,
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(28),
                  bottomRight: Radius.circular(28),
                ),
                boxShadow: [
                  BoxShadow(
                    color: _kNavy.withOpacity(0.30),
                    blurRadius: 22,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                children: [
                  // Top nav row
                  Row(
                    children: [
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(
                          Icons.arrow_back_ios_new_rounded,
                          color: Colors.white,
                          size: 20,
                        ),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(
                          minWidth: 36,
                          minHeight: 36,
                        ),
                      ),
                      const Expanded(
                        child: Text(
                          'Statut colis',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      const ThemeIconButton(),
                      const SizedBox(width: 6),
                      _NavIconBtn(
                        icon: Icons.refresh_rounded,
                        onTap: _loading || _submitting
                            ? null
                            : _loadCurrentState,
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  // Colis identity
                  Row(
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: _kAmber.withOpacity(0.18),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: _kAmber.withOpacity(0.35)),
                        ),
                        child: const Icon(
                          Icons.inventory_2_outlined,
                          color: _kAmber,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              colis?['numero_suivi']?.toString() ?? _code,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 17,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.2,
                              ),
                            ),
                            const SizedBox(height: 6),
                            if (currentLabel.isNotEmpty)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 5,
                                ),
                                decoration: BoxDecoration(
                                  color: _currentStatusColor().withOpacity(
                                    0.15,
                                  ),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: _currentStatusColor().withOpacity(
                                      0.4,
                                    ),
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: BoxDecoration(
                                        color: _currentStatusColor(),
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 5),
                                    Text(
                                      'État actuel : $currentLabel',
                                      style: TextStyle(
                                        color: _currentStatusColor(),
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ],
                                ),
                              )
                            else
                              Text(
                                'Chargement…',
                                style: TextStyle(
                                  color: Colors.white.withOpacity(0.5),
                                  fontSize: 12,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // ── Body ─────────────────────────────────────────
            Expanded(
              child: _loading && colis == null
                  ? const Center(
                      child: CircularProgressIndicator(color: _kAmber),
                    )
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(18, 20, 18, 28),
                      children: [
                        // ── Message banner ────────────────────
                        if (_message.isNotEmpty) ...[
                          _MsgBanner(
                            message: _message,
                            isSuccess: _messagePositive,
                          ),
                          const SizedBox(height: 14),
                        ],

                        // ── Détails card ──────────────────────
                        if (!historyOnlyView && colis != null) ...[
                          _SectionCard(
                            isDark: isDark,
                            title: 'Détails du colis',
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                ..._detailLines(colis).map(
                                  (line) => _MzDetailRow(
                                    label: line.label,
                                    value: line.value,
                                    isDark: isDark,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                _RecipientCallButton(
                                  isDark: isDark,
                                  phone: recipientPhone,
                                  calling: _calling,
                                  enabled: canCallRecipient,
                                  onPressed: _callRecipient,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        _SectionCard(
                          isDark: isDark,
                          title: 'Historique du colis',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (_historyLoading) ...[
                                const _HistoryInlineLoader(),
                                const SizedBox(height: 12),
                              ],
                              if (_historyMessage.isNotEmpty &&
                                  _historyEvents.isNotEmpty) ...[
                                _MsgBanner(
                                  message: _historyMessage,
                                  isSuccess: false,
                                ),
                                const SizedBox(height: 12),
                              ],
                              if (_historyEvents.isEmpty)
                                _HistoryEmptyState(
                                  isDark: isDark,
                                  message: _historyEmptyMessage(),
                                )
                              else
                                ...List.generate(_historyEvents.length, (
                                  index,
                                ) {
                                  final event = _historyEvents[index];
                                  return _HistoryEventTile(
                                    isDark: isDark,
                                    title: _historyEventTitle(event),
                                    note: _historyEventNote(event),
                                    date: _formatDateTime(
                                      _historyEventDate(event),
                                    ),
                                    icon: _historyEventIcon(event),
                                    color: _historyEventColor(event),
                                    isNotification:
                                        event['is_notification'] == true,
                                    isLast: index == _historyEvents.length - 1,
                                  );
                                }),
                            ],
                          ),
                        ),
                        if (!historyOnlyView) const SizedBox(height: 16),

                        // ── Changer statut card ───────────────
                        if (!historyOnlyView)
                          _SectionCard(
                            isDark: isDark,
                            title: 'Changer le statut',
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _isTerminalState
                                      ? 'Ce colis est terminé, aucune nouvelle action n\'est disponible.'
                                      : _isReturnLocked
                                      ? 'Ce colis est déjà dans le flux retour expéditeur.'
                                      : 'Choisis une action différente de l\'état actuel.',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: isDark ? Colors.white54 : _kGrey,
                                  ),
                                ),
                                const SizedBox(height: 16),

                                // Action buttons grid
                                GridView.count(
                                  crossAxisCount: 2,
                                  shrinkWrap: true,
                                  physics: const NeverScrollableScrollPhysics(),
                                  crossAxisSpacing: 10,
                                  mainAxisSpacing: 10,
                                  childAspectRatio: 1.55,
                                  children: ParcelStatusAction.values.map((
                                    action,
                                  ) {
                                    final isSelected =
                                        _selectedAction == action;
                                    final isCurrent = _currentAction == action;
                                    final canChoose = _canChooseAction(action);
                                    final color = _actionColor(action);
                                    return GestureDetector(
                                      onTap: canChoose || isCurrent
                                          ? () => _selectAction(action)
                                          : null,
                                      child: AnimatedContainer(
                                        duration: const Duration(
                                          milliseconds: 180,
                                        ),
                                        decoration: BoxDecoration(
                                          color: isSelected
                                              ? color.withOpacity(0.1)
                                              : isDark
                                              ? Colors.white.withOpacity(0.03)
                                              : const Color(0xFFF6F8FD),
                                          borderRadius: BorderRadius.circular(
                                            14,
                                          ),
                                          border: Border.all(
                                            color: isSelected
                                                ? color.withOpacity(0.5)
                                                : isCurrent
                                                ? _kAmber.withOpacity(0.4)
                                                : isDark
                                                ? Colors.white.withOpacity(0.08)
                                                : const Color(0xFFE4E9F4),
                                            width: isSelected ? 1.8 : 0.8,
                                          ),
                                        ),
                                        child: Column(
                                          mainAxisAlignment:
                                              MainAxisAlignment.center,
                                          children: [
                                            Container(
                                              width: 34,
                                              height: 34,
                                              decoration: BoxDecoration(
                                                color: color.withOpacity(
                                                  canChoose || isCurrent
                                                      ? 0.12
                                                      : 0.05,
                                                ),
                                                borderRadius:
                                                    BorderRadius.circular(10),
                                              ),
                                              child: Icon(
                                                _actionIcon(action),
                                                size: 17,
                                                color: color.withOpacity(
                                                  canChoose || isCurrent
                                                      ? 1.0
                                                      : 0.35,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(height: 6),
                                            Text(
                                              _actionLabel(action),
                                              style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w800,
                                                color: (canChoose || isCurrent)
                                                    ? (isDark
                                                          ? Colors.white
                                                          : _kNavy)
                                                    : _kGrey.withOpacity(0.5),
                                              ),
                                              textAlign: TextAlign.center,
                                            ),
                                            if (isCurrent) ...[
                                              const SizedBox(height: 4),
                                              Container(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      horizontal: 7,
                                                      vertical: 2,
                                                    ),
                                                decoration: BoxDecoration(
                                                  color: _kAmber.withOpacity(
                                                    0.12,
                                                  ),
                                                  borderRadius:
                                                      BorderRadius.circular(8),
                                                ),
                                                child: const Text(
                                                  'État actuel',
                                                  style: TextStyle(
                                                    color: _kAmber,
                                                    fontSize: 9,
                                                    fontWeight: FontWeight.w800,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                    );
                                  }).toList(),
                                ),

                                // Motif field
                                if (needsReason) ...[
                                  const SizedBox(height: 14),
                                  TextFormField(
                                    controller: _reasonController,
                                    maxLines: 4,
                                    style: TextStyle(
                                      color: isDark ? Colors.white : _kNavy,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                    ),
                                    decoration: InputDecoration(
                                      labelText:
                                          _selectedAction ==
                                              ParcelStatusAction.rescheduled
                                          ? 'Motif à relivrer'
                                          : 'Motif retour expéditeur',
                                      hintText:
                                          _selectedAction ==
                                              ParcelStatusAction.rescheduled
                                          ? 'Ex : client absent, adresse fermée, appel sans réponse…'
                                          : 'Ex : colis refusé, retour demandé par l\'expéditeur…',
                                      prefixIcon: const Icon(
                                        Icons.edit_note_rounded,
                                        color: _kAmber,
                                        size: 20,
                                      ),
                                      labelStyle: TextStyle(
                                        color: isDark ? Colors.white54 : _kGrey,
                                        fontWeight: FontWeight.w600,
                                      ),
                                      filled: true,
                                      fillColor: isDark
                                          ? Colors.white.withOpacity(0.04)
                                          : const Color(0xFFF6F8FD),
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                            horizontal: 16,
                                            vertical: 14,
                                          ),
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
                                        borderSide: const BorderSide(
                                          color: _kAmber,
                                          width: 1.8,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],

                                const SizedBox(height: 16),

                                // Submit button
                                SizedBox(
                                  width: double.infinity,
                                  height: 52,
                                  child: ElevatedButton.icon(
                                    onPressed: canSubmit ? _submitAction : null,
                                    icon: _submitting
                                        ? const SizedBox(
                                            width: 18,
                                            height: 18,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.white,
                                            ),
                                          )
                                        : const Icon(
                                            Icons.save_rounded,
                                            size: 18,
                                          ),
                                    label: Text(
                                      _submitting
                                          ? 'Enregistrement…'
                                          : _selectedAction == null
                                          ? 'Sélectionner une action'
                                          : 'Enregistrer : ${_actionLabel(_selectedAction)}',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 15,
                                      ),
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: _kNavy,
                                      foregroundColor: Colors.white,
                                      disabledBackgroundColor: _kNavy
                                          .withOpacity(0.35),
                                      elevation: 0,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(14),
                                      ),
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
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
//  WIDGETS
// ══════════════════════════════════════════════════════════════

class _NavIconBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  const _NavIconBtn({required this.icon, this.onTap});
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(onTap == null ? 0.05 : 0.1),
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: Colors.white24),
        ),
        child: Icon(
          icon,
          color: Colors.white.withOpacity(onTap == null ? 0.3 : 1.0),
          size: 20,
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final bool isDark;
  final String title;
  final Widget child;
  const _SectionCard({
    required this.isDark,
    required this.title,
    required this.child,
  });
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark
              ? Colors.white.withOpacity(0.07)
              : const Color(0xFFE4E9F4),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1A2B4A).withOpacity(isDark ? 0.18 : 0.05),
            blurRadius: 16,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 4,
                height: 18,
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                title,
                style: TextStyle(
                  color: isDark ? Colors.white : const Color(0xFF1A2B4A),
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

class _MzDetailRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isDark;
  const _MzDetailRow({
    required this.label,
    required this.value,
    required this.isDark,
  });
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 112,
                child: Text(
                  label,
                  style: const TextStyle(
                    color: _kGrey,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  value,
                  style: TextStyle(
                    color: isDark ? Colors.white : _kNavy,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Divider(
            height: 0,
            thickness: 0.5,
            color: isDark
                ? Colors.white.withOpacity(0.06)
                : const Color(0xFFE4E9F4),
          ),
        ],
      ),
    );
  }
}

class _RecipientCallButton extends StatelessWidget {
  final bool isDark;
  final String phone;
  final bool calling;
  final bool enabled;
  final VoidCallback onPressed;

  const _RecipientCallButton({
    required this.isDark,
    required this.phone,
    required this.calling,
    required this.enabled,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final hasPhone = phone.trim().isNotEmpty;
    final accent = hasPhone ? const Color(0xFF22C55E) : _kGrey;
    final foreground = enabled ? Colors.white : accent.withValues(alpha: 0.55);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.04)
            : const Color(0xFFF6F8FD),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: hasPhone
              ? accent.withValues(alpha: isDark ? 0.34 : 0.24)
              : (isDark ? Colors.white10 : const Color(0xFFE4E9F4)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: hasPhone ? 0.14 : 0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  hasPhone ? Icons.call_rounded : Icons.phone_disabled_rounded,
                  color: accent,
                  size: 19,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Appeler le destinataire',
                      style: TextStyle(
                        color: isDark ? Colors.white : _kNavy,
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      hasPhone
                          ? phone
                          : 'Aucun numero destinataire sur cette fiche.',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isDark ? Colors.white54 : _kGrey,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 48,
            child: ElevatedButton.icon(
              onPressed: enabled && !calling ? onPressed : null,
              icon: calling
                  ? const SizedBox(
                      width: 17,
                      height: 17,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.call_rounded, size: 18),
              label: Text(
                calling
                    ? 'Ouverture...'
                    : hasPhone
                    ? 'Ouvrir l appel'
                    : 'Telephone indisponible',
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: foreground,
                disabledBackgroundColor: accent.withValues(alpha: 0.12),
                disabledForegroundColor: accent.withValues(alpha: 0.45),
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                textStyle: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 14,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MsgBanner extends StatelessWidget {
  final String message;
  final bool isSuccess;
  const _MsgBanner({required this.message, required this.isSuccess});
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final color = isSuccess ? const Color(0xFF22C55E) : const Color(0xFFEF4444);
    final icon = isSuccess
        ? Icons.check_circle_outline_rounded
        : Icons.error_outline_rounded;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: isDark ? Colors.white70 : _kNavy.withOpacity(0.75),
                fontWeight: FontWeight.w700,
                fontSize: 13,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HistoryInlineLoader extends StatelessWidget {
  const _HistoryInlineLoader();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withOpacity(0.04)
            : const Color(0xFFF6F8FD),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark
              ? Colors.white.withOpacity(0.08)
              : const Color(0xFFE4E9F4),
        ),
      ),
      child: const Row(
        children: [
          SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: _kAmber),
          ),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Chargement de l historique...',
              style: TextStyle(
                color: _kGrey,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HistoryEmptyState extends StatelessWidget {
  const _HistoryEmptyState({required this.isDark, required this.message});

  final bool isDark;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withOpacity(0.03)
            : const Color(0xFFF6F8FD),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark
              ? Colors.white.withOpacity(0.06)
              : const Color(0xFFE4E9F4),
        ),
      ),
      child: Column(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: _kAmber.withOpacity(0.10),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.history_rounded, color: _kAmber, size: 22),
          ),
          const SizedBox(height: 10),
          Text(
            'Historique indisponible',
            style: TextStyle(
              color: isDark ? Colors.white : _kNavy,
              fontSize: 13,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isDark ? Colors.white60 : _kGrey,
              fontSize: 12,
              height: 1.45,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _HistoryEventTile extends StatelessWidget {
  const _HistoryEventTile({
    required this.isDark,
    required this.title,
    required this.note,
    required this.date,
    required this.icon,
    required this.color,
    required this.isNotification,
    required this.isLast,
  });

  final bool isDark;
  final String title;
  final String note;
  final String date;
  final IconData icon;
  final Color color;
  final bool isNotification;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 42,
          child: Column(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.12),
                  shape: BoxShape.circle,
                  border: Border.all(color: color.withOpacity(0.24)),
                ),
                child: Icon(icon, color: color, size: 18),
              ),
              if (!isLast)
                Container(
                  width: 2,
                  height: 56,
                  margin: const EdgeInsets.symmetric(vertical: 4),
                  decoration: BoxDecoration(
                    color: isDark
                        ? Colors.white.withOpacity(0.08)
                        : const Color(0xFFE4E9F4),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Container(
            margin: EdgeInsets.only(bottom: isLast ? 0 : 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark
                  ? Colors.white.withOpacity(0.03)
                  : const Color(0xFFF6F8FD),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isDark
                    ? Colors.white.withOpacity(0.06)
                    : const Color(0xFFE4E9F4),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: TextStyle(
                          color: isDark ? Colors.white : _kNavy,
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    if (isNotification)
                      Container(
                        margin: const EdgeInsets.only(left: 8),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: color.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          'Notif',
                          style: TextStyle(
                            color: color,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  date,
                  style: TextStyle(
                    color: isDark ? Colors.white54 : _kGrey,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (note.trim().isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    note,
                    style: TextStyle(
                      color: isDark ? Colors.white70 : _kNavy.withOpacity(0.78),
                      fontSize: 12,
                      height: 1.45,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _DetailLine {
  const _DetailLine(this.label, this.value);
  final String label;
  final String value;
}
