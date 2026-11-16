import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { theme } from '../../theme';
import { useCartStore } from '../../store/useCartStore';
import { Icon } from '../../components/common/Icon';

export default function TabLayout() {
  const totalCount = useCartStore((s) => s.getTotalItemsCount());

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
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
          ...theme.shadows.card,
        },
        tabBarLabelStyle: {
          fontSize: theme.typography.scale.xs - 2,
          fontWeight: theme.typography.weights.extraBold,
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <View style={[styles.iconWrapper, focused && styles.iconActive]}>
              <Icon
                name="store"
                size={20}
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
            <View style={[styles.iconWrapper, focused && styles.iconActive]}>
              <Icon
                name="grid"
                size={20}
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
            <View style={[styles.iconWrapper, focused && styles.iconActive]}>
              <Icon
                name="package"
                size={20}
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
            <View style={[styles.iconWrapper, focused && styles.iconActive]}>
              <Icon
                name="user"
                size={20}
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
  iconActive: {
    backgroundColor: theme.colors.primaryMuted,
    transform: [{ scale: 1.05 }],
  },
});
