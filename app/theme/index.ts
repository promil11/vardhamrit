/**
 * Chai Patti Design System - Unified Theme Tokens
 * Quick-commerce aesthetic inspired by Zepto, Blinkit, and Swiggy Instamart.
 * Built for speed, high contrast, bold hierarchy, and thumb-friendly interactions.
 */

export const colors = {
  // Brand Primaries (Fresh Organic Tender Tea Leaf Design)
  primary: '#1E6B42',          // Fresh Organic Tea Leaf Green
  primaryLight: '#2D8B55',     // Spring Flush Tea Sprout
  primaryGradient: ['#1A5D38', '#2D8B55'] as const, // Radiant, fresh 2-stop tea leaf gradient
  primaryMuted: '#E8F5E9',     // Soft tender tea leaf wash for chips, steppers, badges
  primaryBorder: '#A5D6A7',    // Delicate leaf vein border

  // Accents (Warm Chai Gold & Amber)
  accentGold: '#F59E0B',       // Warm Chai Gold
  accentGoldDark: '#B45309',   // Deep Brew Amber
  accentGoldGradient: ['#D97706', '#F59E0B'] as const, // Golden infusion gradient
  accentGoldMuted: '#FFFBEB',  // Creamy chai tint
  accentGoldBorder: '#FDE68A',

  // Action Gradient (Instant Add to Bag / Claim / Checkout CTAs - Tender Young Tea Shoot)
  actionGradient: ['#15803D', '#22C55E'] as const, // Vibrant, attractive fresh tea leaf gradient

  // Dark Luxury Gradient (Estate Cellar / Evening Infusion)
  darkLuxuryGradient: ['#144D2E', '#1E6B42'] as const,

  // Soft Surface Silk Gradient (Morning Tea Leaf Mist)
  surfaceGradient: ['#FFFFFF', '#F2F8F4'] as const,

  // Alternative High-Energy Accent (Magenta / Berry)
  accentBerry: '#E11D48',      // Berry ribbon for "20% OFF", "Save Rs.X"
  accentBerryGradient: ['#BE123C', '#E11D48'] as const,
  accentBerryMuted: '#FFF1F2',
  accentBerryBorder: '#FECDD3',

  // Surfaces & Backgrounds (Light Green Tea Leaf Ambience)
  background: '#F4F9F5',       // Soothing light tea leaf mist backdrop
  surface: '#FFFFFF',          // Clean white cards
  surfaceSecondary: '#EDF7F0', // Subtle light tea leaf tint
  surfaceMuted: '#E1EFE6',     // Tender leaf divider

  // Typography Colors
  textPrimary: '#0F2E1B',      // High-contrast deep tea leaf charcoal
  textSecondary: '#3D684E',    // Soft botanical tea leaf tone
  textHint: '#7FA78E',         // Herbal placeholder & subtle captions
  textInverse: '#FFFFFF',      // White on dark leaf gradients
  textSuccess: '#16A34A',
  textError: '#DC2626',

  // Feedback & Status
  success: '#16A34A',          // Fresh tea leaf green
  successMuted: '#DCFCE7',
  error: '#EF4444',            // Stock alerts, validation errors
  errorMuted: '#FEF2F2',
  warning: '#F59E0B',
  warningMuted: '#FFFBEB',

  // Structural Borders
  border: '#DCEFE3',           // Delicate tea garden border
  borderLight: '#EAF5EE',
  borderStrong: '#B4DDC4',

  // Category Pastel Tints (Natural botanical hues)
  tintKadak: '#FFF7ED',        // Warm spiced ginger tint
  tintElaichi: '#E8F5E9',      // Fresh cardamom pod / tender leaf
  tintMasala: '#FDF2F8',       // Warm cinnamon masala
  tintGinger: '#FEFCE8',       // Golden adrak
  tintGreen: '#DCFCE7',        // 100% Darjeeling spring flush
  tintGifts: '#FAF5FF',        // Festive lavender
  tintCombos: '#EFF6FF',       // Value bundle sky tint
  tintOffers: '#FFF1F2',       // Berry deal tint

  // Overlays
  overlay: 'rgba(18, 55, 33, 0.65)',
  overlayLight: 'rgba(18, 55, 33, 0.35)',
};

export const typography = {
  // Font scale: 12 / 14 / 16 / 18 / 22 / 28
  scale: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
  },
  lineHeights: {
    xs: 16,
    sm: 18,
    md: 22,
    lg: 24,
    xl: 28,
    xxl: 34,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
    extraBold: '800' as const,
  },
  letterSpacing: {
    tight: -0.4,
    normal: 0,
    wide: 0.5,
    badge: 0.8,
  },
};

export const spacing = {
  // 8pt grid
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
  massive: 64,
};

export const radius = {
  // Geometric tokens
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,       // Buttons & input fields
  card: 16,     // Product cards & banner tiles
  banner: 20,   // Hero offer carousel banners
  sheet: 24,    // Bottom sheets & floating dialogs
  pill: 999,    // Delivery pills, chips, ADD steppers
};

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  subtle: {
    shadowColor: '#1C1C1C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  card: {
    shadowColor: '#1C1C1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#1A5D38',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  viewCartBar: {
    shadowColor: '#1A5D38',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 8,
  },
  modal: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
};

export const layout = {
  screenPadding: spacing.base,
  headerHeightCollapsed: 72,
  headerHeightExpanded: 132,
  bottomBarHeight: 64,
  viewCartBarHeight: 60,
  productCardWidth: 168,
  productImageHeight: 136,
  categoryTileSize: 74,
};

export const theme = {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  layout,
};

export type Theme = typeof theme;
export default theme;
