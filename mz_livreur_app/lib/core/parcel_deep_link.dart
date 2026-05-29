const parcelDeepLinkScheme = 'mzlivreur';
const parcelDeepLinkHost = 'mz-logistic';
const parcelDetailRoute = '/colis-action';
const parcelScanRoute = '/scan';

const _codeKeys = ['code', 'barcode', 'barcode_value', 'numero_suivi'];
const _scanAliases = {
  'scan',
  'scan-pickup',
  'scan-warehouse',
  'scan-route-progress',
};
const _detailAliases = {
  'colis',
  'colis-action',
  'colis-details',
  'colis-detail',
  'parcel',
  'parcels',
};

enum ParcelLinkTarget { scan, details }

String extractParcelCode(String? rawValue) {
  final raw = (rawValue ?? '').trim();
  if (raw.isEmpty) return '';

  final uri = Uri.tryParse(raw);
  if (uri == null) return raw;

  final queryCode = _codeFromQuery(uri);
  if (queryCode.isNotEmpty) return queryCode;

  final pathCode = _codeFromPath(uri);
  if (pathCode.isNotEmpty) return pathCode;

  if (uri.hasScheme || raw.startsWith('/')) return '';
  return raw;
}

String normalizeCourierRoute(
  String rawRoute, {
  required Set<String> knownRoutes,
  String fallbackRoute = '/home',
}) {
  final raw = rawRoute.trim();
  if (raw.isEmpty) return fallbackRoute;

  final target = parcelLinkTarget(raw);
  if (target == ParcelLinkTarget.scan) {
    final code = extractParcelCode(raw);
    return code.isEmpty
        ? parcelScanRoute
        : '$parcelScanRoute?code=${Uri.encodeQueryComponent(code)}';
  }

  if (target == ParcelLinkTarget.details) {
    final code = extractParcelCode(raw);
    return code.isEmpty
        ? parcelDetailRoute
        : '$parcelDetailRoute?code=${Uri.encodeQueryComponent(code)}';
  }

  final uri = Uri.tryParse(raw);
  final path = uri?.path ?? raw.split('?').first;
  if (knownRoutes.contains(raw) || knownRoutes.contains(path)) return raw;

  return fallbackRoute;
}

ParcelLinkTarget? parcelLinkTarget(String rawValue) {
  final raw = rawValue.trim();
  if (raw.isEmpty) return null;

  final uri = Uri.tryParse(raw);
  if (uri == null) return null;

  final host = uri.host.toLowerCase();
  final firstSegment = _firstPathSegment(uri);

  if (uri.hasScheme && uri.scheme != parcelDeepLinkScheme) {
    return _targetFromSegment(firstSegment);
  }

  if (uri.scheme == parcelDeepLinkScheme) {
    final hostTarget = _targetFromSegment(host);
    if (hostTarget != null) return hostTarget;
    if (host == parcelDeepLinkHost) return _targetFromSegment(firstSegment);
  }

  if (!uri.hasScheme || raw.startsWith('/')) {
    return _targetFromSegment(firstSegment);
  }

  return null;
}

String parcelDetailsRouteForCode(String code) {
  final cleanCode = extractParcelCode(code);
  return cleanCode.isEmpty
      ? parcelDetailRoute
      : '$parcelDetailRoute?code=${Uri.encodeQueryComponent(cleanCode)}';
}

String _codeFromQuery(Uri uri) {
  for (final key in _codeKeys) {
    final value = uri.queryParameters[key]?.trim();
    if (value != null && value.isNotEmpty) return value;
  }
  return '';
}

String _codeFromPath(Uri uri) {
  final segments = uri.pathSegments
      .map(Uri.decodeComponent)
      .map((segment) => segment.trim())
      .where((segment) => segment.isNotEmpty)
      .toList(growable: false);
  if (segments.isEmpty) return '';

  final host = uri.host.toLowerCase();
  if (_scanAliases.contains(host) || _detailAliases.contains(host)) {
    return segments.last;
  }

  final first = segments.first.toLowerCase();
  if ((_scanAliases.contains(first) || _detailAliases.contains(first)) &&
      segments.length > 1) {
    return segments.last;
  }

  return '';
}

String _firstPathSegment(Uri uri) {
  if (uri.pathSegments.isEmpty) return '';
  return Uri.decodeComponent(uri.pathSegments.first).trim().toLowerCase();
}

ParcelLinkTarget? _targetFromSegment(String segment) {
  final lower = segment.toLowerCase();
  if (_scanAliases.contains(lower)) return ParcelLinkTarget.scan;
  if (_detailAliases.contains(lower)) return ParcelLinkTarget.details;
  return null;
}
