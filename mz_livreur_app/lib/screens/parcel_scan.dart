// lib/screens/parcel_scan.dart
// ✅ Design MZ Logistic — Navy + Amber
// ✅ Camera scanner conservée
// ✅ Logique originale conservée

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../core/parcel_deep_link.dart';
import '../widgets/global_theme_toggle.dart';

const _kNavy = Color(0xFF1A2B4A);
const _kAmber = Color(0xFFF59E0B);
const _kGrey = Color(0xFF6B7280);

class ParcelScanScreen extends StatefulWidget {
  const ParcelScanScreen({super.key, this.initialCode});

  final String? initialCode;

  @override
  State<ParcelScanScreen> createState() => _ParcelScanScreenState();
}

class _ParcelScanScreenState extends State<ParcelScanScreen> {
  final MobileScannerController _scannerController = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    facing: CameraFacing.back,
  );
  final TextEditingController _manualController = TextEditingController();

  Timer? _manualOpenTimer;
  bool _scanEnabled = true;
  bool _opening = false;
  bool _torchEnabled = false;
  String _message = '';

  @override
  void initState() {
    super.initState();
    final initialCode = _extractScanCode(widget.initialCode);
    if (initialCode.isNotEmpty) {
      _manualController.text = initialCode;
      _scanEnabled = false;
      Future.microtask(() async {
        await _scannerController.stop();
        await _openParcel(initialCode, replace: true);
      });
    }
  }

  @override
  void dispose() {
    _manualOpenTimer?.cancel();
    _scannerController.dispose();
    _manualController.dispose();
    super.dispose();
  }

  String _extractScanCode(String? rawValue) {
    return extractParcelCode(rawValue);
  }

  bool _isCompleteManualCode(String code) => RegExp(r'^\d{12}$').hasMatch(code);

  void _handleManualCodeChanged(String value) {
    final code = _extractScanCode(value);
    _manualOpenTimer?.cancel();

    setState(() {
      _message = code.isEmpty
          ? ''
          : _isCompleteManualCode(code)
          ? 'Code complet. Ouverture du colis...'
          : 'Complète le code ou scanne le QR.';
    });

    if (!_isCompleteManualCode(code)) return;

    _manualOpenTimer = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      final latestCode = _extractScanCode(_manualController.text);
      if (latestCode == code) _openParcel(code, replace: true);
    });
  }

  Future<void> _captureCode(String rawValue) async {
    if (!_scanEnabled || _opening) return;

    final code = _extractScanCode(rawValue);
    if (code.isEmpty) return;

    _manualOpenTimer?.cancel();
    await _scannerController.stop();
    if (!mounted) return;

    setState(() {
      _scanEnabled = false;
      _manualController.text = code;
      _message = 'QR lu. Ouverture du colis...';
    });

    await _openParcel(code, replace: true);
  }

  Future<void> _openParcel(String rawCode, {bool replace = false}) async {
    final code = _extractScanCode(rawCode);
    if (code.isEmpty || _opening) return;

    setState(() {
      _opening = true;
      _message = 'Ouverture du colis...';
    });

    final route = parcelDetailsRouteForCode(code);
    if (!mounted) return;
    if (replace) {
      Navigator.pushReplacementNamed(context, route, arguments: {'code': code});
    } else {
      Navigator.pushNamed(context, route, arguments: {'code': code});
    }
  }

  Future<void> _scanAgain() async {
    _manualOpenTimer?.cancel();
    await _scannerController.start();
    if (!mounted) return;
    setState(() {
      _scanEnabled = true;
      _opening = false;
      _message = '';
      _manualController.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currentCode = _extractScanCode(_manualController.text);
    final canOpen = currentCode.isNotEmpty && !_opening;

    return Scaffold(
      backgroundColor: isDark
          ? const Color(0xFF080E1A)
          : const Color(0xFFF2F4F9),
      body: SafeArea(
        child: Column(
          children: [
            _Header(
              isDark: isDark,
              torchEnabled: _torchEnabled,
              onBack: () => Navigator.pop(context),
              onToggleTheme: null,
              onToggleTorch: () async {
                final next = !_torchEnabled;
                await _scannerController.toggleTorch();
                if (!mounted) return;
                setState(() => _torchEnabled = next);
              },
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 20, 18, 28),
                children: [
                  _IntroCard(isDark: isDark),
                  const SizedBox(height: 16),
                  _ScannerCard(
                    isDark: isDark,
                    scannerController: _scannerController,
                    manualController: _manualController,
                    scanEnabled: _scanEnabled,
                    opening: _opening,
                    torchEnabled: _torchEnabled,
                    canOpen: canOpen,
                    onDetect: _captureCode,
                    onChanged: _handleManualCodeChanged,
                    onSubmitted: (value) => _openParcel(value, replace: true),
                    onOpen: () => _openParcel(currentCode, replace: true),
                    onReset: _scanAgain,
                    onToggleTorch: () async {
                      final next = !_torchEnabled;
                      await _scannerController.toggleTorch();
                      if (!mounted) return;
                      setState(() => _torchEnabled = next);
                    },
                  ),
                  if (_message.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _MsgBanner(message: _message, isDark: isDark),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final bool isDark;
  final bool torchEnabled;
  final VoidCallback onBack;
  final VoidCallback? onToggleTheme;
  final VoidCallback onToggleTorch;

  const _Header({
    required this.isDark,
    required this.torchEnabled,
    required this.onBack,
    required this.onToggleTheme,
    required this.onToggleTorch,
  });

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
            color: _kNavy.withOpacity(0.30),
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
                onPressed: onBack,
                icon: const Icon(
                  Icons.arrow_back_ios_new_rounded,
                  color: Colors.white,
                  size: 20,
                ),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
              ),
              const Expanded(
                child: Text(
                  'Scanner colis',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const ThemeIconButton(),
              const SizedBox(width: 6),
              GestureDetector(
                onTap: onToggleTorch,
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: torchEnabled
                        ? _kAmber
                        : Colors.white.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(13),
                    border: Border.all(
                      color: torchEnabled ? _kAmber : Colors.white24,
                    ),
                  ),
                  child: Icon(
                    torchEnabled
                        ? Icons.flash_on_rounded
                        : Icons.flash_off_rounded,
                    color: torchEnabled ? _kNavy : Colors.white,
                    size: 20,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
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
                  Icons.qr_code_scanner_rounded,
                  color: _kAmber,
                  size: 25,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Scanner le QR',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Ouvre la fiche du colis et change son statut.',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.58),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
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

class _IntroCard extends StatelessWidget {
  final bool isDark;
  const _IntroCard({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      isDark: isDark,
      title: 'Scanner le QR',
      child: Text(
        'Scanne le QR du bon de livraison pour ouvrir la fiche du colis et changer son statut.',
        style: TextStyle(
          fontSize: 13,
          color: isDark ? Colors.white54 : _kGrey,
          height: 1.5,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _ScannerCard extends StatelessWidget {
  final bool isDark;
  final MobileScannerController scannerController;
  final TextEditingController manualController;
  final bool scanEnabled;
  final bool opening;
  final bool torchEnabled;
  final bool canOpen;
  final void Function(String) onDetect;
  final void Function(String) onChanged;
  final void Function(String) onSubmitted;
  final VoidCallback onOpen;
  final VoidCallback onReset;
  final VoidCallback onToggleTorch;

  const _ScannerCard({
    required this.isDark,
    required this.scannerController,
    required this.manualController,
    required this.scanEnabled,
    required this.opening,
    required this.torchEnabled,
    required this.canOpen,
    required this.onDetect,
    required this.onChanged,
    required this.onSubmitted,
    required this.onOpen,
    required this.onReset,
    required this.onToggleTorch,
  });

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      isDark: isDark,
      title: 'Camera',
      trailing: GestureDetector(
        onTap: onToggleTorch,
        child: Icon(
          torchEnabled ? Icons.flash_on_rounded : Icons.flash_off_rounded,
          color: torchEnabled ? _kAmber : (isDark ? Colors.white54 : _kGrey),
          size: 22,
        ),
      ),
      child: Column(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: SizedBox(
              height: 280,
              width: double.infinity,
              child: Stack(
                children: [
                  MobileScanner(
                    controller: scannerController,
                    fit: BoxFit.cover,
                    onDetect: (capture) {
                      final raw = capture.barcodes.isNotEmpty
                          ? capture.barcodes.first.rawValue ?? ''
                          : '';
                      onDetect(raw);
                    },
                  ),
                  Positioned.fill(
                    child: IgnorePointer(
                      child: Container(
                        margin: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: _kAmber, width: 2),
                        ),
                      ),
                    ),
                  ),
                  Positioned.fill(
                    child: IgnorePointer(
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(18),
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.black.withOpacity(0.15),
                              Colors.transparent,
                              Colors.black.withOpacity(0.15),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (!scanEnabled || opening)
                    Positioned.fill(
                      child: Container(
                        color: Colors.black.withOpacity(0.58),
                        alignment: Alignment.center,
                        padding: const EdgeInsets.all(18),
                        child: Text(
                          opening ? 'Ouverture...' : 'QR lu',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: manualController,
            textInputAction: TextInputAction.done,
            keyboardType: TextInputType.number,
            onChanged: onChanged,
            onSubmitted: onSubmitted,
            style: TextStyle(
              color: isDark ? Colors.white : _kNavy,
              fontWeight: FontWeight.w700,
            ),
            decoration: InputDecoration(
              labelText: 'QR ou code colis',
              hintText: 'Scanner ou saisir le code',
              prefixIcon: const Icon(Icons.qr_code_2_rounded, color: _kAmber),
              labelStyle: TextStyle(
                color: isDark ? Colors.white54 : _kGrey,
                fontWeight: FontWeight.w600,
              ),
              filled: true,
              fillColor: isDark
                  ? Colors.white.withOpacity(0.04)
                  : const Color(0xFFF6F8FD),
              contentPadding: const EdgeInsets.symmetric(
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
                borderSide: const BorderSide(color: _kAmber, width: 1.8),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 52,
                  child: ElevatedButton.icon(
                    onPressed: canOpen ? onOpen : null,
                    icon: opening
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.open_in_new_rounded, size: 18),
                    label: Text(opening ? 'Ouverture...' : 'Ouvrir'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _kNavy,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: _kNavy.withOpacity(0.35),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      textStyle: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              SizedBox(
                height: 52,
                child: OutlinedButton.icon(
                  onPressed: onReset,
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('Reset'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: isDark ? Colors.white70 : _kNavy,
                    side: BorderSide(
                      color: isDark ? Colors.white24 : _kNavy.withOpacity(0.25),
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    textStyle: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final bool isDark;
  final String title;
  final Widget child;
  final Widget? trailing;

  const _SectionCard({
    required this.isDark,
    required this.title,
    required this.child,
    this.trailing,
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
            color: _kNavy.withOpacity(isDark ? 0.18 : 0.05),
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
                  color: _kAmber,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    color: isDark ? Colors.white : _kNavy,
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

class _MsgBanner extends StatelessWidget {
  final String message;
  final bool isDark;

  const _MsgBanner({required this.message, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: _kAmber.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _kAmber.withOpacity(0.30)),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline_rounded, color: _kAmber, size: 18),
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
