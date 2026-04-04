// MST Dashboard Design System Color Palette
// Matches web app design tokens as the single source of truth

// ---- Primary Brand ----
const PRIMARY = '#708F96';       // Muted Sky Blue / Teal — brand actions, active states
const PRIMARY_LIGHT = '#8AA5AC';
const PRIMARY_DARK = '#5A737A';
const SECONDARY = '#AA895F';    // Warm Sand/Gold

// ---- Light Theme ----
const lightText = '#1A2332';
const lightBackground = '#FAFBFC';
const lightSurface = '#FFFFFF';
const lightCard = '#FFFFFF';
const lightBorder = '#E2E8F0';

// ---- Dark Theme ----
const darkText = '#E6EBEE';
const darkBackground = '#0B1214';
const darkSurface = '#121A1D';
const darkCard = '#121A1D';
const darkBorder = '#242E31';

// ---- Status Colors ----
const SUCCESS = '#10B981';       // Emerald
const WARNING = '#F59E0B';       // Amber
const ERROR = '#EF4444';         // Red
const INFO = '#3B82F6';          // Blue

// ---- Energy Utilities ----
const UTILITY_GRID = '#F59E0B';  // Amber — Grid/Electricity
const UTILITY_DIESEL = '#10B981'; // Emerald — DG/Diesel

// ---- Priority Colors ----
const PRIORITY_URGENT = '#EF4444';
const PRIORITY_HIGH = '#708F96';
const PRIORITY_MEDIUM = '#F59E0B';
const PRIORITY_LOW = '#94A3B8';

// ============================================================
// Colors — theme-aware object (light / dark)
// ============================================================
export const Colors = {
  light: {
    // Core text & background
    text: lightText,
    background: lightBackground,
    tint: PRIMARY,
    // Tab bar
    tabIconDefault: '#9CA3AF',
    tabIconSelected: PRIMARY,
    tabBarBackground: lightSurface,
    tabBarBorder: lightBorder,
    // Brand colors
    primary: PRIMARY,
    primaryLight: PRIMARY_LIGHT,
    primaryDark: PRIMARY_DARK,
    secondary: SECONDARY,
    secondaryLight: '#C4A882',
    // Semantic status
    success: SUCCESS,
    successBg: 'rgba(16,185,129,0.12)',
    successBorder: 'rgba(16,185,129,0.25)',
    warning: WARNING,
    warningBg: 'rgba(245,158,11,0.12)',
    warningBorder: 'rgba(245,158,11,0.25)',
    error: ERROR,
    errorBg: 'rgba(239,68,68,0.12)',
    errorBorder: 'rgba(239,68,68,0.25)',
    info: INFO,
    infoBg: 'rgba(59,130,246,0.12)',
    infoBorder: 'rgba(59,130,246,0.25)',
    // UI Surfaces
    border: lightBorder,
    card: lightCard,
    surface: lightSurface,
    // Text hierarchy
    textPrimary: 'rgba(26,35,50,0.92)',
    textSecondary: 'rgba(26,35,50,0.62)',
    textTertiary: 'rgba(26,35,50,0.42)',
    textMuted: 'rgba(26,35,50,0.42)',
    // Glassmorphism
    glassBg: 'rgba(255,255,255,0.55)',
    glassBorder: 'rgba(255,255,255,0.35)',
    // Priority colors
    priorityUrgent: PRIORITY_URGENT,
    priorityUrgentBg: 'rgba(239,68,68,0.10)',
    priorityHigh: PRIORITY_HIGH,
    priorityHighBg: 'rgba(112,143,150,0.12)',
    priorityMedium: PRIORITY_MEDIUM,
    priorityMediumBg: 'rgba(245,158,11,0.10)',
    priorityLow: PRIORITY_LOW,
    priorityLowBg: 'rgba(148,163,184,0.12)',
    // Energy utilities
    utilityGrid: UTILITY_GRID,
    utilityDiesel: UTILITY_DIESEL,
    // Sidebar
    sidebar: '#F8FAFC',
    sidebarActive: PRIMARY,
    sidebarActiveText: '#FFFFFF',
    sidebarInactive: 'rgba(26,35,50,0.62)',
    // Surface overlays
    surfaceElevated: 'rgba(255,255,255,0.95)',
    surfaceOverlay: 'rgba(250,251,252,0.95)',
    // Shadows
    shadowColor: 'rgba(0,0,0,0.08)',
    // Dividers
    divider: 'rgba(226,232,240,0.60)',
  },
  dark: {
    // Core text & background
    text: darkText,
    background: darkBackground,
    tint: PRIMARY_LIGHT,
    // Tab bar
    tabIconDefault: '#6E7681',
    tabIconSelected: PRIMARY_LIGHT,
    tabBarBackground: darkSurface,
    tabBarBorder: darkBorder,
    // Brand colors
    primary: PRIMARY,
    primaryLight: PRIMARY_LIGHT,
    primaryDark: PRIMARY_DARK,
    secondary: SECONDARY,
    secondaryLight: '#C4A882',
    // Semantic status
    success: SUCCESS,
    successBg: 'rgba(16,185,129,0.15)',
    successBorder: 'rgba(16,185,129,0.30)',
    warning: WARNING,
    warningBg: 'rgba(245,158,11,0.15)',
    warningBorder: 'rgba(245,158,11,0.30)',
    error: ERROR,
    errorBg: 'rgba(239,68,68,0.15)',
    errorBorder: 'rgba(239,68,68,0.30)',
    info: INFO,
    infoBg: 'rgba(59,130,246,0.15)',
    infoBorder: 'rgba(59,130,246,0.30)',
    // UI Surfaces
    border: darkBorder,
    card: darkCard,
    surface: darkSurface,
    // Text hierarchy
    textPrimary: 'rgba(230,235,238,0.95)',
    textSecondary: 'rgba(230,235,238,0.75)',
    textTertiary: 'rgba(230,235,238,0.55)',
    textMuted: 'rgba(230,235,238,0.55)',
    // Glassmorphism
    glassBg: 'rgba(20,26,34,0.55)',
    glassBorder: 'rgba(255,255,255,0.08)',
    // Priority colors
    priorityUrgent: PRIORITY_URGENT,
    priorityUrgentBg: 'rgba(239,68,68,0.15)',
    priorityHigh: PRIORITY_HIGH,
    priorityHighBg: 'rgba(112,143,150,0.15)',
    priorityMedium: PRIORITY_MEDIUM,
    priorityMediumBg: 'rgba(245,158,11,0.15)',
    priorityLow: PRIORITY_LOW,
    priorityLowBg: 'rgba(148,163,184,0.12)',
    // Energy utilities
    utilityGrid: UTILITY_GRID,
    utilityDiesel: UTILITY_DIESEL,
    // Sidebar
    sidebar: '#151B2B',
    sidebarActive: PRIMARY,
    sidebarActiveText: '#FFFFFF',
    sidebarInactive: 'rgba(230,235,238,0.75)',
    // Surface overlays
    surfaceElevated: 'rgba(18,26,29,0.95)',
    surfaceOverlay: 'rgba(11,18,20,0.95)',
    // Shadows
    shadowColor: 'rgba(0,0,0,0.35)',
    // Dividers
    divider: 'rgba(36,46,49,0.60)',
  },
};

// ============================================================
// DesignTokens — raw values for direct use across the app
// ============================================================
export const DesignTokens = {
  // ---- Primary Brand ----
  primary: PRIMARY,
  primaryLight: PRIMARY_LIGHT,
  primaryDark: PRIMARY_DARK,
  secondary: SECONDARY,

  // ---- Status ----
  success: SUCCESS,
  warning: WARNING,
  error: ERROR,
  info: INFO,

  // ---- Energy Utilities ----
  utilityGrid: UTILITY_GRID,
  utilityDiesel: UTILITY_DIESEL,

  // ---- Priority ----
  priorityUrgent: PRIORITY_URGENT,
  priorityHigh: PRIORITY_HIGH,
  priorityMedium: PRIORITY_MEDIUM,
  priorityLow: PRIORITY_LOW,

  // ---- Light Theme Surfaces ----
  lightBackground: lightBackground,
  lightSurface: lightSurface,
  lightCard: lightCard,
  lightBorder: lightBorder,
  lightText: lightText,

  // ---- Dark Theme Surfaces ----
  darkBackground: darkBackground,
  darkSurface: darkSurface,
  darkCard: darkCard,
  darkBorder: darkBorder,
  darkText: darkText,

  // ---- Glass Effects ----
  glassBgLight: 'rgba(255,255,255,0.55)',
  glassBorderLight: 'rgba(255,255,255,0.35)',
  glassBgDark: 'rgba(20,26,34,0.55)',
  glassBorderDark: 'rgba(255,255,255,0.08)',

  // ---- Card Surface ----
  cardSurfaceLight: 'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(245,247,249,0.75))',
  cardRadius: 20,
  cardShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 8,
  },

  // ---- Sidebar ----
  sidebarLight: '#F8FAFC',
  sidebarDark: '#151B2B',
  sidebarActive: PRIMARY,
  sidebarActiveText: '#FFFFFF',

  // ---- Spacing (8px system) ----
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
    xxxl: 48,
    huge: 64,
  },

  // ---- Shadows ----
  shadowSm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  shadowMd: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  shadowLg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 5,
  },
  shadowXl: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 25,
    elevation: 8,
  },

  // ---- Typography ----
  fontDisplay: 'Poppins',
  fontBody: 'Urbanist',
  h1: { fontSize: 28, fontWeight: '600' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '600' as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '500' as const },

  // ---- Layout ----
  cardPadding: 20,
  sectionGap: 24,
  cardGap: 16,
  contentPadding: 16,
  badgeRadius: 16,
};

export default Colors;
