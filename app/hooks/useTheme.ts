import { theme, Theme } from '../theme';

/**
 * Hook to access the unified Chai Patti quick-commerce design tokens.
 */
export const useTheme = (): Theme => {
  return theme;
};

export default useTheme;
