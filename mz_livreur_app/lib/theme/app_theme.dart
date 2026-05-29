import 'package:flutter/material.dart';

class AppTheme {
  static ThemeData light() {
    return _buildTheme(
      brightness: Brightness.light,
      seed: const Color(0xFF8256F6),
      scaffoldBg: Colors.white,
      panel: Colors.white,
      text: const Color(0xFF1B1D27),
      muted: const Color(0xFF8C90A3),
      inputBg: const Color(0xFFF7F8FC),
      divider: const Color(0xFFE1E6F0),
      appBarBg: Colors.white,
    );
  }

  static ThemeData dark() {
    return _buildTheme(
      brightness: Brightness.dark,
      seed: const Color(0xFF8B5CF6),
      scaffoldBg: const Color(0xFF0B1120),
      panel: const Color(0xFF131C2F),
      text: const Color(0xFFF2F4FB),
      muted: const Color(0xFFA7B0C8),
      inputBg: const Color(0xFF1A2438),
      divider: const Color(0xFF273149),
      appBarBg: const Color(0xFF0B1120),
    );
  }

  static ThemeData _buildTheme({
    required Brightness brightness,
    required Color seed,
    required Color scaffoldBg,
    required Color panel,
    required Color text,
    required Color muted,
    required Color inputBg,
    required Color divider,
    required Color appBarBg,
  }) {
    final scheme = ColorScheme.fromSeed(
      seedColor: seed,
      brightness: brightness,
    );

    OutlineInputBorder border(Color color) => OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide(color: color, width: 1),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: scaffoldBg,
      dividerColor: divider,
      appBarTheme: AppBarTheme(
        backgroundColor: appBarBg,
        foregroundColor: text,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: text,
          fontSize: 18,
          fontWeight: FontWeight.w900,
        ),
      ),
      cardTheme: CardThemeData(
        color: panel,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: divider),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: panel,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: panel,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
      ),
      textTheme: TextTheme(
        titleLarge: TextStyle(color: text, fontWeight: FontWeight.w900),
        titleMedium: TextStyle(color: text, fontWeight: FontWeight.w900),
        bodyLarge: TextStyle(color: text),
        bodyMedium: TextStyle(color: text),
        labelLarge: TextStyle(color: text, fontWeight: FontWeight.w800),
        bodySmall: TextStyle(color: muted),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: inputBg,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 14,
        ),
        labelStyle: TextStyle(color: muted, fontWeight: FontWeight.w700),
        hintStyle: TextStyle(color: muted.withValues(alpha: 0.72)),
        border: border(divider),
        enabledBorder: border(divider),
        focusedBorder: border(seed.withValues(alpha: 0.7)),
        errorBorder: border(const Color(0xCCFF6D6D)),
        focusedErrorBorder: border(const Color(0xFFFF6D6D)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: seed,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w900),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: text,
          side: BorderSide(color: divider),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: seed,
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
    );
  }
}
