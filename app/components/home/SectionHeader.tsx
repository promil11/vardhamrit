import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../../theme';
import { Icon, IconName } from '../common/Icon';
import { useResponsive } from '../../utils/responsive';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  iconName?: IconName;
  iconColor?: string;
  badge?: string;
  badgeBg?: string;
  onSeeAllPress?: () => void;
  seeAllText?: string;
  style?: ViewStyle;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  iconName,
  iconColor,
  badge,
  badgeBg,
  onSeeAllPress,
  seeAllText = 'View All',
  style,
}) => {
  const { isTablet, scaleFont } = useResponsive();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.leftCol}>
        <View style={styles.titleRow}>
          {iconName ? (
            <View style={[styles.iconCircle, isTablet && styles.iconCircleTablet]}>
              <Icon
                name={iconName}
                size={isTablet ? 17 : 14}
                color={iconColor || theme.colors.primary}
              />
            </View>
          ) : null}

          <Text
            style={[styles.title, isTablet && { fontSize: scaleFont(17.5) }]}
            numberOfLines={1}
          >
            {title}
          </Text>

          {badge ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: badgeBg || theme.colors.accentBerry },
                isTablet && styles.badgeTablet,
              ]}
            >
              <Text
                style={[styles.badgeText, isTablet && { fontSize: scaleFont(9.5) }]}
              >
                {badge}
              </Text>
            </View>
          ) : null}
        </View>

        {subtitle ? (
          <Text
            style={[styles.subtitle, isTablet && { fontSize: scaleFont(12.5), marginTop: 4 }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {onSeeAllPress ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onSeeAllPress}
          style={[styles.seeAllPill, isTablet && styles.seeAllPillTablet]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text
            style={[styles.seeAllText, isTablet && { fontSize: scaleFont(12.5) }]}
          >
            {seeAllText}
          </Text>
          <Icon name="chevron-right" size={isTablet ? 14 : 12} color={theme.colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    marginBottom: theme.spacing.sm + 2,
  },
  leftCol: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleTablet: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
    letterSpacing: -0.2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  badgeTablet: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
    marginTop: 2,
  },
  seeAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: theme.radius.pill,
    gap: 3,
  },
  seeAllPillTablet: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  seeAllText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
});

export default SectionHeader;
