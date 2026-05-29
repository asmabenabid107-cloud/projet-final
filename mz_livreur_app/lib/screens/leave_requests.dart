// lib/screens/leave_requests.dart
// ✅ Design MZ Logistic — Navy + Amber
// ✅ Logique originale 100% conservée

import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/storage.dart';
import '../widgets/global_theme_toggle.dart';

const _kNavy  = Color(0xFF1A2B4A);
const _kAmber = Color(0xFFF59E0B);

class LeaveRequestsScreen extends StatefulWidget {
  const LeaveRequestsScreen({super.key});
  @override
  State<LeaveRequestsScreen> createState() => _LeaveRequestsScreenState();
}

class _LeaveRequestsScreenState extends State<LeaveRequestsScreen> {
  bool loading = true;
  bool saving  = false;
  String msg   = '';
  List<Map<String, dynamic>> leaveRequests = [];
  DateTime? startDate;
  DateTime? endDate;
  final reasonController = TextEditingController();

  @override
  void initState() {
    super.initState();
    loadLeaves();
  }

  @override
  void dispose() {
    reasonController.dispose();
    super.dispose();
  }

  // ── Logic (original) ─────────────────────────────────────
  Future<void> loadLeaves() async {
    setState(() { loading = true; msg = ''; });
    try {
      final response = await Api.getJson('/courier/leaves', withAuth: true);
      final rawItems = response['data'] is List
          ? response['data'] as List
          : response['items'] is List
              ? response['items'] as List
              : <dynamic>[];
      setState(() {
        leaveRequests = rawItems
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      });
    } on ApiException catch (e) {
      if (e.statusCode == 401 || e.statusCode == 403) {
        await Storage.clearToken();
        if (!mounted) return;
        Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false,
            arguments: e.message);
        return;
      }
      setState(() => msg = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  DateTime? _parseDate(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    return DateTime.tryParse(raw);
  }

  String _formatDate(String? raw) {
    final p = _parseDate(raw);
    if (p == null) return (raw == null || raw.trim().isEmpty) ? 'Non définie' : raw;
    return '${p.day.toString().padLeft(2,'0')}/${p.month.toString().padLeft(2,'0')}/${p.year}';
  }

  String _formatPickerDate(DateTime? v) {
    if (v == null) return 'Choisir';
    return '${v.day.toString().padLeft(2,'0')}/${v.month.toString().padLeft(2,'0')}/${v.year}';
  }

  String _apiDate(DateTime v) =>
      '${v.year.toString().padLeft(4,'0')}-${v.month.toString().padLeft(2,'0')}-${v.day.toString().padLeft(2,'0')}';

  String _statusLabel(String s) {
    switch (s) {
      case 'approved': return 'Approuvée';
      case 'denied':   return 'Refusée';
      default:         return 'En attente';
    }
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'approved': return const Color(0xFF22C55E);
      case 'denied':   return const Color(0xFFEF4444);
      default:         return _kAmber;
    }
  }

  Map<String, dynamic>? get _pendingRequest {
    for (final item in leaveRequests) {
      if ((item['status']?.toString() ?? '') == 'pending') return item;
    }
    return null;
  }

  Map<String, dynamic>? get _approvedUpcomingOrCurrent {
    final today = DateTime.now();
    final ref   = DateTime(today.year, today.month, today.day);
    for (final item in leaveRequests) {
      if ((item['status']?.toString() ?? '') != 'approved') continue;
      final end = _parseDate(item['end_date']?.toString());
      if (end == null) continue;
      if (!DateTime(end.year, end.month, end.day).isBefore(ref)) return item;
    }
    return null;
  }

  Map<String, dynamic>? get _currentLeave {
    final today = DateTime.now();
    final ref   = DateTime(today.year, today.month, today.day);
    for (final item in leaveRequests) {
      if ((item['status']?.toString() ?? '') != 'approved') continue;
      final start = _parseDate(item['start_date']?.toString());
      final end   = _parseDate(item['end_date']?.toString());
      if (start == null || end == null) continue;
      final cs = DateTime(start.year, start.month, start.day);
      final ce = DateTime(end.year, end.month, end.day);
      if (!ref.isBefore(cs) && !ref.isAfter(ce)) return item;
    }
    return null;
  }

  bool get _canCreateRequest =>
      _pendingRequest == null && _approvedUpcomingOrCurrent == null;

  Future<void> _pickStartDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: startDate ?? now,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: DateTime(now.year + 2),
    );
    if (picked == null) return;
    setState(() {
      startDate = picked;
      if (endDate != null && endDate!.isBefore(picked)) endDate = picked;
    });
  }

  Future<void> _pickEndDate() async {
    final now   = DateTime.now();
    final first = startDate ?? DateTime(now.year, now.month, now.day);
    final picked = await showDatePicker(
      context: context,
      initialDate: endDate ?? first,
      firstDate: first,
      lastDate: DateTime(now.year + 2),
    );
    if (picked == null) return;
    setState(() => endDate = picked);
  }

  Future<void> submitRequest() async {
    if (!_canCreateRequest) {
      setState(() => msg = 'Une seule demande de congé peut être active à la fois.');
      return;
    }
    if (startDate == null || endDate == null) {
      setState(() => msg = 'Choisis les dates de début et de fin.');
      return;
    }
    if (endDate!.isBefore(startDate!)) {
      setState(() => msg = 'La date de fin doit être après la date de début.');
      return;
    }
    final reason = reasonController.text.trim();
    if (reason.isEmpty) {
      setState(() => msg = 'Écris le motif de ta demande de congé.');
      return;
    }
    setState(() { saving = true; msg = ''; });
    try {
      await Api.postJson('/courier/leaves', body: {
        'start_date':          _apiDate(startDate!),
        'end_date':            _apiDate(endDate!),
        'description_conge':   reason,
      });
      setState(() {
        startDate = null; endDate = null;
        reasonController.clear();
        msg = 'Demande de congé envoyée avec succès.';
      });
      await loadLeaves();
    } on ApiException catch (e) {
      if (e.statusCode == 401 || e.statusCode == 403) {
        await Storage.clearToken();
        if (!mounted) return;
        Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false,
            arguments: e.message);
        return;
      }
      setState(() => msg = e.message);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  // ── Build ─────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final isDark        = Theme.of(context).brightness == Brightness.dark;
    final currentLeave  = _currentLeave;
    final blocking      = _pendingRequest ?? _approvedUpcomingOrCurrent;
    final historyItems  = leaveRequests
        .where((item) => item['id'] != currentLeave?['id'])
        .toList();
    final isSuccess     = msg.contains('succès') || msg.contains('succes');

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080E1A) : const Color(0xFFF2F4F9),
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ───────────────────────────────────
            _PageHeader(
              isDark:   isDark,
              title:    'Mes congés',
              subtitle: 'Gérez vos demandes de congé',
              onRefresh: loadLeaves,
            ),

            Expanded(
              child: loading
                  ? const Center(
                      child: CircularProgressIndicator(color: _kAmber))
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(18, 0, 18, 28),
                      children: [
                        // Message
                        if (msg.isNotEmpty) ...[
                          _MsgBanner(message: msg, isSuccess: isSuccess),
                          const SizedBox(height: 14),
                        ],

                        // Congé actuel
                        if (currentLeave != null) ...[
                          _SectionTitle(label: 'Congé actuel'),
                          const SizedBox(height: 10),
                          _CurrentLeaveCard(
                            isDark: isDark,
                            item: currentLeave,
                            formatDate: _formatDate,
                          ),
                          const SizedBox(height: 20),
                        ],

                        // Nouvelle demande
                        _SectionTitle(label: 'Nouvelle demande'),
                        const SizedBox(height: 10),
                        _NewRequestCard(
                          isDark:         isDark,
                          canCreate:      _canCreateRequest,
                          blocking:       blocking,
                          startDate:      startDate,
                          endDate:        endDate,
                          saving:         saving,
                          reasonCtrl:     reasonController,
                          formatPicker:   _formatPickerDate,
                          onPickStart:    _pickStartDate,
                          onPickEnd:      _pickEndDate,
                          onSubmit:       submitRequest,
                        ),

                        const SizedBox(height: 20),

                        // Historique
                        _SectionTitle(label: 'Historique'),
                        const SizedBox(height: 10),
                        _HistorySection(
                          isDark:       isDark,
                          items:        historyItems,
                          formatDate:   _formatDate,
                          statusLabel:  _statusLabel,
                          statusColor:  _statusColor,
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

class _PageHeader extends StatelessWidget {
  final bool   isDark;
  final String title;
  final String subtitle;
  final VoidCallback onRefresh;
  const _PageHeader({
    required this.isDark, required this.title,
    required this.subtitle, required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 18, 16, 22),
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
      child: Row(children: [
        IconButton(
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: Colors.white, size: 20),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
        ),
        const SizedBox(width: 8),
        Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(
              color: Colors.white, fontSize: 20,
              fontWeight: FontWeight.w900, letterSpacing: -0.3,
            )),
            const SizedBox(height: 3),
            Text(subtitle, style: TextStyle(
              color: Colors.white.withOpacity(0.55),
              fontSize: 12, fontWeight: FontWeight.w500,
            )),
          ],
        )),
        const ThemeIconButton(),
        const SizedBox(width: 4),
        IconButton(
          onPressed: onRefresh,
          icon: const Icon(Icons.refresh_rounded, color: Colors.white70, size: 22),
        ),
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
      Container(width: 4, height: 18,
          decoration: BoxDecoration(color: _kAmber,
              borderRadius: BorderRadius.circular(4))),
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
        ? Icons.check_circle_outline_rounded
        : Icons.error_outline_rounded;
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

class _CurrentLeaveCard extends StatelessWidget {
  final bool   isDark;
  final Map<String, dynamic> item;
  final String Function(String?) formatDate;
  const _CurrentLeaveCard({
    required this.isDark, required this.item, required this.formatDate,
  });
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF22C55E).withOpacity(0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF22C55E).withOpacity(0.3)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 38, height: 38,
            decoration: BoxDecoration(
              color: const Color(0xFF22C55E).withOpacity(0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.event_available_rounded,
                color: Color(0xFF22C55E), size: 20),
          ),
          const SizedBox(width: 12),
          const Text('Congé en cours', style: TextStyle(
            color: Color(0xFF22C55E),
            fontWeight: FontWeight.w900, fontSize: 15,
          )),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: const Color(0xFF22C55E).withOpacity(0.12),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFF22C55E).withOpacity(0.35)),
            ),
            child: const Text('Approuvée', style: TextStyle(
              color: Color(0xFF22C55E), fontSize: 11, fontWeight: FontWeight.w800,
            )),
          ),
        ]),
        const SizedBox(height: 14),
        Text(
          'Du ${formatDate(item["start_date"]?.toString())} '
          'au ${formatDate(item["end_date"]?.toString())}',
          style: TextStyle(
            color: isDark ? Colors.white : _kNavy,
            fontSize: 15, fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Ton statut passe automatiquement en congé temporaire pendant cette période.',
          style: TextStyle(
            color: isDark ? Colors.white54 : const Color(0xFF6B7280),
            fontSize: 13, height: 1.55,
          ),
        ),
      ]),
    );
  }
}

class _NewRequestCard extends StatelessWidget {
  final bool     isDark;
  final bool     canCreate;
  final Map<String, dynamic>? blocking;
  final DateTime? startDate;
  final DateTime? endDate;
  final bool     saving;
  final TextEditingController reasonCtrl;
  final String Function(DateTime?) formatPicker;
  final VoidCallback onPickStart;
  final VoidCallback onPickEnd;
  final VoidCallback onSubmit;

  const _NewRequestCard({
    required this.isDark, required this.canCreate,
    required this.blocking, required this.startDate,
    required this.endDate, required this.saving,
    required this.reasonCtrl, required this.formatPicker,
    required this.onPickStart, required this.onPickEnd,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark ? Colors.white.withOpacity(0.07) : const Color(0xFFE4E9F4),
        ),
        boxShadow: [BoxShadow(
          color: _kNavy.withOpacity(isDark ? 0.18 : 0.05),
          blurRadius: 18, offset: const Offset(0, 5),
        )],
      ),
      child: canCreate
          ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Info note
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: _kAmber.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _kAmber.withOpacity(0.22)),
                ),
                child: Row(children: [
                  const Icon(Icons.info_outline_rounded, color: _kAmber, size: 16),
                  const SizedBox(width: 8),
                  Expanded(child: Text(
                    'Tu peux envoyer une seule demande de congé à la fois.',
                    style: TextStyle(
                      color: isDark ? Colors.white70 : _kNavy.withOpacity(0.72),
                      fontSize: 12, fontWeight: FontWeight.w500, height: 1.5,
                    ),
                  )),
                ]),
              ),
              const SizedBox(height: 16),

              // Date pickers
              Row(children: [
                Expanded(child: _DatePickerBtn(
                  isDark:  isDark,
                  icon:    Icons.calendar_today_outlined,
                  label:   'Date début',
                  value:   formatPicker(startDate),
                  onTap:   saving ? null : onPickStart,
                  selected: startDate != null,
                )),
                const SizedBox(width: 10),
                Expanded(child: _DatePickerBtn(
                  isDark:  isDark,
                  icon:    Icons.event_available_outlined,
                  label:   'Date fin',
                  value:   formatPicker(endDate),
                  onTap:   saving ? null : onPickEnd,
                  selected: endDate != null,
                )),
              ]),
              const SizedBox(height: 14),

              // Reason field
              TextFormField(
                controller: reasonCtrl,
                enabled:    !saving,
                maxLines:   4,
                style: TextStyle(
                  color: isDark ? Colors.white : _kNavy,
                  fontWeight: FontWeight.w500, fontSize: 14,
                ),
                decoration: InputDecoration(
                  labelText:  'Motif du congé',
                  hintText:   'Ex: maladie, urgence familiale...',
                  prefixIcon: const Icon(Icons.edit_note_rounded, color: _kAmber),
                  alignLabelWithHint: true,
                  labelStyle: TextStyle(
                    color: isDark ? Colors.white54 : const Color(0xFF6B7280),
                    fontWeight: FontWeight.w600,
                  ),
                  filled:    true,
                  fillColor: isDark
                      ? Colors.white.withOpacity(0.04)
                      : const Color(0xFFF6F8FD),
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
                ),
              ),
              const SizedBox(height: 16),

              // Submit button
              SizedBox(
                width: double.infinity, height: 52,
                child: ElevatedButton(
                  onPressed: saving ? null : onSubmit,
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
                            Text('Envoi...', style: TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 15)),
                          ])
                      : const Row(mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.send_rounded, size: 18),
                            SizedBox(width: 8),
                            Text('Envoyer la demande', style: TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 15)),
                          ]),
                ),
              ),
            ])
          : Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _kAmber.withOpacity(0.08),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _kAmber.withOpacity(0.3)),
              ),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Icon(Icons.warning_amber_rounded, color: _kAmber, size: 18),
                const SizedBox(width: 10),
                Expanded(child: Text(
                  blocking?['status'] == 'pending'
                      ? 'Une demande est déjà en attente. Tu pourras en envoyer une autre après traitement.'
                      : 'Un congé approuvé est déjà actif ou planifié. Une nouvelle demande sera possible après la fin de cette période.',
                  style: TextStyle(
                    color: isDark ? Colors.white70 : _kNavy.withOpacity(0.75),
                    fontWeight: FontWeight.w600, fontSize: 13, height: 1.55,
                  ),
                )),
              ]),
            ),
    );
  }
}

class _DatePickerBtn extends StatelessWidget {
  final bool     isDark;
  final IconData icon;
  final String   label;
  final String   value;
  final VoidCallback? onTap;
  final bool     selected;
  const _DatePickerBtn({
    required this.isDark, required this.icon, required this.label,
    required this.value, required this.onTap, required this.selected,
  });
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
        decoration: BoxDecoration(
          color: selected
              ? _kAmber.withOpacity(0.1)
              : isDark ? Colors.white.withOpacity(0.04) : const Color(0xFFF6F8FD),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected
                ? _kAmber.withOpacity(0.4)
                : isDark ? Colors.white.withOpacity(0.08) : const Color(0xFFE4E9F4),
          ),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(
            color: isDark ? Colors.white38 : const Color(0xFF8899BB),
            fontSize: 11, fontWeight: FontWeight.w700,
          )),
          const SizedBox(height: 5),
          Row(children: [
            Icon(icon, color: _kAmber, size: 16),
            const SizedBox(width: 6),
            Expanded(child: Text(value, style: TextStyle(
              color: selected
                  ? (isDark ? Colors.white : _kNavy)
                  : (isDark ? Colors.white54 : const Color(0xFF8899BB)),
              fontSize: 13, fontWeight: FontWeight.w800,
            ), overflow: TextOverflow.ellipsis)),
          ]),
        ]),
      ),
    );
  }
}

class _HistorySection extends StatelessWidget {
  final bool   isDark;
  final List<Map<String, dynamic>> items;
  final String Function(String?) formatDate;
  final String Function(String)  statusLabel;
  final Color  Function(String)  statusColor;
  const _HistorySection({
    required this.isDark, required this.items, required this.formatDate,
    required this.statusLabel, required this.statusColor,
  });
  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isDark ? Colors.white.withOpacity(0.07) : const Color(0xFFE4E9F4),
          ),
        ),
        child: Center(child: Text(
          'Aucune demande de congé pour le moment.',
          style: TextStyle(
            color: isDark ? Colors.white38 : const Color(0xFF8899BB),
            fontWeight: FontWeight.w600,
          ),
        )),
      );
    }

    return Column(children: items.map((item) {
      final status = item['status']?.toString() ?? 'pending';
      final color  = statusColor(status);
      final motif  = item['description_conge']?.toString().trim();
      final denial = item['denial_reason']?.toString().trim();

      return Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isDark ? Colors.white.withOpacity(0.07) : const Color(0xFFE4E9F4),
          ),
          boxShadow: [BoxShadow(
            color: _kNavy.withOpacity(isDark ? 0.15 : 0.04),
            blurRadius: 12, offset: const Offset(0, 4),
          )],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: color.withOpacity(0.3)),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Container(width: 6, height: 6, decoration: BoxDecoration(
                  color: color, shape: BoxShape.circle,
                )),
                const SizedBox(width: 5),
                Text(statusLabel(status), style: TextStyle(
                  color: color, fontSize: 11, fontWeight: FontWeight.w800,
                )),
              ]),
            ),
            const Spacer(),
            Text(
              'Demandée le ${formatDate(item["requested_at"]?.toString())}',
              style: TextStyle(
                color: isDark ? Colors.white38 : const Color(0xFF8899BB),
                fontSize: 11, fontWeight: FontWeight.w600,
              ),
            ),
          ]),
          const SizedBox(height: 12),
          Text(
            'Du ${formatDate(item["start_date"]?.toString())} '
            'au ${formatDate(item["end_date"]?.toString())}',
            style: TextStyle(
              color: isDark ? Colors.white : _kNavy,
              fontSize: 14, fontWeight: FontWeight.w800,
            ),
          ),
          if (motif != null && motif.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('Motif : $motif', style: TextStyle(
              color: isDark ? Colors.white54 : const Color(0xFF6B7280),
              fontSize: 13, height: 1.5,
            )),
          ],
          if (status == 'denied' && denial != null && denial.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: const Color(0xFFEF4444).withOpacity(0.3)),
              ),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Icon(Icons.info_outline_rounded,
                    color: Color(0xFFEF4444), size: 16),
                const SizedBox(width: 8),
                Expanded(child: Text(
                  'Raison du refus : $denial',
                  style: const TextStyle(
                    color: Color(0xFFEF4444),
                    fontWeight: FontWeight.w700, fontSize: 13, height: 1.5,
                  ),
                )),
              ]),
            ),
          ],
        ]),
      );
    }).toList());
  }
}
