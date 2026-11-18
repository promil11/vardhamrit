import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
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
  // On mobile web and Android, ensure a generous bottom inset so descenders ("g", "y", "p") are never clipped.
  const bottomInset = isTablet ? 12 : Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 10);
  const tabHeight = isTablet ? 78 : (58 + bottomInset);
  const tabPaddingBottom = bottomInset;
  const tabPaddingTop = isTablet ? 10 : 6;
  const labelFontSize = isTablet ? 13.5 : 10.5;
  const iconSize = isTablet ? 25 : 20;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textHint,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          height: tabHeight,
          paddingBottom: tabPaddingBottom,
          paddingTop: tabPaddingTop,
          ...theme.shadows.card,
        },
        tabBarLabelStyle: {
          fontSize: labelFontSize,
          fontWeight: theme.typography.weights.extraBold,
          letterSpacing: 0.2,
          lineHeight: isTablet ? 16 : 14,
          marginTop: isTablet ? 3 : 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
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
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  iconWrapperTablet: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  iconActive: {
    backgroundColor: theme.colors.primaryMuted,
    transform: [{ scale: 1.05 }],
  },
});
