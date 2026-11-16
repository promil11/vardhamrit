import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ViewStyle,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import { useCartStore } from '../../store/useCartStore';
import { Product, ProductVariant } from '../../types';

interface AddButtonProps {
  product: Product;
  variant?: ProductVariant;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export const AddButton: React.FC<AddButtonProps> = ({
  product,
  variant,
  size = 'md',
  style,
}) => {
  const targetVariant = variant || product.variants[0];
  const { addItem, incrementQuantity, decrementQuantity, getItemQuantity } = useCartStore();

  const quantity = getItemQuantity(product.id, targetVariant.id);
  const isInCart = quantity > 0;

  // Spring animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Subtle bounce on quantity change
    Animated.sequence([
      Animated.timing(bounceAnim, {
        toValue: 1.15,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(bounceAnim, {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [quantity]);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(style);
      } catch {
        // Haptics fallback
      }
    }
  };

  const handleAdd = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();

    addItem(product, targetVariant);
  };

  const handleIncrement = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    incrementQuantity(product.id, targetVariant.id);
  };

  const handleDecrement = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    decrementQuantity(product.id, targetVariant.id);
  };

  const isSmall = size === 'sm';
  const isLarge = size === 'lg';

  if (!isInCart) {
    return (
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleAdd}
          style={[
            styles.addBtn,
            isSmall && styles.addBtnSm,
            isLarge && styles.addBtnLg,
          ]}
        >
          <Text style={[styles.addText, isSmall && styles.addTextSm, isLarge && styles.addTextLg]}>
            ADD
          </Text>
          <Text style={[styles.plusIcon, isSmall && styles.plusIconSm, isLarge && styles.plusIconLg]}>
            +
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.stepperContainer,
        isSmall && styles.stepperSm,
        isLarge && styles.stepperLg,
        { transform: [{ scale: bounceAnim }] },
        style,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleDecrement}
        style={[styles.stepperActionBtn, isSmall && styles.stepperActionBtnSm]}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={[styles.stepperMinus, isSmall && styles.stepperMinusSm]}>−</Text>
      </TouchableOpacity>

      <Text style={[styles.stepperQty, isSmall && styles.stepperQtySm, isLarge && styles.stepperQtyLg]}>
        {quantity}
      </Text>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleIncrement}
        disabled={quantity >= targetVariant.stock}
        style={[styles.stepperActionBtn, isSmall && styles.stepperActionBtnSm]}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text
          style={[
            styles.stepperPlus,
            isSmall && styles.stepperPlusSm,
            quantity >= targetVariant.stock && styles.disabledAction,
          ]}
        >
          +
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // Inactive ADD state: White card with green border and green text
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    minWidth: 68,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  addBtnSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 56,
  },
  addBtnLg: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm + 1,
    minWidth: 96,
  },
  addText: {
    color: theme.colors.primary,
    fontSize: 11.5,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.5,
  },
  addTextSm: {
    fontSize: 10.5,
  },
  addTextLg: {
    fontSize: theme.typography.scale.sm,
  },
  plusIcon: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: theme.typography.weights.extraBold,
    marginLeft: 3,
  },
  plusIconSm: {
    fontSize: 11,
  },
  plusIconLg: {
    fontSize: theme.typography.scale.md,
  },

  // Active Stepper state: Rich Green pill
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    minWidth: 70,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 3,
  },
  stepperSm: {
    minWidth: 60,
    paddingVertical: 1,
  },
  stepperLg: {
    minWidth: 104,
    paddingVertical: theme.spacing.xs,
  },
  stepperActionBtn: {
    paddingHorizontal: theme.spacing.xs + 2,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperActionBtnSm: {
    paddingHorizontal: theme.spacing.xs,
  },
  stepperMinus: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.scale.sm + 2,
    fontWeight: theme.typography.weights.extraBold,
  },
  stepperMinusSm: {
    fontSize: theme.typography.scale.xs + 1,
  },
  stepperPlus: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.scale.sm + 2,
    fontWeight: theme.typography.weights.extraBold,
  },
  stepperPlusSm: {
    fontSize: theme.typography.scale.xs + 1,
  },
  stepperQty: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.scale.xs + 1,
    fontWeight: theme.typography.weights.extraBold,
    minWidth: 16,
    textAlign: 'center',
  },
  stepperQtySm: {
    fontSize: theme.typography.scale.xs - 1,
  },
  stepperQtyLg: {
    fontSize: theme.typography.scale.sm,
  },
  disabledAction: {
    opacity: 0.35,
  },
});

export default AddButton;
