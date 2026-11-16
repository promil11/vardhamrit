import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../../theme';

interface PriceTextProps {
  price: number;
  mrp?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSavingsTag?: boolean;
  style?: ViewStyle;
}

export const PriceText: React.FC<PriceTextProps> = ({
  price,
  mrp,
  size = 'md',
  showSavingsTag = false,
  style,
}) => {
  const hasDiscount = mrp && mrp > price;
  const savings = hasDiscount ? mrp - price : 0;

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          price: styles.priceSm,
          mrp: styles.mrpSm,
        };
      case 'lg':
        return {
          price: styles.priceLg,
          mrp: styles.mrpLg,
        };
      case 'xl':
        return {
          price: styles.priceXl,
          mrp: styles.mrpXl,
        };
      case 'md':
      default:
        return {
          price: styles.priceMd,
          mrp: styles.mrpMd,
        };
    }
  };

  const current = getSizeStyles();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.pricesRow}>
        <Text style={[styles.priceBase, current.price]}>₹{price}</Text>
        {hasDiscount ? (
          <Text style={[styles.mrpBase, current.mrp]}>₹{mrp}</Text>
        ) : null}
      </View>

      {showSavingsTag && hasDiscount ? (
        <View style={styles.savingsTag}>
          <Text style={styles.savingsText}>SAVE ₹{savings}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  pricesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.xs,
  },
  priceBase: {
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.weights.extraBold,
  },
  priceSm: {
    fontSize: theme.typography.scale.sm,
  },
  priceMd: {
    fontSize: theme.typography.scale.md,
  },
  priceLg: {
    fontSize: theme.typography.scale.lg,
  },
  priceXl: {
    fontSize: theme.typography.scale.xl,
  },
  mrpBase: {
    color: theme.colors.textHint,
    textDecorationLine: 'line-through',
    fontWeight: theme.typography.weights.medium,
  },
  mrpSm: {
    fontSize: theme.typography.scale.xs - 1,
  },
  mrpMd: {
    fontSize: theme.typography.scale.xs,
  },
  mrpLg: {
    fontSize: theme.typography.scale.sm,
  },
  mrpXl: {
    fontSize: theme.typography.scale.md,
  },
  savingsTag: {
    backgroundColor: theme.colors.accentBerryMuted,
    borderRadius: theme.radius.xs,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 1,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  savingsText: {
    color: theme.colors.accentBerry,
    fontSize: theme.typography.scale.xs - 2,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.4,
  },
});

export default PriceText;
