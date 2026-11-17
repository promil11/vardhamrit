import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../store/authContext';
import { CartProvider } from '../store/cartContext';
import { Colors } from '../constants/colors';
import { Icon } from '../components/common/Icon';

// Configure heads-up notification behavior in foreground
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 mins
      retry: 2,
    },
  },
});

function NavigationGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  // Handle push notification tap / deep linking (cold start & foreground/background)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleNotificationClick = (response: Notifications.NotificationResponse) => {
      try {
        const data = response?.notification?.request?.content?.data;
        const targetRoute = data?.actionRoute;

        if (targetRoute && targetRoute !== '/' && targetRoute !== '') {
          router.replace(targetRoute as any);
        } else {
          router.replace('/(tabs)');
        }
      } catch (e) {
        console.warn('Could not navigate to notification route:', e);
        router.replace('/(tabs)');
      }
    };

    // 1. Cold start: user clicks notification box when app was closed/killed
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationClick(response);
      }
    });

    // 2. Background/Foreground: user clicks notification banner while app is active
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationClick(response);
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.logoBadge}>
          <Icon name="coffee" size={42} color={Colors.accentGold || '#E5A93C'} />
        </View>
        <Text style={styles.splashTitle}>VARDHAMRIT</Text>
        <Text style={styles.splashSubtitle}>Pure Himalayan & Assam Chai</Text>
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="wishlist" options={{ headerShown: false }} />
      <Stack.Screen name="checkout" options={{ headerShown: false }} />
      <Stack.Screen name="cart" options={{ headerShown: false }} />
      <Stack.Screen name="auth/login" options={{ headerShown: false }} />
      <Stack.Screen name="auth/register" options={{ headerShown: false }} />
      <Stack.Screen name="order-success" options={{ headerShown: false }} />
      <Stack.Screen name="order-tracking" options={{ headerShown: false }} />
      <Stack.Screen name="rewards" options={{ headerShown: false }} />
    </Stack>
  );
}

const RESPONSIVE_ENGINE_CSS = `
  /* Default Text & Input Scaling on Web */
  @media (min-width: 600px) and (max-width: 839px) {
    .css-text-146c3p1 { font-size: 17.5px !important; }
    .css-textinput-11aywtz { font-size: 16px !important; }
  }
  @media (min-width: 840px) {
    .css-text-146c3p1 { font-size: 19px !important; }
    .css-textinput-11aywtz { font-size: 17.5px !important; }
  }

  /* Global Desktop Frame Alignment */
  @media (min-width: 1024px) {
    body {
      background-color: #EBF3EE;
      display: flex;
      justify-content: center;
    }
    #root {
      max-width: 1024px;
      width: 100%;
      margin: 0 auto;
      box-shadow: 0 0 40px rgba(0, 0, 0, 0.08);
      background-color: #FFFFFF;
    }
  }

  /* Tablet (600px - 839px): Universal Normalized Typography Scale */
  @media (min-width: 600px) and (max-width: 839px) {
    /* Tier 1: Micro Badges, Tags & Captions (Min readable 13px) */
    .r-fontSize-15doi1v { font-size: 13px !important; }
    .r-fontSize-7k9ea4 { font-size: 13px !important; }
    .r-fontSize-1armvtb { font-size: 13px !important; }
    .r-fontSize-1umgglz { font-size: 13px !important; }
    .r-fontSize-qqjak8 { font-size: 13.5px !important; }
    .r-fontSize-1exf2r { font-size: 13.5px !important; }
    .r-fontSize-10x49cs { font-size: 13.5px !important; }

    /* Tier 2: Secondary Text, Subtitles & Ratings */
    .r-fontSize-1ozpbmi { font-size: 15px !important; }
    .r-fontSize-1gkfh8e { font-size: 15px !important; }
    .r-fontSize-1ws2f5x { font-size: 15px !important; }
    .r-fontSize-1enofrn { font-size: 15.5px !important; }
    .r-fontSize-1grwqd5 { font-size: 15.5px !important; }

    /* Tier 3: Body Text, Pack Sizes, Variants & Buttons */
    .r-fontSize-n6v787 { font-size: 16.5px !important; }
    .r-fontSize-vbi3md { font-size: 16.5px !important; }
    .r-fontSize-1b43r93 { font-size: 17.5px !important; }
    .r-fontSize-1diydf2 { font-size: 17.5px !important; }
    .r-fontSize-a023e6 { font-size: 18.5px !important; }
    .r-fontSize-1asdmkh { font-size: 18.5px !important; }

    /* Tier 4: Section Headers & Card Titles */
    .r-fontSize-ubezar { font-size: 20px !important; }
    .r-fontSize-g2gp47 { font-size: 20px !important; }
    .r-fontSize-1inkyih { font-size: 22px !important; }
    .r-fontSize-16if4en { font-size: 22px !important; }
    .r-fontSize-1i10wst { font-size: 22px !important; }
    .r-fontSize-zsx22o { font-size: 22px !important; }

    /* Tier 5: Major Headings & Selling Prices */
    .r-fontSize-1b6yd1w { font-size: 24px !important; }
    .r-fontSize-gets1z { font-size: 24px !important; }
    .r-fontSize-adyw6z { font-size: 24px !important; }
    .r-fontSize-cv4lhi { font-size: 26px !important; }
    .r-fontSize-evnaw { font-size: 26px !important; }
    .r-fontSize-1blvdjr { font-size: 26px !important; }

    /* Tier 6: Large Banners & Display */
    .r-fontSize-1x35g6 { font-size: 28px !important; }
    .r-fontSize-h1js2l { font-size: 28px !important; }
    .r-fontSize-yy2aun { font-size: 30px !important; }
    .r-fontSize-198d08l { font-size: 30px !important; }
    .r-fontSize-zz5t5d { font-size: 32px !important; }
    .r-fontSize-1ra0lkn { font-size: 34px !important; }
    .r-fontSize-1ui5ee8 { font-size: 38px !important; }
    .r-fontSize-uho16t { font-size: 40px !important; }
    .r-fontSize-3i2nvb { font-size: 44px !important; }
    .r-fontSize-xb2eav { font-size: 48px !important; }

    /* Proportional Line Heights */
    .r-lineHeight-56xrmm { line-height: 18px !important; }
    .r-lineHeight-1akm30i { line-height: 18px !important; }
    .r-lineHeight-1f529hi { line-height: 18px !important; }
    .r-lineHeight-fxxt2n { line-height: 19px !important; }
    .r-lineHeight-1cwl3u0 { line-height: 21px !important; }
    .r-lineHeight-5fcqz0 { line-height: 21px !important; }
    .r-lineHeight-14yzgew { line-height: 24px !important; }
    .r-lineHeight-hjklzo { line-height: 24px !important; }
    .r-lineHeight-rjixqe { line-height: 25px !important; }
    .r-lineHeight-10yl4k { line-height: 27px !important; }
    .r-lineHeight-hbpseb { line-height: 28px !important; }
    .r-lineHeight-7ptqe7 { line-height: 28px !important; }
    .r-lineHeight-135wba7 { line-height: 29px !important; }
    .r-lineHeight-waer2z { line-height: 30px !important; }
    .r-lineHeight-eaezby { line-height: 32px !important; }
    .r-lineHeight-vrz42v { line-height: 34px !important; }
    .r-lineHeight-17rnw9f { line-height: 36px !important; }
    .r-lineHeight-37tt59 { line-height: 40px !important; }
    .r-lineHeight-2agvir { line-height: 42px !important; }
    .r-lineHeight-xnfwke { line-height: 46px !important; }
    .r-lineHeight-1gvhk8w { line-height: 52px !important; }
  }

  /* Large Tablet & Desktop (>= 840px): Universal Normalized Typography Scale */
  @media (min-width: 840px) {
    /* Tier 1: Micro Badges, Tags & Captions (Min readable 14px) */
    .r-fontSize-15doi1v { font-size: 14px !important; }
    .r-fontSize-7k9ea4 { font-size: 14px !important; }
    .r-fontSize-1armvtb { font-size: 14px !important; }
    .r-fontSize-1umgglz { font-size: 14px !important; }
    .r-fontSize-qqjak8 { font-size: 14.5px !important; }
    .r-fontSize-1exf2r { font-size: 14.5px !important; }
    .r-fontSize-10x49cs { font-size: 14.5px !important; }

    /* Tier 2: Secondary Text, Subtitles & Ratings */
    .r-fontSize-1ozpbmi { font-size: 16px !important; }
    .r-fontSize-1gkfh8e { font-size: 16px !important; }
    .r-fontSize-1ws2f5x { font-size: 16px !important; }
    .r-fontSize-1enofrn { font-size: 17px !important; }
    .r-fontSize-1grwqd5 { font-size: 17px !important; }

    /* Tier 3: Body Text, Pack Sizes, Variants & Buttons */
    .r-fontSize-n6v787 { font-size: 18px !important; }
    .r-fontSize-vbi3md { font-size: 18px !important; }
    .r-fontSize-1b43r93 { font-size: 19px !important; }
    .r-fontSize-1diydf2 { font-size: 19px !important; }
    .r-fontSize-a023e6 { font-size: 20.5px !important; }
    .r-fontSize-1asdmkh { font-size: 20.5px !important; }

    /* Tier 4: Section Headers & Card Titles */
    .r-fontSize-ubezar { font-size: 22px !important; }
    .r-fontSize-g2gp47 { font-size: 22px !important; }
    .r-fontSize-1inkyih { font-size: 24px !important; }
    .r-fontSize-16if4en { font-size: 24px !important; }
    .r-fontSize-1i10wst { font-size: 24px !important; }
    .r-fontSize-zsx22o { font-size: 24px !important; }

    /* Tier 5: Major Headings & Selling Prices */
    .r-fontSize-1b6yd1w { font-size: 26px !important; }
    .r-fontSize-gets1z { font-size: 26px !important; }
    .r-fontSize-adyw6z { font-size: 26px !important; }
    .r-fontSize-cv4lhi { font-size: 28px !important; }
    .r-fontSize-evnaw { font-size: 28px !important; }
    .r-fontSize-1blvdjr { font-size: 28px !important; }

    /* Tier 6: Large Banners & Display */
    .r-fontSize-1x35g6 { font-size: 31px !important; }
    .r-fontSize-h1js2l { font-size: 31px !important; }
    .r-fontSize-yy2aun { font-size: 33px !important; }
    .r-fontSize-198d08l { font-size: 33px !important; }
    .r-fontSize-zz5t5d { font-size: 36px !important; }
    .r-fontSize-1ra0lkn { font-size: 38px !important; }
    .r-fontSize-1ui5ee8 { font-size: 42px !important; }
    .r-fontSize-uho16t { font-size: 44px !important; }
    .r-fontSize-3i2nvb { font-size: 48px !important; }
    .r-fontSize-xb2eav { font-size: 54px !important; }

    /* Proportional Line Heights */
    .r-lineHeight-56xrmm { line-height: 20px !important; }
    .r-lineHeight-1akm30i { line-height: 20px !important; }
    .r-lineHeight-1f529hi { line-height: 20px !important; }
    .r-lineHeight-fxxt2n { line-height: 21px !important; }
    .r-lineHeight-1cwl3u0 { line-height: 23px !important; }
    .r-lineHeight-5fcqz0 { line-height: 23px !important; }
    .r-lineHeight-14yzgew { line-height: 26px !important; }
    .r-lineHeight-hjklzo { line-height: 26px !important; }
    .r-lineHeight-rjixqe { line-height: 27px !important; }
    .r-lineHeight-10yl4k { line-height: 29px !important; }
    .r-lineHeight-hbpseb { line-height: 30px !important; }
    .r-lineHeight-7ptqe7 { line-height: 30px !important; }
    .r-lineHeight-135wba7 { line-height: 31px !important; }
    .r-lineHeight-waer2z { line-height: 32px !important; }
    .r-lineHeight-eaezby { line-height: 34px !important; }
    .r-lineHeight-vrz42v { line-height: 36px !important; }
    .r-lineHeight-17rnw9f { line-height: 38px !important; }
    .r-lineHeight-37tt59 { line-height: 42px !important; }
    .r-lineHeight-2agvir { line-height: 44px !important; }
    .r-lineHeight-xnfwke { line-height: 48px !important; }
    .r-lineHeight-1gvhk8w { line-height: 54px !important; }
  }
`;

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      let styleTag = document.getElementById('vardhamrit-responsive-engine');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'vardhamrit-responsive-engine';
        styleTag.textContent = RESPONSIVE_ENGINE_CSS;
        document.head.appendChild(styleTag);
      }
    }
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CartProvider>
            <StatusBar style="light" />
            <NavigationGate />
          </CartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logoBadge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.accentGold,
  },
  logoEmoji: {
    fontSize: 44,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 3,
  },
  splashSubtitle: {
    fontSize: 14,
    color: Colors.accentGold,
    marginTop: 6,
    fontWeight: '500',
    letterSpacing: 1,
  },
});
