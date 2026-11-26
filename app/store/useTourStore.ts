import { create } from 'zustand';
import { Platform } from 'react-native';

export interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpotlightStepConfig {
  id: string;
  screen: 'home' | 'profile';
  borderRadius: number;

  // Copy
  badge: string;
  greeting: string;
  title: string;
  message: string;
  ctaText: string;
}

export const TOUR_STEPS: SpotlightStepConfig[] = [
  // 1. Search Bar (Home)
  {
    id: 'search_bar',
    screen: 'home',
    borderRadius: 24,
    badge: 'QUICK DISCOVERY',
    greeting: 'Hi there 👋',
    title: 'Instant Tea Search',
    message: 'Quickly search single-estate Assam Kadak, Royal Kesar, Grand Masala, or whole-leaf blends right here.',
    ctaText: 'Next',
  },
  // 2. Notifications (Home)
  {
    id: 'notifications',
    screen: 'home',
    borderRadius: 23,
    badge: 'LIVE UPDATES',
    greeting: 'Stay Notified 🔔',
    title: 'Order & Blend Alerts',
    message: 'Receive real-time 48hr delivery milestones, fresh season harvests, and priority restock updates.',
    ctaText: 'Next',
  },
  // 3. Wishlist (Home)
  {
    id: 'wishlist',
    screen: 'home',
    borderRadius: 23,
    badge: 'FAVORITES',
    greeting: 'Your Chai Wishlist ❤️',
    title: 'Save Favorite Morning Cups',
    message: 'Bookmark your favorite blends to easily re-order your daily tea anytime with a single tap.',
    ctaText: 'Next',
  },
  // 4. Chai ASMR & Mini Garden Reels (Home)
  {
    id: 'reels_asmr',
    screen: 'home',
    borderRadius: 16,
    badge: 'EXPERIENCE SOUND',
    greeting: 'Chai ASMR & Stories 📹',
    title: '10s Micro-Videos with Audio',
    message: 'Watch authentic micro-stories: rolling boiling spices, velvety milk swirls, and misty Assam harvests.',
    ctaText: 'Next',
  },
  // 5. Fresh Harvest & 1kg Saver Packs (Home)
  {
    id: 'fresh_packs',
    screen: 'home',
    borderRadius: 18,
    badge: 'DIRECT VALUE',
    greeting: 'Farm Freshness 🍃',
    title: '1kg Saver Packs & Fresh Stock',
    message: 'Explore fresh harvest teas packed within 48 hours of pluck, available in trial pouches or family saver packs.',
    ctaText: 'Next',
  },
  // 6. Orders (Bottom Tab)
  {
    id: 'orders_tab',
    screen: 'home',
    borderRadius: 16,
    badge: 'BOTTOM TAB',
    greeting: 'Track Shipments 📦',
    title: 'Orders',
    message: 'View live courier dispatch, track 48hr delivery, and re-order previous estate packs directly from this tab.',
    ctaText: 'Next: Profile Perks →',
  },
  // 7. My Scratch Cards & Rewards (Profile Screen)
  {
    id: 'scratch_cards_rewards',
    screen: 'profile',
    borderRadius: 16,
    badge: 'PROFILE REWARDS',
    greeting: 'Scratch & Earn 🎁',
    title: 'My Scratch Cards & Rewards',
    message: 'Scratch mystery cards on orders to win cashback coins, and redeem your 25 Welcome Coins right here in your Profile!',
    ctaText: 'Next',
  },
  // 8. Restock & Stock Alert (Profile Screen)
  {
    id: 'stock_alerts',
    screen: 'profile',
    borderRadius: 16,
    badge: 'STOCK WATCH',
    greeting: 'Instant Availability ⚡',
    title: 'Restock & Stock Alerts',
    message: 'Never miss out on limited garden batches! Set up instant SMS and WhatsApp restock alerts inside your Profile.',
    ctaText: 'Alright, got it',
  },
];

// Target Node Registry
const targetRefs: Record<string, any> = {};

export const registerTargetRef = (id: string, node: any) => {
  if (node) {
    targetRefs[id] = node;
  }
};

export const getTargetRef = (id: string) => targetRefs[id];

/**
 * Robust cross-platform coordinate measurer for tour targets.
 * On Web: uses DOM getBoundingClientRect after auto-scrolling into view if needed.
 * On Native: uses ref.measureInWindow.
 * Falls back to responsive relative coordinates.
 */
export const measureTargetAsync = async (
  stepId: string,
  screenWidth: number,
  screenHeight: number
): Promise<TargetRect> => {
  // 1. Web DOM Measurement
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const el = document.getElementById(`tour-target-${stepId}`) || targetRefs[stepId];
    if (el && typeof el.getBoundingClientRect === 'function') {
      // Auto-scroll target into view if it might be outside or clipped by scroll
      if (['reels_asmr', 'fresh_packs', 'scratch_cards_rewards', 'stock_alerts'].includes(stepId)) {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch { }
      }

      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }
    }
  }

  // 2. React Native Native measureInWindow
  const nativeRef = targetRefs[stepId];
  if (nativeRef && typeof nativeRef.measureInWindow === 'function') {
    const measured = await new Promise<TargetRect | null>((resolve) => {
      try {
        nativeRef.measureInWindow((x: number, y: number, width: number, height: number) => {
          if (width > 0 && height > 0) {
            resolve({ x, y, width, height });
          } else {
            resolve(null);
          }
        });
      } catch {
        resolve(null);
      }
    });

    if (measured) return measured;
  }

  // 3. Precise Fallback Geometry for all screen sizes
  if (stepId === 'orders_tab') {
    const tabWidth = screenWidth / 4;
    const tabHeight = 64;
    return {
      x: Math.round(tabWidth * 2),
      y: Math.round(screenHeight - tabHeight),
      width: Math.round(tabWidth),
      height: tabHeight,
    };
  }

  if (stepId === 'search_bar') {
    return {
      x: 16,
      y: Platform.OS === 'ios' ? 120 : 104,
      width: Math.max(280, screenWidth - 32),
      height: 48,
    };
  }

  if (stepId === 'notifications') {
    return {
      x: Math.round(screenWidth - 120),
      y: Platform.OS === 'ios' ? 62 : 46,
      width: 44,
      height: 44,
    };
  }

  if (stepId === 'wishlist') {
    return {
      x: Math.round(screenWidth - 70),
      y: Platform.OS === 'ios' ? 62 : 46,
      width: 44,
      height: 44,
    };
  }

  if (stepId === 'reels_asmr') {
    return {
      x: 14,
      y: 360,
      width: Math.max(280, screenWidth - 28),
      height: 125,
    };
  }

  if (stepId === 'fresh_packs') {
    return {
      x: 14,
      y: 520,
      width: Math.max(280, screenWidth - 28),
      height: 200,
    };
  }

  if (stepId === 'scratch_cards_rewards') {
    return {
      x: 14,
      y: 380,
      width: Math.max(280, screenWidth - 28),
      height: 72,
    };
  }

  if (stepId === 'stock_alerts') {
    return {
      x: 14,
      y: 470,
      width: Math.max(280, screenWidth - 28),
      height: 72,
    };
  }

  return {
    x: 16,
    y: Math.round(screenHeight * 0.3),
    width: Math.max(280, screenWidth - 32),
    height: 60,
  };
};

interface TourState {
  isActive: boolean;
  currentStepIndex: number;
  startTour: () => void;
  nextStep: (router: any) => void;
  dismissTour: (completeTourApi: () => Promise<void>, router?: any) => Promise<void>;
}

export const useTourStore = create<TourState>((set, get) => ({
  isActive: false,
  currentStepIndex: 0,

  startTour: () => {
    set({ isActive: true, currentStepIndex: 0 });
  },

  nextStep: (router: any) => {
    const { currentStepIndex } = get();
    const nextIndex = currentStepIndex + 1;

    if (nextIndex < TOUR_STEPS.length) {
      const nextStepConfig = TOUR_STEPS[nextIndex];
      const currentStepConfig = TOUR_STEPS[currentStepIndex];

      // If moving from home screen to profile screen
      if (currentStepConfig.screen === 'home' && nextStepConfig.screen === 'profile') {
        if (router?.push) {
          router.push('/(tabs)/profile');
        }
      }

      set({ currentStepIndex: nextIndex });
    }
  },

  dismissTour: async (completeTourApi: () => Promise<void>, router?: any) => {
    const { currentStepIndex } = get();
    const currentStepConfig = TOUR_STEPS[currentStepIndex];

    set({ isActive: false, currentStepIndex: 0 });

    try {
      await completeTourApi();
    } catch { }

    // If dismissed while on profile screen during the initial tour, return to home
    if (currentStepConfig && currentStepConfig.screen === 'profile' && router?.replace) {
      router.replace('/(tabs)');
    }
  },
}));
