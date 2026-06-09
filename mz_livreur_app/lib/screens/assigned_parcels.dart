import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/storage.dart';
import '../widgets/global_theme_toggle.dart';

const _kNavy = Color(0xFF1A2B4A);
const _kAmber = Color(0xFFF59E0B);
const _kGrey = Color(0xFF6B7280);
const _kPageSize = 10;

enum _AssignedTab { current, history }

class AssignedParcelsScreen extends StatefulWidget {
  const AssignedParcelsScreen({super.key});

  @override
  State<AssignedParcelsScreen> createState() => _AssignedParcelsScreenState();
}

class _AssignedParcelsScreenState extends State<AssignedParcelsScreen> {
  final TextEditingController _searchController = TextEditingController();

  bool _assignedLoading = true;
  bool _historyLoading = true;
  String _assignedMsg = '';
  String _historyMsg = '';
  String _searchQuery = '';
  String _historyStatusFilter = 'all';
  String _historyTourneeFilter = 'all';
  String _historyCacheAt = '';
  bool _historyUsingCache = false;
  DateTime? _historySelectedDate;
  int _currentVisibleCount = _kPageSize;
  int _historyVisibleCount = _kPageSize;
  _AssignedTab _activeTab = _AssignedTab.current;

  List<Map<String, dynamic>> _assignedColis = [];
  List<Map<String, dynamic>> _historyColis = [];

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_handleSearchChanged);
    Future.microtask(_bootstrap);
  }

  @override
  void dispose() {
    _searchController
      ..removeListener(_handleSearchChanged)
      ..dispose();
    super.dispose();
  }

  void _handleSearchChanged() {
    final next = _searchController.text.trim();
    if (next == _searchQuery) return;
    setState(() {
      _searchQuery = next;
      _resetAllPagination();
    });
  }

  void _resetCurrentPagination() {
    _currentVisibleCount = _kPageSize;
  }

  void _resetHistoryPagination() {
    _historyVisibleCount = _kPageSize;
  }

  void _resetAllPagination() {
    _resetCurrentPagination();
    _resetHistoryPagination();
  }

  void _setActiveTab(_AssignedTab tab) {
    if (_activeTab == tab) return;
    setState(() {
      _activeTab = tab;
      if (tab == _AssignedTab.current) {
        _resetCurrentPagination();
      } else {
        _resetHistoryPagination();
      }
    });
  }

  Future<void> _bootstrap() async {
    await _restoreHistoryCache();
    await _refreshAll();
  }

  String _cacheSuffix(String value) {
    final cleaned = value.replaceAll(RegExp(r'[^A-Za-z0-9]'), '');
    if (cleaned.isEmpty) return 'default';
    return cleaned.length > 24
        ? cleaned.substring(cleaned.length - 24)
        : cleaned;
  }

  Future<String> _historyCacheBaseKey() async {
    final token = await Storage.getToken();
    return 'courier_history_cache_${_cacheSuffix(token ?? 'guest')}';
  }

  Future<String> _historyCacheItemsKey() async {
    return '${await _historyCacheBaseKey()}_items';
  }

  Future<String> _historyCacheAtKey() async {
    return '${await _historyCacheBaseKey()}_at';
  }

  Future<bool> _restoreHistoryCache({bool markAsOffline = false}) async {
    try {
      final raw = await Storage.getString(await _historyCacheItemsKey());
      if ((raw ?? '').trim().isEmpty) return false;
      final decoded = jsonDecode(raw!);
      if (decoded is! List) return false;

      final items = decoded
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
      if (items.isEmpty) return false;

      final cachedAt =
          await Storage.getString(await _historyCacheAtKey()) ?? '';
      if (!mounted) return true;
      setState(() {
        _historyColis = items;
        _historyCacheAt = cachedAt;
        _historyUsingCache = markAsOffline;
        _syncHistoryTourneeFilter();
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _saveHistoryCache(List<Map<String, dynamic>> items) async {
    final normalized = items
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
    final cachedAt = DateTime.now().toUtc().toIso8601String();
    await Storage.setString(
      await _historyCacheItemsKey(),
      jsonEncode(normalized),
    );
    await Storage.setString(await _historyCacheAtKey(), cachedAt);
    if (!mounted) return;
    setState(() {
      _historyCacheAt = cachedAt;
      _historyUsingCache = false;
    });
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

  Future<void> _refreshAll() async {
    await _loadAssignedColis();
    await _loadHistoryColis();
  }

  Future<void> _loadAssignedColis() async {
    setState(() {
      _assignedLoading = true;
      _assignedMsg = '';
    });

    try {
      final data = await Api.getJson('/courier/colis/assigned', withAuth: true);
      final items = _readList(data);
      if (!mounted) return;
      setState(() {
        _assignedColis = items;
        _resetCurrentPagination();
        _syncHistoryTourneeFilter();
      });
    } on ApiException catch (e) {
      if (await _redirectIfAuthError(e)) return;
      if (!mounted) return;
      setState(() {
        _assignedColis = [];
        _assignedMsg = e.message;
        _resetCurrentPagination();
        _syncHistoryTourneeFilter();
      });
    } finally {
      if (mounted) setState(() => _assignedLoading = false);
    }
  }

  Future<void> _loadHistoryColis() async {
    setState(() {
      _historyLoading = true;
      _historyMsg = '';
    });

    try {
      final data = await Api.getJson('/courier/colis/history', withAuth: true);
      final remoteItems = _readList(data);
      final items = remoteItems.isNotEmpty
          ? remoteItems
          : _buildLocalHistoryItems();
      if (!mounted) return;
      setState(() {
        _historyColis = items;
        _historyUsingCache = false;
        _resetHistoryPagination();
        _syncHistoryTourneeFilter();
      });
      if (items.isNotEmpty) {
        await _saveHistoryCache(items);
      }
    } on ApiException catch (e) {
      if (await _redirectIfAuthError(e)) return;
      if (!mounted) return;
      final localItems = _buildLocalHistoryItems();
      if (localItems.isNotEmpty) {
        setState(() {
          _historyColis = localItems;
          _historyMsg = '';
          _historyUsingCache = false;
          _resetHistoryPagination();
          _syncHistoryTourneeFilter();
        });
        await _saveHistoryCache(localItems);
      } else {
        final restored = await _restoreHistoryCache(markAsOffline: true);
        if (!mounted) return;
        setState(() {
          if (!restored) {
            _historyColis = [];
          }
          _historyMsg = restored ? '' : e.message;
          _resetHistoryPagination();
          _syncHistoryTourneeFilter();
        });
      }
    } finally {
      if (mounted) setState(() => _historyLoading = false);
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

  String _lower(String? value) => (value ?? '').trim().toLowerCase();

  String _parcelStatusLabel(String? status) {
    final raw = _lower(status);
    if (raw.contains('relivr') || raw.contains('report')) return 'A relivrer';
    if (raw.contains('transit')) return 'En transit';
    if (raw.contains('livr')) return 'Livre';
    if (raw.contains('retour')) return 'Retour';
    if (raw.contains('annul')) return 'Annule';
    return 'En attente';
  }

  String _parcelStageLabel(String? stage) {
    final raw = _lower(stage);
    if (raw == 'return_pending') return 'Depot retour expediteur';
    if (raw == 'returned') return 'Retour confirme';
    if (raw.contains('return')) return 'Retour expediteur';
    if (raw == 'picked_up' || raw.contains('picked')) return 'Recupere';
    if (raw == 'out_for_delivery' ||
        (raw.contains('out') && raw.contains('delivery'))) {
      return 'En transit';
    }
    if (raw == 'at_warehouse' || raw.contains('warehouse')) return 'Au depot';
    if (raw == 'delivered' || raw.contains('deliver')) return 'Livre';
    return 'En attente';
  }

  String _historyStatus(Map<String, dynamic> item) {
    final provided = _lower(item['history_status']?.toString());
    if (provided.isNotEmpty) return provided;

    final statut = _lower(item['statut']?.toString());
    final stage = _lower(item['tracking_stage']?.toString());
    final returnedAt = item['returned_at']?.toString() ?? '';
    final deliveredAt = item['delivered_at']?.toString() ?? '';
    final issueAt = item['last_delivery_issue_at']?.toString() ?? '';

    if (returnedAt.isNotEmpty ||
        stage == 'return_pending' ||
        stage == 'returned' ||
        statut.contains('retour')) {
      return 'returned';
    }
    if (deliveredAt.isNotEmpty ||
        stage == 'delivered' ||
        statut.contains('livr')) {
      return 'delivered';
    }
    if (issueAt.isNotEmpty ||
        statut.contains('relivr') ||
        statut.contains('report') ||
        stage == 'delivery_failed' ||
        stage == 'not_delivered' ||
        (stage == 'at_warehouse' &&
            (int.tryParse(item['delivery_issue_count']?.toString() ?? '0') ??
                    0) >
                0)) {
      return 'rescheduled';
    }
    return 'active';
  }

  bool _isHistoryItem(Map<String, dynamic> item) =>
      _historyStatus(item) != 'active';

  DateTime? _historyDate(Map<String, dynamic> item) {
    final raw = _historyDateValue(item).trim();
    if (raw.isEmpty) return null;
    return DateTime.tryParse(raw);
  }

  String _historyItemKey(Map<String, dynamic> item) {
    for (final key in ['id', 'barcode_value', 'numero_suivi']) {
      final value = item[key]?.toString().trim() ?? '';
      if (value.isNotEmpty) return '$key:$value';
    }
    return '';
  }

  String _historyTourneeValue(Map<String, dynamic> item) {
    final id = item['tournee_id']?.toString().trim() ?? '';
    if (id.isNotEmpty) return 'id:$id';

    final name = item['tournee_nom']?.toString().trim() ?? '';
    if (name.isNotEmpty) return 'name:${name.toLowerCase()}';
    return '';
  }

  String _historyTourneeLabel(Map<String, dynamic> item) {
    final name = item['tournee_nom']?.toString().trim() ?? '';
    if (name.isNotEmpty) return name;

    final id = item['tournee_id']?.toString().trim() ?? '';
    if (id.isNotEmpty) return 'Tournee #$id';
    return 'Sans tournee';
  }

  List<_HistoryTourneeOption> _historyTourneeOptions() {
    final labels = <String, String>{};
    for (final item in _historySourceItems()) {
      final value = _historyTourneeValue(item);
      if (value.isEmpty) continue;
      labels.putIfAbsent(value, () => _historyTourneeLabel(item));
    }

    final options =
        labels.entries
            .map((entry) => _HistoryTourneeOption(entry.key, entry.value))
            .toList()
          ..sort(
            (a, b) => a.label.toLowerCase().compareTo(b.label.toLowerCase()),
          );
    return options;
  }

  void _syncHistoryTourneeFilter() {
    if (_historyTourneeFilter == 'all') return;
    final exists = _historyTourneeOptions().any(
      (option) => option.value == _historyTourneeFilter,
    );
    if (!exists) {
      _historyTourneeFilter = 'all';
    }
  }

  bool _matchesHistoryTournee(Map<String, dynamic> item) {
    if (_historyTourneeFilter == 'all') return true;
    return _historyTourneeValue(item) == _historyTourneeFilter;
  }

  DateTime _dayOnly(DateTime value) {
    final local = value.toLocal();
    return DateTime(local.year, local.month, local.day);
  }

  bool _isSameDay(DateTime left, DateTime right) {
    return left.year == right.year &&
        left.month == right.month &&
        left.day == right.day;
  }

  bool _matchesHistoryDate(Map<String, dynamic> item) {
    if (_historySelectedDate == null) return true;
    final date = _historyDate(item);
    if (date == null) return false;
    return _isSameDay(_dayOnly(date), _dayOnly(_historySelectedDate!));
  }

  String _formatCalendarDate(DateTime value) {
    final local = _dayOnly(value);
    String dd(int n) => n.toString().padLeft(2, '0');
    return '${dd(local.day)}/${dd(local.month)}/${local.year}';
  }

  String get _historySelectedDateLabel {
    final selected = _historySelectedDate;
    if (selected == null) return '';

    final day = _dayOnly(selected);
    final today = _dayOnly(DateTime.now());
    if (_isSameDay(day, today)) return 'Aujourd\'hui';
    if (_isSameDay(day, today.subtract(const Duration(days: 1)))) {
      return 'Hier';
    }
    return _formatCalendarDate(day);
  }

  Future<void> _pickHistoryDate() async {
    final now = _dayOnly(DateTime.now());
    final initialDate = _historySelectedDate == null
        ? now
        : _dayOnly(_historySelectedDate!);
    final firstDate = DateTime(now.year - 3, 1, 1);
    final lastDate = DateTime(now.year + 1, 12, 31);

    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: firstDate,
      lastDate: lastDate,
      helpText: 'Filtrer l historique',
      cancelText: 'Fermer',
      confirmText: 'Appliquer',
      builder: (context, child) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final colorScheme = ColorScheme.fromSeed(
          seedColor: _kAmber,
          brightness: isDark ? Brightness.dark : Brightness.light,
        );
        return Theme(
          data: Theme.of(context).copyWith(colorScheme: colorScheme),
          child: child!,
        );
      },
    );

    if (picked == null || !mounted) return;
    setState(() {
      _historySelectedDate = _dayOnly(picked);
      _resetHistoryPagination();
    });
  }

  void _clearHistoryDate() {
    if (_historySelectedDate == null) return;
    setState(() {
      _historySelectedDate = null;
      _resetHistoryPagination();
    });
  }

  String _monthLabel(int month) {
    const months = <String>[
      'janv.',
      'fevr.',
      'mars',
      'avr.',
      'mai',
      'juin',
      'juil.',
      'aout',
      'sept.',
      'oct.',
      'nov.',
      'dec.',
    ];
    if (month < 1 || month > 12) return '';
    return months[month - 1];
  }

  String _historyDateGroupLabel(DateTime? date) {
    if (date == null) return 'Sans date';

    final local = date.toLocal();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(local.year, local.month, local.day);

    if (_isSameDay(day, today)) return 'Aujourd\'hui';
    if (_isSameDay(day, today.subtract(const Duration(days: 1)))) return 'Hier';

    return '${local.day.toString().padLeft(2, '0')} '
        '${_monthLabel(local.month)} ${local.year}';
  }

  String _historyDateGroupKey(DateTime? date) {
    if (date == null) return 'none';
    final local = date.toLocal();
    return '${local.year.toString().padLeft(4, '0')}-'
        '${local.month.toString().padLeft(2, '0')}-'
        '${local.day.toString().padLeft(2, '0')}';
  }

  List<_HistorySection> _historySections(List<Map<String, dynamic>> items) {
    final sections = <_HistorySection>[];
    for (final item in items) {
      final date = _historyDate(item);
      final key = _historyDateGroupKey(date);
      if (sections.isEmpty || sections.last.key != key) {
        sections.add(
          _HistorySection(
            key: key,
            label: _historyDateGroupLabel(date),
            items: [item],
          ),
        );
      } else {
        sections.last.items.add(item);
      }
    }
    return sections;
  }

  String get _historyCacheLabel {
    if (_historyCacheAt.trim().isEmpty || !_historyUsingCache) return '';
    return 'Mode hors ligne: historique local du '
        '${_formatDateTime(_historyCacheAt)}';
  }

  List<Map<String, dynamic>> _buildLocalHistoryItems() {
    final seen = <String>{};
    final items = <Map<String, dynamic>>[];

    for (final item in _assignedColis.where(_isHistoryItem)) {
      final key = _historyItemKey(item);
      if (key.isNotEmpty && !seen.add(key)) continue;
      items.add(Map<String, dynamic>.from(item));
    }

    items.sort((a, b) {
      final left = _historyDate(a);
      final right = _historyDate(b);
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;
      return right.compareTo(left);
    });

    return items;
  }

  List<Map<String, dynamic>> _historySourceItems() {
    final seen = <String>{};
    final items = <Map<String, dynamic>>[];

    for (final item in [..._historyColis, ..._buildLocalHistoryItems()]) {
      final key = _historyItemKey(item);
      if (key.isNotEmpty && !seen.add(key)) continue;
      items.add(Map<String, dynamic>.from(item));
    }

    items.sort((a, b) {
      final left = _historyDate(a);
      final right = _historyDate(b);
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;
      return right.compareTo(left);
    });

    return items;
  }

  List<Map<String, dynamic>> _currentBaseItems() {
    return _assignedColis.where((item) => !_isHistoryItem(item)).toList();
  }

  List<Map<String, dynamic>> _historyBaseItems() {
    return _historySourceItems();
  }

  List<Map<String, dynamic>> _historyCounterItems() {
    return _historyBaseItems()
        .where(_matchesHistoryTournee)
        .where(_matchesHistoryDate)
        .toList();
  }

  int _countHistoryStatus(String status) {
    return _historyCounterItems()
        .where((item) => _historyStatus(item) == status)
        .length;
  }

  String _historyStatusLabel(Map<String, dynamic> item) {
    final provided = item['history_label']?.toString().trim() ?? '';
    if (provided.isNotEmpty) return provided;

    switch (_historyStatus(item)) {
      case 'delivered':
        return 'Livre';
      case 'returned':
        return 'Retour expediteur';
      case 'rescheduled':
        return 'A relivrer';
      default:
        return 'Historique';
    }
  }

  Color _parcelColor(Map<String, dynamic> item) {
    switch (_historyStatus(item)) {
      case 'returned':
        return const Color(0xFFEF4444);
      case 'delivered':
        return const Color(0xFF22C55E);
      case 'rescheduled':
        return const Color(0xFF6366F1);
      default:
        return _kAmber;
    }
  }

  String _formatDateTime(String? value) {
    if (value == null || value.trim().isEmpty) return '-';
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return value;
    final local = parsed.toLocal();
    String dd(int n) => n.toString().padLeft(2, '0');
    return '${dd(local.day)}/${dd(local.month)}/${local.year} '
        '${dd(local.hour)}:${dd(local.minute)}';
  }

  String _historyDateValue(Map<String, dynamic> item) {
    final explicit = item['history_date']?.toString();
    if ((explicit ?? '').trim().isNotEmpty) return explicit!;

    for (final key in const [
      'returned_at',
      'delivered_at',
      'last_delivery_issue_at',
      'out_for_delivery_at',
      'warehouse_received_at',
      'picked_up_at',
    ]) {
      final raw = item[key]?.toString() ?? '';
      if (raw.trim().isNotEmpty) return raw;
    }
    return '';
  }

  String _historyContextLabel(Map<String, dynamic> item) {
    final tournee = item['tournee_nom']?.toString().trim() ?? '';
    if (tournee.isNotEmpty) return 'Tournee: $tournee';
    return _parcelStageLabel(item['tracking_stage']?.toString());
  }

  String _parcelCode(Map<String, dynamic> item) {
    final barcode = item['barcode_value']?.toString().trim() ?? '';
    if (barcode.isNotEmpty) return barcode;
    return item['numero_suivi']?.toString().trim() ?? '';
  }

  bool _matchesSearch(Map<String, dynamic> item) {
    final query = _lower(_searchQuery);
    if (query.isEmpty) return true;

    final haystack = [
      item['numero_suivi'],
      item['barcode_value'],
      item['nom_destinataire'],
      item['adresse_livraison'],
      item['tournee_nom'],
      item['history_label'],
    ].map((value) => value?.toString() ?? '').join(' ').toLowerCase();

    return haystack.contains(query);
  }

  List<Map<String, dynamic>> _currentItems() {
    return _currentBaseItems().where(_matchesSearch).toList();
  }

  List<Map<String, dynamic>> _historyItems() {
    return _historySourceItems()
        .where((item) {
          if (_historyStatusFilter == 'all') return true;
          return _historyStatus(item) == _historyStatusFilter;
        })
        .where(_matchesHistoryTournee)
        .where(_matchesHistoryDate)
        .where(_matchesSearch)
        .toList();
  }

  List<Map<String, dynamic>> _takePage(
    List<Map<String, dynamic>> items,
    int visibleCount,
  ) {
    final count = math.min(items.length, visibleCount);
    return items.take(count).toList();
  }

  List<Map<String, dynamic>> get _filteredItems =>
      _activeTab == _AssignedTab.current ? _currentItems() : _historyItems();

  bool get _activeLoading =>
      _activeTab == _AssignedTab.current ? _assignedLoading : _historyLoading;

  String get _activeMessage =>
      _activeTab == _AssignedTab.current ? _assignedMsg : _historyMsg;

  List<Map<String, dynamic>> get _visibleItems =>
      _activeTab == _AssignedTab.current
      ? _takePage(_currentItems(), _currentVisibleCount)
      : _takePage(_historyItems(), _historyVisibleCount);

  bool get _activeHasMore => _visibleItems.length < _filteredItems.length;

  void _loadMoreActive() {
    setState(() {
      if (_activeTab == _AssignedTab.current) {
        _currentVisibleCount += _kPageSize;
      } else {
        _historyVisibleCount += _kPageSize;
      }
    });
  }

  String get _searchPlaceholder => _activeTab == _AssignedTab.current
      ? 'Rechercher un colis en cours...'
      : 'Rechercher dans l historique...';

  String get _headerSubtitle => _activeTab == _AssignedTab.current
      ? 'Colis en cours a traiter'
      : 'Anciens colis traites et retours';

  void _openColis(Map<String, dynamic> item) {
    final code = _parcelCode(item);
    if (code.isEmpty) {
      setState(() {
        if (_activeTab == _AssignedTab.current) {
          _assignedMsg = 'Code colis introuvable.';
        } else {
          _historyMsg = 'Code colis introuvable.';
        }
      });
      return;
    }

    Navigator.pushNamed(
      context,
      '/colis-action?code=${Uri.encodeQueryComponent(code)}',
      arguments: {'code': code, 'colis': item},
    );
  }

  List<Widget> _buildHistorySectionWidgets(
    bool isDark,
    List<_HistorySection> sections,
  ) {
    final widgets = <Widget>[];

    for (var sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
      final section = sections[sectionIndex];
      widgets.add(
        _HistoryGroupHeader(
          isDark: isDark,
          label: section.label,
          count: section.items.length,
        ),
      );
      widgets.add(const SizedBox(height: 10));

      for (var itemIndex = 0; itemIndex < section.items.length; itemIndex++) {
        final item = section.items[itemIndex];
        widgets.add(
          _ParcelTile(
            isDark: isDark,
            item: item,
            statusLabel: _historyStatusLabel(item),
            stageLabel: _historyContextLabel(item),
            dateLabel: _formatDateTime(_historyDateValue(item)),
            statusColor: _parcelColor(item),
            onTap: () => _openColis(item),
          ),
        );
        if (itemIndex < section.items.length - 1) {
          widgets.add(const SizedBox(height: 10));
        }
      }

      if (sectionIndex < sections.length - 1) {
        widgets.add(const SizedBox(height: 18));
      }
    }

    return widgets;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final filteredItems = _filteredItems;
    final items = _visibleItems;
    final currentTotalCount = _currentBaseItems().length;
    final historyTotalCount = _historyBaseItems().length;
    final deliveredCount = _countHistoryStatus('delivered');
    final returnedCount = _countHistoryStatus('returned');
    final rescheduledCount = _countHistoryStatus('rescheduled');
    final historySections = _activeTab == _AssignedTab.history
        ? _historySections(items)
        : const <_HistorySection>[];
    final historyTournees = _historyTourneeOptions();
    final showInitialLoader = _activeLoading && filteredItems.isEmpty;

    return Scaffold(
      backgroundColor: isDark
          ? const Color(0xFF080E1A)
          : const Color(0xFFF2F4F9),
      body: SafeArea(
        child: Column(
          children: [
            _PageHeader(
              isDark: isDark,
              subtitle: _headerSubtitle,
              count: showInitialLoader ? null : filteredItems.length,
              onRefresh: _activeLoading ? null : _refreshAll,
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _refreshAll,
                color: _kAmber,
                child: showInitialLoader
                    ? const Center(
                        child: CircularProgressIndicator(color: _kAmber),
                      )
                    : ListView(
                        physics: const BouncingScrollPhysics(
                          parent: AlwaysScrollableScrollPhysics(),
                        ),
                        padding: const EdgeInsets.fromLTRB(18, 18, 18, 28),
                        children: [
                          _TabSwitcher(
                            activeTab: _activeTab,
                            currentCount: currentTotalCount,
                            historyCount: historyTotalCount,
                            onChanged: _setActiveTab,
                          ),
                          const SizedBox(height: 12),
                          if (_activeTab == _AssignedTab.history)
                            Row(
                              children: [
                                Expanded(
                                  child: _SearchField(
                                    controller: _searchController,
                                    isDark: isDark,
                                    hintText: _searchPlaceholder,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                _HistoryDateButton(
                                  isDark: isDark,
                                  active: _historySelectedDate != null,
                                  onTap: _pickHistoryDate,
                                ),
                              ],
                            )
                          else
                            _SearchField(
                              controller: _searchController,
                              isDark: isDark,
                              hintText: _searchPlaceholder,
                            ),
                          if (_activeTab == _AssignedTab.history &&
                              _historySelectedDate != null) ...[
                            const SizedBox(height: 10),
                            _HistoryDateFilterBadge(
                              isDark: isDark,
                              label: _historySelectedDateLabel,
                              onTap: _pickHistoryDate,
                              onClear: _clearHistoryDate,
                            ),
                          ],
                          const SizedBox(height: 12),
                          _SummaryCounters(
                            isDark: isDark,
                            activeTab: _activeTab,
                            currentCount: currentTotalCount,
                            historyCount: historyTotalCount,
                            deliveredCount: deliveredCount,
                            returnedCount: returnedCount,
                            rescheduledCount: rescheduledCount,
                          ),
                          if (_activeTab == _AssignedTab.history) ...[
                            const SizedBox(height: 12),
                            _HistoryFilters(
                              selected: _historyStatusFilter,
                              onChanged: (value) => setState(() {
                                _historyStatusFilter = value;
                                _resetHistoryPagination();
                              }),
                            ),
                            if (historyTournees.isNotEmpty) ...[
                              const SizedBox(height: 12),
                              _HistoryTourneeFilters(
                                selected: _historyTourneeFilter,
                                options: historyTournees,
                                onChanged: (value) => setState(() {
                                  _historyTourneeFilter = value;
                                  _resetHistoryPagination();
                                }),
                              ),
                            ],
                            if (_historyCacheLabel.isNotEmpty) ...[
                              const SizedBox(height: 12),
                              _OfflineCacheNotice(
                                isDark: isDark,
                                message: _historyCacheLabel,
                              ),
                            ],
                          ],
                          const SizedBox(height: 14),
                          if (_activeMessage.isNotEmpty) ...[
                            _Banner(message: _activeMessage, isSuccess: false),
                            const SizedBox(height: 14),
                          ],
                          if (_activeLoading && items.isNotEmpty) ...[
                            const _InlineLoader(),
                            const SizedBox(height: 12),
                          ],
                          if (items.isEmpty)
                            _EmptyState(
                              isDark: isDark,
                              title: _emptyTitle(),
                              subtitle: _emptySubtitle(),
                              icon: _activeTab == _AssignedTab.current
                                  ? Icons.inbox_outlined
                                  : Icons.history_rounded,
                            )
                          else if (_activeTab == _AssignedTab.history) ...[
                            ..._buildHistorySectionWidgets(
                              isDark,
                              historySections,
                            ),
                            if (_activeHasMore) ...[
                              const SizedBox(height: 14),
                              _PaginationFooter(
                                isDark: isDark,
                                shownCount: items.length,
                                totalCount: filteredItems.length,
                                onPressed: _loadMoreActive,
                              ),
                            ],
                          ] else ...[
                            ...List.generate(items.length, (index) {
                              final item = items[index];
                              final color = _parcelColor(item);
                              final isHistory =
                                  _activeTab == _AssignedTab.history;
                              return Padding(
                                padding: EdgeInsets.only(
                                  bottom: index < items.length - 1 ? 10 : 0,
                                ),
                                child: _ParcelTile(
                                  isDark: isDark,
                                  item: item,
                                  statusLabel: isHistory
                                      ? _historyStatusLabel(item)
                                      : _parcelStatusLabel(
                                          item['statut']?.toString(),
                                        ),
                                  stageLabel: isHistory
                                      ? _historyContextLabel(item)
                                      : _parcelStageLabel(
                                          item['tracking_stage']?.toString(),
                                        ),
                                  dateLabel: isHistory
                                      ? _formatDateTime(_historyDateValue(item))
                                      : _formatDateTime(
                                          item['out_for_delivery_at']
                                              ?.toString(),
                                        ),
                                  statusColor: color,
                                  onTap: () => _openColis(item),
                                ),
                              );
                            }),
                            if (_activeHasMore) ...[
                              const SizedBox(height: 14),
                              _PaginationFooter(
                                isDark: isDark,
                                shownCount: items.length,
                                totalCount: filteredItems.length,
                                onPressed: _loadMoreActive,
                              ),
                            ],
                          ],
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _emptyTitle() {
    if (_activeTab == _AssignedTab.current) {
      return _searchQuery.isNotEmpty
          ? 'Aucun colis trouve'
          : 'Aucun colis en cours';
    }
    return _searchQuery.isNotEmpty ||
            _historyStatusFilter != 'all' ||
            _historyTourneeFilter != 'all' ||
            _historySelectedDate != null
        ? 'Aucun historique trouve'
        : 'Historique vide';
  }

  String _emptySubtitle() {
    if (_activeTab == _AssignedTab.current) {
      return _searchQuery.isNotEmpty
          ? 'Essaie un autre numero, destinataire ou code colis.'
          : 'Tes colis actifs apparaitront ici.';
    }
    if (_searchQuery.isNotEmpty ||
        _historyStatusFilter != 'all' ||
        _historyTourneeFilter != 'all' ||
        _historySelectedDate != null) {
      return 'Modifie la recherche ou les filtres pour voir d autres colis.';
    }
    return 'Les colis livres, retournes ou a relivrer apparaitront ici.';
  }
}

class _PageHeader extends StatelessWidget {
  const _PageHeader({
    required this.isDark,
    required this.subtitle,
    required this.count,
    required this.onRefresh,
  });

  final bool isDark;
  final String subtitle;
  final int? count;
  final VoidCallback? onRefresh;

  @override
  Widget build(BuildContext context) {
    return Container(
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
            color: _kNavy.withOpacity(0.3),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
                constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Colis affectes',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const ThemeIconButton(),
              const SizedBox(width: 4),
              IconButton(
                onPressed: onRefresh,
                icon: const Icon(
                  Icons.refresh_rounded,
                  color: Colors.white70,
                  size: 22,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            subtitle,
            style: TextStyle(
              color: Colors.white.withOpacity(0.72),
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _StatChip(
                icon: Icons.inventory_2_outlined,
                color: const Color(0xFF22C55E),
                label: 'Visible',
                value: count == null ? '...' : '$count',
              ),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: _kAmber.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: _kAmber.withOpacity(0.3)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.manage_search_rounded, color: _kAmber, size: 14),
                    SizedBox(width: 6),
                    Text(
                      'Recherche rapide',
                      style: TextStyle(
                        color: _kAmber,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final Color color;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: color.withOpacity(0.7),
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                value,
                style: TextStyle(
                  color: color,
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TabSwitcher extends StatelessWidget {
  const _TabSwitcher({
    required this.activeTab,
    required this.currentCount,
    required this.historyCount,
    required this.onChanged,
  });

  final _AssignedTab activeTab;
  final int currentCount;
  final int historyCount;
  final ValueChanged<_AssignedTab> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? Colors.white.withOpacity(0.05)
            : Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: Theme.of(context).brightness == Brightness.dark
              ? Colors.white.withOpacity(0.08)
              : const Color(0xFFE4E9F4),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: _TabButton(
              label: 'En cours ($currentCount)',
              selected: activeTab == _AssignedTab.current,
              onTap: () => onChanged(_AssignedTab.current),
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: _TabButton(
              label: 'Historique ($historyCount)',
              selected: activeTab == _AssignedTab.history,
              onTap: () => onChanged(_AssignedTab.history),
            ),
          ),
        ],
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: selected ? _kAmber : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            color: selected
                ? Colors.white
                : (Theme.of(context).brightness == Brightness.dark
                      ? Colors.white70
                      : _kNavy),
            fontSize: 13,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}

class _SummaryCounters extends StatelessWidget {
  const _SummaryCounters({
    required this.isDark,
    required this.activeTab,
    required this.currentCount,
    required this.historyCount,
    required this.deliveredCount,
    required this.returnedCount,
    required this.rescheduledCount,
  });

  final bool isDark;
  final _AssignedTab activeTab;
  final int currentCount;
  final int historyCount;
  final int deliveredCount;
  final int returnedCount;
  final int rescheduledCount;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _CounterBadge(
          isDark: isDark,
          label: 'En cours',
          value: '$currentCount',
          color: _kAmber,
        ),
        _CounterBadge(
          isDark: isDark,
          label: 'Historique',
          value: '$historyCount',
          color: _kNavy,
        ),
        if (activeTab == _AssignedTab.history) ...[
          _CounterBadge(
            isDark: isDark,
            label: 'Livres',
            value: '$deliveredCount',
            color: const Color(0xFF22C55E),
          ),
          _CounterBadge(
            isDark: isDark,
            label: 'Retours',
            value: '$returnedCount',
            color: const Color(0xFFEF4444),
          ),
          _CounterBadge(
            isDark: isDark,
            label: 'A relivrer',
            value: '$rescheduledCount',
            color: const Color(0xFF6366F1),
          ),
        ],
      ],
    );
  }
}

class _CounterBadge extends StatelessWidget {
  const _CounterBadge({
    required this.isDark,
    required this.label,
    required this.value,
    required this.color,
  });

  final bool isDark;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark
              ? Colors.white.withOpacity(0.07)
              : const Color(0xFFE4E9F4),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: isDark ? Colors.white70 : _kNavy,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 13,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.controller,
    required this.isDark,
    required this.hintText,
  });

  final TextEditingController controller;
  final bool isDark;
  final String hintText;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      style: TextStyle(
        color: isDark ? Colors.white : _kNavy,
        fontWeight: FontWeight.w700,
      ),
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: TextStyle(
          color: isDark ? Colors.white38 : const Color(0xFF94A3B8),
          fontWeight: FontWeight.w600,
        ),
        prefixIcon: const Icon(Icons.search_rounded, color: _kAmber, size: 20),
        suffixIcon: controller.text.trim().isEmpty
            ? null
            : IconButton(
                onPressed: controller.clear,
                icon: const Icon(Icons.close_rounded, color: _kGrey, size: 18),
              ),
        filled: true,
        fillColor: isDark ? const Color(0xFF0F1B2D) : Colors.white,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(
            color: isDark
                ? Colors.white.withOpacity(0.07)
                : const Color(0xFFE4E9F4),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: _kAmber, width: 1.6),
        ),
      ),
    );
  }
}

class _HistoryDateButton extends StatelessWidget {
  const _HistoryDateButton({
    required this.isDark,
    required this.active,
    required this.onTap,
  });

  final bool isDark;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          width: 54,
          height: 54,
          decoration: BoxDecoration(
            color: active
                ? _kAmber.withOpacity(0.12)
                : (isDark ? const Color(0xFF0F1B2D) : Colors.white),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: active
                  ? _kAmber.withOpacity(0.35)
                  : (isDark
                        ? Colors.white.withOpacity(0.07)
                        : const Color(0xFFE4E9F4)),
            ),
          ),
          child: Icon(
            Icons.calendar_month_rounded,
            color: active ? _kAmber : (isDark ? Colors.white70 : _kNavy),
            size: 22,
          ),
        ),
      ),
    );
  }
}

class _HistoryDateFilterBadge extends StatelessWidget {
  const _HistoryDateFilterBadge({
    required this.isDark,
    required this.label,
    required this.onTap,
    required this.onClear,
  });

  final bool isDark;
  final String label;
  final VoidCallback onTap;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: isDark
                ? Colors.white.withOpacity(0.04)
                : const Color(0xFFF6F8FD),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark
                  ? Colors.white.withOpacity(0.08)
                  : const Color(0xFFE4E9F4),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: _kAmber.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.event_rounded,
                  color: _kAmber,
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Date selectionnee',
                      style: TextStyle(
                        color: isDark ? Colors.white54 : _kGrey,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      label,
                      style: TextStyle(
                        color: isDark ? Colors.white : _kNavy,
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: onClear,
                tooltip: 'Retirer le filtre date',
                icon: const Icon(Icons.close_rounded, color: _kGrey, size: 18),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HistoryFilters extends StatelessWidget {
  const _HistoryFilters({required this.selected, required this.onChanged});

  final String selected;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    const filters = <Map<String, String>>[
      {'value': 'all', 'label': 'Tous'},
      {'value': 'delivered', 'label': 'Livres'},
      {'value': 'returned', 'label': 'Retours'},
      {'value': 'rescheduled', 'label': 'A relivrer'},
    ];

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: filters.map((filter) {
        final value = filter['value']!;
        final isSelected = selected == value;
        return GestureDetector(
          onTap: () => onChanged(value),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isSelected
                  ? _kAmber.withOpacity(0.12)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isSelected
                    ? _kAmber.withOpacity(0.35)
                    : (Theme.of(context).brightness == Brightness.dark
                          ? Colors.white12
                          : const Color(0xFFE4E9F4)),
              ),
            ),
            child: Text(
              filter['label']!,
              style: TextStyle(
                color: isSelected
                    ? _kAmber
                    : (Theme.of(context).brightness == Brightness.dark
                          ? Colors.white60
                          : _kNavy),
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _HistoryTourneeFilters extends StatelessWidget {
  const _HistoryTourneeFilters({
    required this.selected,
    required this.options,
    required this.onChanged,
  });

  final String selected;
  final List<_HistoryTourneeOption> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _TourneeFilterChip(
            label: 'Toutes les tournees',
            selected: selected == 'all',
            onTap: () => onChanged('all'),
          ),
          ...options.map((option) {
            return Padding(
              padding: const EdgeInsets.only(left: 8),
              child: _TourneeFilterChip(
                label: option.label,
                selected: selected == option.value,
                onTap: () => onChanged(option.value),
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _TourneeFilterChip extends StatelessWidget {
  const _TourneeFilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: selected
              ? _kNavy
              : (isDark ? const Color(0xFF0F1B2D) : Colors.white),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected
                ? _kNavy
                : (isDark ? Colors.white12 : const Color(0xFFE4E9F4)),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : (isDark ? Colors.white70 : _kNavy),
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

class _OfflineCacheNotice extends StatelessWidget {
  const _OfflineCacheNotice({required this.isDark, required this.message});

  final bool isDark;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
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
      child: Row(
        children: [
          const Icon(Icons.cloud_off_rounded, color: _kAmber, size: 18),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: isDark ? Colors.white70 : _kNavy,
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

class _HistoryGroupHeader extends StatelessWidget {
  const _HistoryGroupHeader({
    required this.isDark,
    required this.label,
    required this.count,
  });

  final bool isDark;
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          label,
          style: TextStyle(
            color: isDark ? Colors.white : _kNavy,
            fontSize: 14,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: _kAmber.withOpacity(0.1),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: _kAmber.withOpacity(0.25)),
          ),
          child: Text(
            '$count',
            style: const TextStyle(
              color: _kAmber,
              fontSize: 11,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      ],
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.message, required this.isSuccess});

  final String message;
  final bool isSuccess;

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
      child: Row(
        children: [
          Icon(
            isSuccess
                ? Icons.check_circle_outline_rounded
                : Icons.error_outline_rounded,
            color: color,
            size: 18,
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InlineLoader extends StatelessWidget {
  const _InlineLoader();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? Colors.white.withOpacity(0.04)
            : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: Theme.of(context).brightness == Brightness.dark
              ? Colors.white.withOpacity(0.07)
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
              'Rafraichissement en cours...',
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

class _PaginationFooter extends StatelessWidget {
  const _PaginationFooter({
    required this.isDark,
    required this.shownCount,
    required this.totalCount,
    required this.onPressed,
  });

  final bool isDark;
  final int shownCount;
  final int totalCount;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isDark
              ? Colors.white.withOpacity(0.07)
              : const Color(0xFFE4E9F4),
        ),
      ),
      child: Column(
        children: [
          Text(
            '$shownCount sur $totalCount colis affiches',
            style: TextStyle(
              color: isDark ? Colors.white70 : _kNavy,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: onPressed,
              icon: const Icon(Icons.expand_more_rounded, size: 18),
              label: const Text('Afficher plus'),
              style: OutlinedButton.styleFrom(
                foregroundColor: _kAmber,
                side: const BorderSide(color: _kAmber),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                textStyle: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 13,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.isDark,
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  final bool isDark;
  final String title;
  final String subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: isDark
              ? Colors.white.withOpacity(0.07)
              : const Color(0xFFE4E9F4),
        ),
      ),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: _kAmber.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: _kAmber, size: 32),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: TextStyle(
              color: isDark ? Colors.white : _kNavy,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isDark ? Colors.white38 : const Color(0xFF8899BB),
              fontSize: 13,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _ParcelTile extends StatelessWidget {
  const _ParcelTile({
    required this.isDark,
    required this.item,
    required this.statusLabel,
    required this.stageLabel,
    required this.dateLabel,
    required this.statusColor,
    required this.onTap,
  });

  final bool isDark;
  final Map<String, dynamic> item;
  final String statusLabel;
  final String stageLabel;
  final String dateLabel;
  final Color statusColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final numero = item['numero_suivi']?.toString() ?? '-';
    final destinataire = item['nom_destinataire']?.toString() ?? '-';
    final adresse =
        item['adresse_livraison']?.toString() ??
        item['adresse']?.toString() ??
        '-';
    final ordre = item['ordre']?.toString() ?? '';

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
            boxShadow: [
              BoxShadow(
                color: _kNavy.withOpacity(isDark ? 0.15 : 0.04),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: statusColor.withOpacity(0.2)),
                ),
                child: Icon(
                  Icons.local_shipping_outlined,
                  color: statusColor,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            numero,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: isDark ? Colors.white : _kNavy,
                              fontWeight: FontWeight.w900,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        if (ordre.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: _kAmber.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: _kAmber.withOpacity(0.3),
                              ),
                            ),
                            child: Text(
                              '#$ordre',
                              style: const TextStyle(
                                color: _kAmber,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      destinataire,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isDark ? Colors.white70 : _kNavy,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      adresse,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isDark
                            ? Colors.white38
                            : const Color(0xFF8899BB),
                        fontSize: 12,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        _Pill(label: statusLabel, color: statusColor),
                        _Pill(label: stageLabel, muted: true, isDark: isDark),
                        if (dateLabel != '-')
                          _Pill(label: dateLabel, muted: true, isDark: isDark),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Icon(
                Icons.chevron_right_rounded,
                color: isDark ? Colors.white24 : const Color(0xFFCCD4E8),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    this.color,
    this.muted = false,
    this.isDark = false,
  });

  final String label;
  final Color? color;
  final bool muted;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final c = color ?? _kAmber;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: muted
            ? (isDark
                  ? Colors.white.withOpacity(0.05)
                  : const Color(0xFFF2F4F9))
            : c.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: muted
              ? (isDark ? Colors.white12 : const Color(0xFFE4E9F4))
              : c.withOpacity(0.3),
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: muted
              ? (isDark ? Colors.white38 : const Color(0xFF8899BB))
              : c,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _HistorySection {
  const _HistorySection({
    required this.key,
    required this.label,
    required this.items,
  });

  final String key;
  final String label;
  final List<Map<String, dynamic>> items;
}

class _HistoryTourneeOption {
  const _HistoryTourneeOption(this.value, this.label);

  final String value;
  final String label;
}
