import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { useCartStore } from '../../store/useCartStore';
import { Icon } from '../../components/common/Icon';
import { useResponsive } from '../../utils/responsive';

export default function TabLayout() {
  const totalCount = useCartStore((s) => s.getTotalItemsCount());
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsive();

  // On devices with home indicators (e.g. newer iPhones), insets.bottom is ~34px.
  // On mobile web and Android, ensure a generous bottom inset and tab height so descenders ("g", "y", "p") are never clipped.
  const bottomInset = isTablet ? 14 : Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 10);
  const tabHeight = isTablet ? 84 : (68 + bottomInset);
  const tabPaddingBottom = bottomInset;
  const tabPaddingTop = isTablet ? 6 : 4;
  const iconSize = isTablet ? 24 : 20;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textHint,
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 2,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          height: tabHeight,
          paddingBottom: tabPaddingBottom,
          paddingTop: tabPaddingTop,
          ...theme.shadows.card,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: ({ color }) => (
            <Text style={[styles.tabLabel, isTablet && styles.tabLabelTablet, { color }]}>
              Home
            </Text>
          ),
          tabBarIcon: ({ focused, color }) => (
            <View
              style={[
                styles.iconWrapper,
                isTablet && styles.iconWrapperTablet,
                focused && styles.iconActive,
              ]}
            >
              <Icon
                name="store"
                size={iconSize}
                color={focused ? theme.colors.primary : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          tabBarLabel: ({ color }) => (
            <Text style={[styles.tabLabel, isTablet && styles.tabLabelTablet, { color }]}>
              Categories
            </Text>
          ),
          tabBarIcon: ({ focused, color }) => (
            <View
              style={[
                styles.iconWrapper,
                isTablet && styles.iconWrapperTablet,
                focused && styles.iconActive,
              ]}
            >
              <Icon
                name="grid"
                size={iconSize}
                color={focused ? theme.colors.primary : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarLabel: ({ color }) => (
            <Text style={[styles.tabLabel, isTablet && styles.tabLabelTablet, { color }]}>
              Orders
            </Text>
          ),
          tabBarIcon: ({ focused, color }) => (
            <View
              style={[
                styles.iconWrapper,
                isTablet && styles.iconWrapperTablet,
                focused && styles.iconActive,
              ]}
            >
              <Icon
                name="package"
                size={iconSize}
                color={focused ? theme.colors.primary : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: ({ color }) => (
            <Text style={[styles.tabLabel, isTablet && styles.tabLabelTablet, { color }]}>
              Profile
            </Text>
          ),
          tabBarIcon: ({ focused, color }) => (
            <View
              style={[
                styles.iconWrapper,
                isTablet && styles.iconWrapperTablet,
                focused && styles.iconActive,
              ]}
            >
              <Icon
                name="user"
                size={iconSize}
                color={focused ? theme.colors.primary : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.15,
    textAlign: 'center',
    lineHeight: 16,
    includeFontPadding: false,
    paddingBottom: 3,
    marginTop: 2,
  },
  tabLabelTablet: {
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 3,
    paddingBottom: 2,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  iconWrapperTablet: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  iconActive: {
    backgroundColor: theme.colors.primaryMuted,
    transform: [{ scale: 1.05 }],
  },
});
