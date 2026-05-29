import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import '../widgets/global_theme_toggle.dart';

// ─── MZ Logistic design palette ─────────────────────────────────────────────
const Color _kNavy = Color(0xFF1A2B4A);
const Color _kAmber = Color(0xFFF59E0B);
const Color _kGrey = Color(0xFF6B7280);
const Color _kDepotColor = _kNavy;
const Color _kStopDefaultColor = _kAmber;
const Color _kDeliveredColor = Color(0xFF16A34A);
const Color _kReturnedColor = Color(0xFFDC2626);
const Color _kRescheduledColor = Color(0xFFF97316);
const Color _kRouteLineColor = Color(0xFF2D5BFF);
const Color _kGuidanceLineColor = Color(0xFFDC2626);

enum _StopMarkerState { pending, delivered, returned, rescheduled }

String _cleanText(dynamic value) => String.fromCharCodes('$value'.runes).trim();

bool _hasStopValue(dynamic value) {
  final text = _cleanText(value).toLowerCase();
  return text.isNotEmpty && text != 'null' && text != 'none';
}

String _statusToken(dynamic value) {
  if (!_hasStopValue(value)) return '';
  var text = _cleanText(value).toLowerCase();
  const accentMap = {
    0x00E9: 0x65,
    0x00E8: 0x65,
    0x00EA: 0x65,
    0x00EB: 0x65,
    0x00E0: 0x61,
    0x00E2: 0x61,
    0x00F9: 0x75,
    0x00FB: 0x75,
    0x00EE: 0x69,
    0x00EF: 0x69,
    0x00F4: 0x6F,
    0x00E7: 0x63,
  };
  text = String.fromCharCodes(
    text.runes.map((rune) => accentMap[rune] ?? rune),
  );
  return text
      .replaceAll(RegExp(r'[^a-z0-9]+'), '_')
      .replaceAll(RegExp(r'_+'), '_')
      .replaceAll(RegExp(r'^_|_$'), '');
}

int _stopIssueCount(Map<String, dynamic>? stop) {
  if (stop == null) return 0;
  final raw = stop['delivery_issue_count'];
  if (raw is num) return raw.toInt();
  return int.tryParse('$raw') ?? 0;
}

_StopMarkerState _stopMarkerStateFromMap(Map<String, dynamic>? stop) {
  if (stop == null) return _StopMarkerState.pending;

  final tokens = [
    _statusToken(stop['tracking_stage']),
    _statusToken(stop['statut']),
    _statusToken(stop['status']),
    _statusToken(stop['etat']),
  ].where((token) => token.isNotEmpty).toList();

  final hasReturned =
      _hasStopValue(stop['returned_at']) ||
      tokens.any(
        (token) =>
            token.contains('retour') ||
            token.contains('return') ||
            token.contains('refus'),
      );
  if (hasReturned) return _StopMarkerState.returned;

  final hasDelivered =
      _hasStopValue(stop['delivered_at']) ||
      tokens.any(
        (token) =>
            token == 'livre' ||
            token == 'livree' ||
            token == 'delivered' ||
            token == 'delivery_success' ||
            token == 'livraison_confirmee',
      );
  if (hasDelivered) return _StopMarkerState.delivered;

  final hasIssue =
      _hasStopValue(stop['last_delivery_issue_at']) ||
      _stopIssueCount(stop) > 0 ||
      tokens.any(
        (token) =>
            token.contains('non_livre') ||
            token.contains('not_delivered') ||
            token.contains('delivery_failed') ||
            token.contains('failed') ||
            token.contains('echec') ||
            token.contains('relivr') ||
            token.contains('re_livr') ||
            token.contains('report') ||
            token.contains('reschedul'),
      );
  if (hasIssue) return _StopMarkerState.rescheduled;

  return _StopMarkerState.pending;
}

Color _markerColorForStop(_MapStop stop) {
  if (stop.isDepot) return _kDepotColor;

  switch (_stopMarkerStateFromMap(stop.rawStop)) {
    case _StopMarkerState.delivered:
      return _kDeliveredColor;
    case _StopMarkerState.returned:
      return _kReturnedColor;
    case _StopMarkerState.rescheduled:
      return _kRescheduledColor;
    case _StopMarkerState.pending:
      return _kStopDefaultColor;
  }
}

String _stopStatusLabelFromMap(Map<String, dynamic>? stop) {
  switch (_stopMarkerStateFromMap(stop)) {
    case _StopMarkerState.delivered:
      return 'Livree';
    case _StopMarkerState.returned:
      return 'Retour';
    case _StopMarkerState.rescheduled:
      return 'A relivrer';
    case _StopMarkerState.pending:
      return 'En attente';
  }
}

class TourneeMapScreen extends StatefulWidget {
  final Map<String, dynamic> tournee;

  const TourneeMapScreen({super.key, required this.tournee});

  @override
  State<TourneeMapScreen> createState() => _TourneeMapScreenState();
}

class _TourneeMapScreenState extends State<TourneeMapScreen> {
  static const LatLng _defaultCenter = LatLng(36.8065, 10.1815);

  GoogleMapController? _mapController;
  Set<Marker> _markers = {};
  Set<Polyline> _routePolylines = {};
  Set<Polyline> _guidancePolylines = {};
  StreamSubscription<Position>? _positionSub;
  LatLng? _currentLocation;
  bool _canShowCurrentLocation = false;
  int _guidanceRequestId = 0;
  bool _loadingRoute = false;
  bool _loadingMarkers = false;

  // ── Cache of generated BitmapDescriptors ────────────────────────────────────
  final Map<String, BitmapDescriptor> _iconCache = {};

  @override
  void initState() {
    super.initState();
    _rebuildMap();
    unawaited(_startLocationTracking());
  }

  @override
  void didUpdateWidget(covariant TourneeMapScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.tournee, widget.tournee)) {
      _rebuildMap();
    }
  }

  @override
  void dispose() {
    final positionSub = _positionSub;
    if (positionSub != null) {
      unawaited(positionSub.cancel());
    }
    _mapController?.dispose();
    super.dispose();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  double? _toDouble(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }

  String _text(dynamic v) => _cleanText(v);

  List<Map<String, dynamic>> _stopsJson() {
    final raw = widget.tournee['stops'];
    if (raw is! List) return [];
    return raw
        .whereType<Map>()
        .map((item) => item.map((k, v) => MapEntry('$k', v)))
        .toList();
  }

  LatLng? _fallbackDepot() {
    final v =
        '${_text(widget.tournee['depot_depart'])} ${_text(widget.tournee['depot_label'])} ${_text(widget.tournee['depot_adresse'])}'
            .toLowerCase();
    if (v.contains('sousse')) {
      return const LatLng(35.77005959180682, 10.594931528518906);
    }
    if (v.contains('kairouan')) {
      return const LatLng(35.68779123889766, 10.083732874866017);
    }
    return null;
  }

  _MapStop? _depotStop() {
    final lat = _toDouble(widget.tournee['depot_latitude']);
    final lng = _toDouble(widget.tournee['depot_longitude']);
    final pos = (lat != null && lng != null)
        ? LatLng(lat, lng)
        : _fallbackDepot();
    if (pos == null) return null;
    return _MapStop(
      id: 'depot',
      order: 0,
      position: pos,
      label: 'D',
      title: _text(widget.tournee['depot_label']).isNotEmpty
          ? _text(widget.tournee['depot_label'])
          : 'Dépôt',
      subtitle: _text(widget.tournee['depot_adresse']),
      isDepot: true,
    );
  }

  List<_MapStop> _deliveryStops() {
    final stops = _stopsJson();
    final result = <_MapStop>[];

    for (int i = 0; i < stops.length; i++) {
      final stop = stops[i];
      final lat = _toDouble(stop['latitude']);
      final lng = _toDouble(stop['longitude']);
      if (lat == null || lng == null) continue;

      final order = int.tryParse('${stop['ordre'] ?? i + 1}') ?? i + 1;
      final tracking = _text(stop['numero_suivi']);
      final adresse = _text(stop['adresse']).isNotEmpty
          ? _text(stop['adresse'])
          : _text(stop['adresse_livraison']);
      final client = _text(stop['nom_destinataire']);
      final phone = _text(stop['telephone_destinataire']);
      final poids = _text(stop['poids']);
      final statusLabel = _stopStatusLabelFromMap(stop);

      result.add(
        _MapStop(
          id: 'stop_${stop['colis_id'] ?? order}',
          order: order,
          position: LatLng(lat, lng),
          label: '$order',
          title: adresse.isNotEmpty ? adresse : 'Arrêt $order',
          subtitle: [
            statusLabel,
            if (tracking.isNotEmpty) 'Colis $tracking',
            if (client.isNotEmpty) client,
            if (phone.isNotEmpty) phone,
            if (poids.isNotEmpty) '$poids kg',
          ].join(' | '),
          isDepot: false,
          rawStop: stop,
        ),
      );
    }

    result.sort((a, b) => a.order.compareTo(b.order));
    return result;
  }

  List<_MapStop> _allStops() {
    final depot = _depotStop();
    final stops = _deliveryStops();
    if (depot == null) return stops;
    return [depot, ...stops];
  }

  List<LatLng> _pathPoints() => _allStops().map((s) => s.position).toList();

  // ─── Marker icon (Flutter Web + Mobile compatible) ────────────────────────
  //
  // Uses dart:ui canvas directly — works on both platforms.
  // We render a pin: colored circle + number label + stem + anchor dot.
  // Results are cached by label+color to avoid redundant renders.

  Future<BitmapDescriptor> _buildMarkerIcon({
    required String label,
    required Color color,
    required bool isDepot,
  }) async {
    final cacheKey = '$label-${color.toARGB32()}-$isDepot';
    if (_iconCache.containsKey(cacheKey)) return _iconCache[cacheKey]!;

    // Canvas dimensions (logical 36×50, rendered at 3× for retina)
    const double lw = 36.0;
    const double lh = 50.0;
    const double scale = 3.0;
    final double pw = lw * scale;
    final double ph = lh * scale;

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder, Rect.fromLTWH(0, 0, pw, ph));

    // Work in logical coords, let the scale handle the retina
    canvas.scale(scale);

    const double cx = lw / 2; // 18
    const double cy = 18.0; // circle center y
    const double r = 13.5; // circle radius
    const double dotY = 44.0; // anchor dot y
    const double dotR = 4.5;

    // Stem
    canvas.drawLine(
      const Offset(cx, cy + r), // bottom of circle
      const Offset(cx, dotY),
      Paint()
        ..color = const Color(0xFF111827)
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round,
    );

    // Circle fill
    canvas.drawCircle(const Offset(cx, cy), r, Paint()..color = color);

    // Circle white border
    canvas.drawCircle(
      const Offset(cx, cy),
      r,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.0,
    );

    // Anchor dot fill
    canvas.drawCircle(
      const Offset(cx, dotY),
      dotR,
      Paint()..color = const Color(0xFF111827),
    );

    // Anchor dot border
    canvas.drawCircle(
      const Offset(cx, dotY),
      dotR,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );

    // Number label
    final double fs = label.length > 2 ? 9.0 : 13.0;
    final tp = TextPainter(
      text: TextSpan(
        text: label,
        style: TextStyle(
          color: Colors.white,
          fontSize: fs,
          fontWeight: FontWeight.w900,
          height: 1.0,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset(cx - tp.width / 2, cy - tp.height / 2));

    final picture = recorder.endRecording();
    final image = await picture.toImage(pw.toInt(), ph.toInt());
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);

    // size param tells google_maps_flutter the logical pixel size of the icon
    final descriptor = BitmapDescriptor.bytes(
      byteData!.buffer.asUint8List(),
      width: lw,
      height: lh,
    );

    _iconCache[cacheKey] = descriptor;
    return descriptor;
  }

  // ─── Map build ────────────────────────────────────────────────────────────

  Future<void> _rebuildMap() async {
    setState(() {
      _loadingMarkers = true;
      _loadingRoute = true;
      _markers = {};
      _routePolylines = {};
      _guidancePolylines = {};
    });

    await Future.wait([_buildMarkers(), _loadRoutePolyline()]);
    await _loadGuidancePolyline();
  }

  Future<void> _buildMarkers() async {
    final stops = _allStops();
    final result = <Marker>{};

    for (final stop in stops) {
      final color = _markerColorForStop(stop);

      final icon = await _buildMarkerIcon(
        label: stop.label,
        color: color,
        isDepot: stop.isDepot,
      );

      result.add(
        Marker(
          markerId: MarkerId(stop.id),
          position: stop.position,
          icon: icon,
          infoWindow: InfoWindow(
            title: stop.isDepot ? '📦 ${stop.title}' : 'Arrêt ${stop.order}',
            snippet: stop.subtitle.isNotEmpty ? stop.subtitle : stop.title,
          ),
          zIndexInt: stop.isDepot ? 100 : stop.order,
        ),
      );
    }

    if (!mounted) return;
    setState(() {
      _markers = result;
      _loadingMarkers = false;
    });
  }

  // ─── OSRM route ───────────────────────────────────────────────────────────

  Future<bool> _ensureLocationPermission() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return false;

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    final allowed =
        permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;

    if (mounted && _canShowCurrentLocation != allowed) {
      setState(() => _canShowCurrentLocation = allowed);
    }

    return allowed;
  }

  Future<void> _startLocationTracking() async {
    final allowed = await _ensureLocationPermission();
    if (!allowed || !mounted) return;

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 8),
        ),
      );
      _applyCurrentPosition(position);
    } catch (e) {
      debugPrint('Tournee map GPS: $e');
    }

    await _positionSub?.cancel();
    _positionSub =
        Geolocator.getPositionStream(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: 15,
          ),
        ).listen(
          _applyCurrentPosition,
          onError: (Object e) => debugPrint('Tournee map GPS stream: $e'),
        );
  }

  void _applyCurrentPosition(Position position) {
    if (!mounted) return;
    setState(() {
      _currentLocation = LatLng(position.latitude, position.longitude);
    });
    unawaited(_loadGuidancePolyline());
  }

  _MapStop? _nextGuidanceStop() {
    for (final stop in _deliveryStops()) {
      final state = _stopMarkerStateFromMap(stop.rawStop);
      if (state != _StopMarkerState.delivered &&
          state != _StopMarkerState.returned) {
        return stop;
      }
    }
    return null;
  }

  List<List<LatLng>> _buildSegments(List<LatLng> points) {
    const int maxPerSegment = 25;
    if (points.length < 2) return [];
    final segments = <List<LatLng>>[];
    var start = 0;
    while (start < points.length - 1) {
      final end = math.min(points.length - 1, start + maxPerSegment - 1);
      segments.add(points.sublist(start, end + 1));
      start = end;
    }
    return segments;
  }

  Future<List<LatLng>> _fetchOsrmRoute(List<LatLng> points) async {
    final segments = _buildSegments(points);
    final fullRoute = <LatLng>[];

    for (final segment in segments) {
      final coords = segment
          .map((p) => '${p.longitude},${p.latitude}')
          .join(';');

      final uri = Uri.parse(
        'https://router.project-osrm.org/route/v1/driving/$coords'
        '?overview=full&geometries=geojson&steps=false',
      );

      final resp = await http.get(uri).timeout(const Duration(seconds: 20));
      if (resp.statusCode != 200) throw Exception('OSRM ${resp.statusCode}');

      final data = jsonDecode(resp.body) as Map<String, dynamic>;
      final coords2 = data['routes']?[0]?['geometry']?['coordinates'] as List?;
      if (coords2 == null || coords2.isEmpty) throw Exception('No geometry');

      final segPts = coords2
          .whereType<List>()
          .where((c) => c.length >= 2)
          .map(
            (c) => LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble()),
          )
          .toList();

      if (segPts.isEmpty) throw Exception('Empty segment');
      if (fullRoute.isNotEmpty) segPts.removeAt(0);
      fullRoute.addAll(segPts);
    }

    return fullRoute;
  }

  Future<void> _loadRoutePolyline() async {
    final points = _pathPoints();
    if (points.length < 2) {
      if (mounted) {
        setState(() {
          _routePolylines = {};
          _loadingRoute = false;
        });
      }
      return;
    }

    try {
      final osrmPts = await _fetchOsrmRoute(points);
      if (!mounted) return;
      setState(() {
        _routePolylines = {
          Polyline(
            polylineId: const PolylineId('road_route'),
            points: osrmPts,
            width: 5,
            color: _kRouteLineColor,
            geodesic: true,
            patterns: [],
            zIndex: 5,
          ),
        };
        _loadingRoute = false;
      });
    } catch (_) {
      if (!mounted) return;
      // Fallback: straight lines
      setState(() {
        _routePolylines = {
          Polyline(
            polylineId: const PolylineId('direct_route'),
            points: points,
            width: 4,
            color: _kRouteLineColor.withValues(alpha: 0.65),
            geodesic: true,
            zIndex: 5,
          ),
        };
        _loadingRoute = false;
      });
    }
  }

  // --- Live guidance route --------------------------------------------------
  Future<void> _loadGuidancePolyline() async {
    final requestId = ++_guidanceRequestId;
    final current = _currentLocation;
    final target = _nextGuidanceStop();

    if (current == null || target == null) {
      if (!mounted) return;
      setState(() => _guidancePolylines = {});
      return;
    }

    final directPoints = [current, target.position];

    try {
      final roadPoints = await _fetchOsrmRoute(directPoints);
      if (!mounted || requestId != _guidanceRequestId) return;
      setState(() {
        _guidancePolylines = {
          Polyline(
            polylineId: const PolylineId('guidance_route'),
            points: roadPoints,
            width: 6,
            color: _kGuidanceLineColor,
            geodesic: true,
            zIndex: 20,
          ),
        };
      });
    } catch (_) {
      if (!mounted || requestId != _guidanceRequestId) return;
      setState(() {
        _guidancePolylines = {
          Polyline(
            polylineId: const PolylineId('guidance_direct'),
            points: directPoints,
            width: 5,
            color: _kGuidanceLineColor.withValues(alpha: 0.82),
            geodesic: true,
            zIndex: 20,
          ),
        };
      });
    }
  }

  // --- Camera ---------------------------------------------------------------
  LatLngBounds _bounds(List<LatLng> pts) {
    var minLat = pts.first.latitude, maxLat = pts.first.latitude;
    var minLng = pts.first.longitude, maxLng = pts.first.longitude;
    for (final p in pts) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
    }
    return LatLngBounds(
      southwest: LatLng(minLat, minLng),
      northeast: LatLng(maxLat, maxLng),
    );
  }

  Future<void> _fitMap() async {
    final ctrl = _mapController;
    final pts = _pathPoints();
    if (ctrl == null || pts.isEmpty) return;
    await Future.delayed(const Duration(milliseconds: 400));
    if (!mounted) return;
    if (pts.length == 1) {
      await ctrl.animateCamera(CameraUpdate.newLatLngZoom(pts.first, 14));
    } else {
      await ctrl.animateCamera(CameraUpdate.newLatLngBounds(_bounds(pts), 72));
    }
  }

  // ─── Google Maps navigation ───────────────────────────────────────────────

  Future<void> _openGoogleMaps() async {
    final pts = _pathPoints();
    if (pts.length < 2) return;

    final origin = '${pts.first.latitude},${pts.first.longitude}';
    final destination = '${pts.last.latitude},${pts.last.longitude}';
    final waypoints = pts.length > 2
        ? pts
              .sublist(1, pts.length - 1)
              .take(23)
              .map((p) => '${p.latitude},${p.longitude}')
              .join('|')
        : '';

    final params = {
      'api': '1',
      'origin': origin,
      'destination': destination,
      'travelmode': 'driving',
      if (waypoints.isNotEmpty) 'waypoints': waypoints,
    };

    final uri = Uri.https('www.google.com', '/maps/dir/', params);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final tourneeName = _text(widget.tournee['nom']).isNotEmpty
        ? _text(widget.tournee['nom'])
        : 'Tournée';
    final deliveryStops = _deliveryStops();
    final stopCount = deliveryStops.length;
    final pts = _pathPoints();
    final initialPos = pts.isNotEmpty ? pts.first : _defaultCenter;
    final isLoading = _loadingMarkers || _loadingRoute;

    return Scaffold(
      backgroundColor: isDark
          ? const Color(0xFF080E1A)
          : const Color(0xFFF2F4F9),
      body: SafeArea(
        child: Stack(
          children: [
            // ── Map ────────────────────────────────────────────────────────
            Positioned.fill(
              child: ClipRRect(
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(0),
                  topRight: Radius.circular(0),
                ),
                child: GoogleMap(
                  initialCameraPosition: CameraPosition(
                    target: initialPos,
                    zoom: pts.isNotEmpty ? 10 : 7,
                  ),
                  markers: _markers,
                  polylines: {..._routePolylines, ..._guidancePolylines},
                  mapType: MapType.normal,
                  zoomControlsEnabled: false,
                  myLocationEnabled: _canShowCurrentLocation,
                  myLocationButtonEnabled: false,
                  compassEnabled: true,
                  onMapCreated: (ctrl) {
                    _mapController = ctrl;
                    _fitMap();
                  },
                ),
              ),
            ),

            // ── MZ Header ─────────────────────────────────────────────────
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(20, 18, 16, 22),
                decoration: BoxDecoration(
                  color: _kNavy,
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(28),
                    bottomRight: Radius.circular(28),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: _kNavy.withValues(alpha: 0.30),
                      blurRadius: 22,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
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
                          constraints: const BoxConstraints(
                            minWidth: 36,
                            minHeight: 36,
                          ),
                        ),
                        const Expanded(
                          child: Text(
                            'Carte tournée',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        const ThemeIconButton(),
                        const SizedBox(width: 6),
                        _HeaderIconButton(
                          icon: Icons.center_focus_strong_rounded,
                          onTap: _fitMap,
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Row(
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            color: _kAmber.withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: _kAmber.withValues(alpha: 0.35),
                            ),
                          ),
                          child: const Icon(
                            Icons.route_rounded,
                            color: _kAmber,
                            size: 25,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                tourneeName,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 17,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.2,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 5,
                                ),
                                decoration: BoxDecoration(
                                  color: _kAmber.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: _kAmber.withValues(alpha: 0.4),
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: const BoxDecoration(
                                        color: _kAmber,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 5),
                                    Text(
                                      '$stopCount arrêt${stopCount > 1 ? 's' : ''} sur la carte',
                                      style: const TextStyle(
                                        color: _kAmber,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
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
                  ],
                ),
              ),
            ),

            // ── Loading overlay ────────────────────────────────────────────
            if (isLoading)
              Positioned(
                top: 146,
                left: 18,
                right: 18,
                child: _LoadingBanner(
                  isDark: isDark,
                  text: _loadingMarkers
                      ? 'Création des marqueurs...'
                      : 'Calcul du trajet routier...',
                ),
              ),

            // ── Legend + stop count pill ───────────────────────────────────
            if (!isLoading && stopCount > 0)
              Positioned(
                top: 146,
                right: 18,
                child: _LegendPill(isDark: isDark, stopCount: stopCount),
              ),

            // ── Bottom card ───────────────────────────────────────────────
            Positioned(
              left: 12,
              right: 12,
              bottom: 12,
              child: _BottomCard(
                isDark: isDark,
                tourneeName: tourneeName,
                stopCount: stopCount,
                stops: deliveryStops,
                canNavigate: pts.length >= 2,
                onOpenMaps: _openGoogleMaps,
                onFitMap: _fitMap,
                onStopTap: (stop) => _focusStop(stop),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _focusStop(_MapStop stop) {
    _mapController?.animateCamera(
      CameraUpdate.newLatLngZoom(stop.position, 16),
    );
  }
}

// ─── Header/loading/legend widgets ───────────────────────────────────────────

class _HeaderIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;

  const _HeaderIconButton({required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: onTap == null ? 0.05 : 0.10),
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: Colors.white24),
        ),
        child: Icon(
          icon,
          color: Colors.white.withValues(alpha: onTap == null ? 0.3 : 1.0),
          size: 20,
        ),
      ),
    );
  }
}

class _LoadingBanner extends StatelessWidget {
  final bool isDark;
  final String text;

  const _LoadingBanner({required this.isDark, required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.07)
              : const Color(0xFFE4E9F4),
        ),
        boxShadow: [
          BoxShadow(
            color: _kNavy.withValues(alpha: isDark ? 0.18 : 0.08),
            blurRadius: 16,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Row(
        children: [
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2.5, color: _kAmber),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 13,
                color: isDark ? Colors.white70 : _kNavy.withValues(alpha: 0.75),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LegendPill extends StatelessWidget {
  final bool isDark;
  final int stopCount;

  const _LegendPill({required this.isDark, required this.stopCount});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F1B2D) : Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.07)
              : const Color(0xFFE4E9F4),
        ),
        boxShadow: [
          BoxShadow(
            color: _kNavy.withValues(alpha: isDark ? 0.18 : 0.08),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 9,
            height: 9,
            decoration: const BoxDecoration(
              color: _kAmber,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 7),
          Text(
            '$stopCount arrêt${stopCount > 1 ? 's' : ''}',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: isDark ? Colors.white : _kNavy,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Bottom card ──────────────────────────────────────────────────────────────

class _BottomCard extends StatefulWidget {
  final bool isDark;
  final String tourneeName;
  final int stopCount;
  final List<_MapStop> stops;
  final bool canNavigate;
  final VoidCallback onOpenMaps;
  final VoidCallback onFitMap;
  final void Function(_MapStop) onStopTap;

  const _BottomCard({
    required this.isDark,
    required this.tourneeName,
    required this.stopCount,
    required this.stops,
    required this.canNavigate,
    required this.onOpenMaps,
    required this.onFitMap,
    required this.onStopTap,
  });

  @override
  State<_BottomCard> createState() => _BottomCardState();
}

class _BottomCardState extends State<_BottomCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeInOut,
      constraints: BoxConstraints(maxHeight: _expanded ? 480 : 200),
      child: Material(
        elevation: 0,
        borderRadius: BorderRadius.circular(22),
        color: widget.isDark ? const Color(0xFF0F1B2D) : Colors.white,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Header ──────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 12, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.tourneeName,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: widget.isDark ? Colors.white : _kNavy,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '${widget.stopCount} arrêt${widget.stopCount > 1 ? 's' : ''} sur la carte',
                          style: TextStyle(
                            fontSize: 12,
                            color: widget.isDark ? Colors.white54 : _kGrey,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Expand/collapse toggle
                  if (widget.stops.isNotEmpty)
                    IconButton(
                      icon: AnimatedRotation(
                        turns: _expanded ? 0.5 : 0.0,
                        duration: const Duration(milliseconds: 280),
                        child: Icon(
                          Icons.keyboard_arrow_up_rounded,
                          color: widget.isDark ? Colors.white54 : _kGrey,
                        ),
                      ),
                      onPressed: () => setState(() => _expanded = !_expanded),
                    ),
                ],
              ),
            ),

            // ── Stop list (when expanded) ────────────────────────────────
            if (_expanded && widget.stops.isNotEmpty)
              Flexible(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: ListView.separated(
                    padding: const EdgeInsets.only(top: 8, bottom: 4),
                    shrinkWrap: true,
                    itemCount: widget.stops.length,
                    separatorBuilder: (context, index) =>
                        const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final stop = widget.stops[index];
                      final color = _markerColorForStop(stop);

                      return InkWell(
                        onTap: () => widget.onStopTap(stop),
                        borderRadius: BorderRadius.circular(10),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            vertical: 8,
                            horizontal: 4,
                          ),
                          child: Row(
                            children: [
                              // Numbered circle
                              Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  color: color,
                                  shape: BoxShape.circle,
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  stop.label,
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: stop.label.length > 2 ? 9 : 12,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      stop.title,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: widget.isDark
                                            ? Colors.white
                                            : _kNavy,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    if (stop.subtitle.isNotEmpty)
                                      Text(
                                        stop.subtitle,
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: widget.isDark
                                              ? Colors.white54
                                              : _kGrey,
                                          fontWeight: FontWeight.w500,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                  ],
                                ),
                              ),
                              Icon(
                                Icons.my_location_rounded,
                                size: 16,
                                color: widget.isDark
                                    ? Colors.white38
                                    : const Color(0xFF9CA3AF),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),

            // ── Action buttons ───────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 14),
              child: Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: widget.canNavigate ? widget.onOpenMaps : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _kNavy,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      icon: const Icon(Icons.navigation_rounded, size: 18),
                      label: const Text(
                        'Ouvrir Google Maps',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Material(
                    color: widget.isDark
                        ? Colors.white.withValues(alpha: 0.06)
                        : const Color(0xFFF6F8FD),
                    borderRadius: BorderRadius.circular(14),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: widget.onFitMap,
                      child: const Padding(
                        padding: EdgeInsets.all(13),
                        child: Icon(
                          Icons.center_focus_strong_rounded,
                          color: Color(0xFF374151),
                          size: 22,
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
    );
  }
}

// ─── Data model ───────────────────────────────────────────────────────────────

class _MapStop {
  final String id;
  final int order;
  final LatLng position;
  final String label;
  final String title;
  final String subtitle;
  final bool isDepot;
  final Map<String, dynamic>? rawStop;

  const _MapStop({
    required this.id,
    required this.order,
    required this.position,
    required this.label,
    required this.title,
    required this.subtitle,
    required this.isDepot,
    this.rawStop,
  });
}
