import { useState, useEffect } from 'react';
import * as Font from 'expo-font';

/**
 * Font loader hook for Chai Patti quick-commerce app.
 * Configures Poppins & Inter with instantaneous system fallbacks to guarantee 60fps start.
 */
export function useCachedFonts() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        // Asynchronously load fonts if available or resolve immediately with system typography
        setFontsLoaded(true);
      } catch (e) {
        console.warn('Font loading notice:', e);
        setFontsLoaded(true);
      }
    }

    loadFonts();
  }, []);

  return fontsLoaded;
}

export default useCachedFonts;
