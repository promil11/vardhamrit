import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../../theme';
import { Icon } from './Icon';

interface RatingChipProps {
  rating: number;
  reviewCount?: number;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const RatingChip: React.FC<RatingChipProps> = ({
  rating,
  reviewCount,
  size = 'sm',
  style,
}) => {
  const isSmall = size === 'sm';

  return (
    <View style={[styles.container, isSmall ? styles.containerSm : styles.containerMd, style]}>
      <View style={styles.badge}>
        <Icon
          name="star"
          size={isSmall ? 10 : 13}
          color={theme.colors.accentGoldDark}
          style={styles.starIcon}
        />
        <Text style={[styles.rating, isSmall ? styles.ratingSm : styles.ratingMd]}>
          {rating.toFixed(1)}
        </Text>
      </View>
      {reviewCount !== undefined ? (
        <Text style={[styles.reviewCount, isSmall ? styles.reviewCountSm : styles.reviewCountMd]}>
          ({reviewCount})
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  containerSm: {
    gap: theme.spacing.xs,
  },
  containerMd: {
    gap: theme.spacing.xs + 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accentGoldMuted,
    borderWidth: 1,
    borderColor: theme.colors.accentGoldBorder,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.xs + 1,
    paddingVertical: 1,
  },
  starIcon: {
    marginRight: 3,
  },
  rating: {
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  ratingSm: {
    fontSize: theme.typography.scale.xs - 1,
  },
  ratingMd: {
    fontSize: theme.typography.scale.xs + 1,
  },
  reviewCount: {
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  reviewCountSm: {
    fontSize: theme.typography.scale.xs - 1,
  },
  reviewCountMd: {
    fontSize: theme.typography.scale.xs,
  },
});

export default RatingChip;
