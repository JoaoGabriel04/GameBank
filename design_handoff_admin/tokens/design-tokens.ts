/**
 * Design Tokens - Admin Console
 * Use estes valores em seu design system e CSS
 */

// ============================================================================
// CORES
// ============================================================================

export const colors = {
  // Primária (Ciano/Teal)
  primary: "#06B6D4", // cyan-500
  primaryLight: "#22D3EE", // cyan-400
  primaryDark: "#0891B2", // cyan-600

  // Backgrounds
  bg: "#09090B", // zinc-950
  surface: "#18181B", // zinc-900
  surfaceLight: "#27272A", // zinc-800

  // Borders
  border: "#27272A", // zinc-800
  borderLight: "#3F3F46", // zinc-700

  // Text
  textPrimary: "#F4F4F5", // zinc-100
  textSecondary: "#A1A1AA", // zinc-500
  textTertiary: "#71717A", // zinc-600

  // Semantic
  success: "#22C55E", // green-500
  warning: "#F97316", // orange-500
  error: "#EF4444", // red-500
  info: "#06B6D4", // cyan-500

  // Status
  statusActive: "#22C55E", // green-500
  statusInactive: "#6B7280", // gray-500
  statusWarning: "#F97316", // orange-500
  statusError: "#EF4444", // red-500
};

// ============================================================================
// TIPOGRAFIA
// ============================================================================

export const typography = {
  // Font families
  fontDisplay: "'Jaro', sans-serif", // Display/Headings
  fontBody: "'Inter', sans-serif", // Body text
  fontMono: "'Inconsolata', monospace", // Dados, código

  // Scales
  scales: {
    // Headings
    h1: {
      size: "32px",
      weight: 700,
      lineHeight: 1.2,
      letterSpacing: "-0.02em",
    },
    h2: {
      size: "24px",
      weight: 700,
      lineHeight: 1.3,
      letterSpacing: "-0.01em",
    },
    h3: {
      size: "20px",
      weight: 700,
      lineHeight: 1.4,
    },
    h4: {
      size: "16px",
      weight: 700,
      lineHeight: 1.5,
    },

    // Body
    bodyLarge: {
      size: "16px",
      weight: 400,
      lineHeight: 1.5,
    },
    bodyRegular: {
      size: "14px",
      weight: 400,
      lineHeight: 1.5,
    },
    bodySmall: {
      size: "12px",
      weight: 400,
      lineHeight: 1.4,
    },

    // Mono (dados)
    monoLarge: {
      size: "14px",
      weight: 400,
      lineHeight: 1.5,
      fontFamily: "'Inconsolata', monospace",
    },
    monoRegular: {
      size: "13px",
      weight: 400,
      lineHeight: 1.5,
      fontFamily: "'Inconsolata', monospace",
    },
    monoSmall: {
      size: "12px",
      weight: 400,
      lineHeight: 1.4,
      fontFamily: "'Inconsolata', monospace",
    },
  },
};

// ============================================================================
// SPACING
// ============================================================================

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  "2xl": "32px",
  "3xl": "48px",
};

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const radius = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  full: "9999px",
};

// ============================================================================
// SHADOWS
// ============================================================================

export const shadows = {
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
  inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)",
  glow: "0 0 20px rgba(6, 182, 212, 0.2)",
};

// ============================================================================
// TRANSITIONS
// ============================================================================

export const transitions = {
  fast: "150ms ease-in-out",
  normal: "300ms ease-in-out",
  slow: "500ms ease-in-out",
};

// ============================================================================
// Z-INDEX
// ============================================================================

export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modal: 1040,
  popover: 1050,
  tooltip: 1060,
};

// ============================================================================
// COMPONENT TOKENS
// ============================================================================

export const components = {
  button: {
    primary: {
      bg: colors.primary,
      text: colors.bg,
      hover: colors.primaryDark,
      active: colors.primaryDark,
      disabled: colors.borderLight,
    },
    secondary: {
      bg: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      hover: colors.surfaceLight,
      active: colors.surfaceLight,
    },
    danger: {
      bg: colors.error,
      text: "#fff",
      hover: "#DC2626",
      active: "#B91C1C",
    },
  },

  input: {
    bg: colors.surfaceLight,
    border: colors.border,
    borderFocus: colors.primary,
    text: colors.textPrimary,
    placeholder: colors.textTertiary,
    radius: radius.md,
  },

  table: {
    headerBg: colors.surface,
    rowHover: colors.surfaceLight,
    border: colors.border,
    text: colors.textSecondary,
  },

  card: {
    bg: colors.surface,
    border: colors.border,
    shadow: shadows.md,
    radius: radius.md,
  },

  modal: {
    bg: colors.bg,
    overlay: "rgba(0, 0, 0, 0.5)",
    border: colors.border,
  },

  badge: {
    active: {
      bg: "rgba(34, 197, 94, 0.1)",
      text: "#22C55E",
      border: colors.border,
    },
    inactive: {
      bg: "rgba(107, 114, 128, 0.1)",
      text: colors.textSecondary,
      border: colors.border,
    },
    warning: {
      bg: "rgba(249, 115, 22, 0.1)",
      text: "#F97316",
      border: colors.border,
    },
  },
};

// ============================================================================
// TAILWIND CSS VARIABLES
// ============================================================================
// Cole isto em seu globals.css ou tailwind.config.ts

export const tailwindConfig = `
@theme {
  --color-primary: #06B6D4;
  --color-primary-light: #22D3EE;
  --color-primary-dark: #0891B2;

  --color-surface: #18181B;
  --color-surface-light: #27272A;

  --color-border: #27272A;
  --color-border-light: #3F3F46;

  --color-text-primary: #F4F4F5;
  --color-text-secondary: #A1A1AA;
  --color-text-tertiary: #71717A;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  --shadow-glow: 0 0 20px rgba(6, 182, 212, 0.2);
}
`;

// ============================================================================
// EXPORT PARA USO EM TAILWIND CLASSES
// ============================================================================

export default {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  transitions,
  zIndex,
  components,
  tailwindConfig,
};
