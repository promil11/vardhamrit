import { useWindowDimensions } from 'react-native';

export const BREAKPOINTS = {
  TABLET: 600,
  LARGE_TABLET: 840,
  DESKTOP: 1024,
};

export interface ResponsiveValues {
  width: number;
  height: number;
  isTablet: boolean;
  isLargeTablet: boolean;
  isDesktop: boolean;
  scale: number;
  productCardWidth: number;
  productImageHeight: number;
  gridItemWidth: string;
  gridColumns: number;
  scaleFont: (baseSize: number) => number;
  scaleSize: (baseSize: number) => number;
}

/**
 * Universal responsive scaling hook.
 * On standard mobile phones (< 600px):
 *   scale = 1.0 (Zero changes to mobile appearance or functionality).
 * On iPad / Tablet (>= 600px):
 *   Automatically adjusts product card dimensions, image sizes, and typography
 *   so elements appear natural, proportional, and comparable to the larger display.
 */
export function useResponsive(): ResponsiveValues {
  const { width, height } = useWindowDimensions();

  const isTablet = width >= BREAKPOINTS.TABLET;
  const isLargeTablet = width >= BREAKPOINTS.LARGE_TABLET;
  const isDesktop = width >= BREAKPOINTS.DESKTOP;

  // Scale factor: strictly 1 on standard phones (< 600px)
  const scale = isLargeTablet ? 1.4 : isTablet ? 1.28 : 1;

  // Horizontal rail product card width
  const productCardWidth = isLargeTablet ? 236 : isTablet ? 214 : 168;

  // Product showcase image container height
  const productImageHeight = isLargeTablet ? 192 : isTablet ? 172 : 136;

  // Grid item percentage width: 2 cols on mobile, 3 cols on tablet, 4 cols on large tablet/desktop
  const gridItemWidth = isLargeTablet ? '23.5%' : isTablet ? '31.5%' : '48%';
  const gridColumns = isLargeTablet ? 4 : isTablet ? 3 : 2;

  const scaleFont = (baseSize: number): number => {
    if (!isTablet) return baseSize;
    return Math.round(baseSize * scale * 10) / 10;
  };

  const scaleSize = (baseSize: number): number => {
    if (!isTablet) return baseSize;
    return Math.round(baseSize * scale);
  };

  return {
    width,
    height,
    isTablet,
    isLargeTablet,
    isDesktop,
    scale,
    productCardWidth,
    productImageHeight,
    gridItemWidth,
    gridColumns,
    scaleFont,
    scaleSize,
  };
}

export default useResponsive;
