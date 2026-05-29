import 'package:flutter_test/flutter_test.dart';
import 'package:mz_livreur_app/core/parcel_deep_link.dart';

void main() {
  const knownRoutes = {'/home', '/scan', '/colis-action'};

  group('parcel deep links', () {
    test('extracts colis codes from plain values and links', () {
      expect(extractParcelCode('123456789012'), '123456789012');
      expect(
        extractParcelCode('mzlivreur://mz-logistic/colis-action?code=ABC123'),
        'ABC123',
      );
      expect(
        extractParcelCode('mzlivreur://mz-logistic/colis/ABC123'),
        'ABC123',
      );
      expect(extractParcelCode('mzlivreur://colis/ABC123'), 'ABC123');
    });

    test('normalizes external links to app routes', () {
      expect(
        normalizeCourierRoute(
          'mzlivreur://mz-logistic/colis-action?code=ABC123',
          knownRoutes: knownRoutes,
        ),
        '/colis-action?code=ABC123',
      );
      expect(
        normalizeCourierRoute(
          'mzlivreur://mz-logistic/scan?barcode=ABC123',
          knownRoutes: knownRoutes,
        ),
        '/scan?code=ABC123',
      );
      expect(
        normalizeCourierRoute('/colis/ABC123', knownRoutes: knownRoutes),
        '/colis-action?code=ABC123',
      );
    });
  });
}
