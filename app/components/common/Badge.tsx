import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { theme } from '../../theme';

export type BadgeVariant = 'discount' | 'express' | 'fresh' | 'gold' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  icon?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  icon,
  style,
  textStyle,
}) => {
  const getBadgeStyles = () => {
    switch (variant) {
      case 'discount':
        return {
          container: styles.discountContainer,
          text: styles.discountText,
        };
      case 'express':
        return {
          container: styles.expressContainer,
          text: styles.expressText,
        };
      case 'fresh':
        return {
          container: styles.freshContainer,
          text: styles.freshText,
        };
      case 'gold':
        return {
          container: styles.goldContainer,
          text: styles.goldText,
        };
      case 'neutral':
      default:
        return {
          container: styles.neutralContainer,
          text: styles.neutralText,
        };
    }
  };

  const current = getBadgeStyles();

  return (
    <View style={[styles.baseBadge, current.container, style]}>
      {icon ? <Text style={styles.iconText}>{icon}</Text> : null}
      <Text style={[styles.baseText, current.text, textStyle]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  baseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs + 1,
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
  },
  baseText: {
    fontSize: theme.typography.scale.xs - 1,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: theme.typography.letterSpacing.badge,
    textTransform: 'uppercase',
  },
  iconText: {
    fontSize: theme.typography.scale.xs - 1,
    marginRight: theme.spacing.xxs,
  },
  discountContainer: {
    backgroundColor: theme.colors.accentBerry,
    borderRadius: theme.radius.xs,
    paddingHorizontal: theme.spacing.xs + 2,
    paddingVertical: theme.spacing.xxs,
  },
  discountText: {
    color: theme.colors.textInverse,
  },
  expressContainer: {
    backgroundColor: theme.colors.accentGoldMuted,
    borderWidth: 1,
    borderColor: theme.colors.accentGoldBorder,
  },
  expressText: {
    color: theme.colors.accentGoldDark,
  },
  freshContainer: {
    backgroundColor: theme.colors.primaryMuted,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
  },
  freshText: {
    color: theme.colors.primary,
  },
  goldContainer: {
    backgroundColor: theme.colors.accentGold,
  },
  goldText: {
    color: theme.colors.textPrimary,
  },
  neutralContainer: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  neutralText: {
    color: theme.colors.textSecondary,
  },
});

export default Badge;
