import 'package:flutter/material.dart';

import '../theme/theme_controller.dart';

class ThemeIconButton extends StatelessWidget {
  const ThemeIconButton({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = ThemeController.of(context);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return IconButton(
      tooltip: isDark ? 'Activer le mode clair' : 'Activer le mode sombre',
      onPressed: controller.toggle,
      icon: Icon(
        isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
        color: theme.colorScheme.primary,
      ),
    );
  }
}

class ThemeChipButton extends StatelessWidget {
  const ThemeChipButton({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = ThemeController.of(context);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: controller.toggle,
        borderRadius: BorderRadius.circular(999),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: theme.dividerColor),
            boxShadow: [
              BoxShadow(
                color:
                    isDark ? const Color(0x33000000) : const Color(0x1F0D1530),
                blurRadius: 18,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
                size: 18,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(width: 8),
              Text(
                isDark ? 'Clair' : 'Sombre',
                style: theme.textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
