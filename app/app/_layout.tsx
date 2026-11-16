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

export default function RootLayout() {
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
