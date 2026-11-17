import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { theme } from '../../theme';
import { useCartStore } from '../../store/useCartStore';
import { Icon } from '../../components/common/Icon';
import { useResponsive } from '../../utils/responsive';

export default function TabLayout() {
  const totalCount = useCartStore((s) => s.getTotalItemsCount());
  const { isTablet } = useResponsive();

  const tabHeight = isTablet ? 78 : (Platform.OS === 'ios' ? 84 : 64);
  const tabPaddingBottom = isTablet ? 12 : (Platform.OS === 'ios' ? 24 : 8);
  const tabPaddingTop = isTablet ? 10 : 8;
  const labelFontSize = isTablet ? 13.5 : 10;
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
          marginTop: isTablet ? 3 : 0,
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
    width: 34,
    height: 34,
    borderRadius: 17,
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
