import React from 'react';
import {
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'accent' | 'berry';
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const GradientButton: React.FC<GradientButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  icon,
  rightIcon,
  loading = false,
  disabled = false,
  size = 'md',
  fullWidth = true,
  style,
  textStyle,
}) => {
  const getGradientColors = () => {
    switch (variant) {
      case 'accent':
        return theme.colors.accentGoldGradient;
      case 'berry':
        return theme.colors.accentBerryGradient;
      case 'primary':
      default:
        return theme.colors.primaryGradient;
    }
  };

  const handlePress = () => {
    if (disabled || loading) return;
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // Haptics fallback
      }
    }
    onPress();
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          container: styles.containerSm,
          text: styles.textSm,
        };
      case 'lg':
        return {
          container: styles.containerLg,
          text: styles.textLg,
        };
      case 'md':
      default:
        return {
          container: styles.containerMd,
          text: styles.textMd,
        };
    }
  };

  const sizeStyle = getSizeStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        styles.touchable,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
    >
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, sizeStyle.container, fullWidth && styles.fullWidth]}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.textInverse} size="small" />
        ) : (
          <>
            {icon ? <>{icon}</> : null}
            <Text style={[styles.label, sizeStyle.text, textStyle]}>
              {label}
            </Text>
            {rightIcon ? <>{rightIcon}</> : null}
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchable: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.55,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    gap: theme.spacing.sm,
  },
  containerSm: {
    paddingVertical: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.md,
  },
  containerMd: {
    paddingVertical: theme.spacing.md - 1,
    paddingHorizontal: theme.spacing.lg,
  },
  containerLg: {
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.xl,
  },
  label: {
    color: theme.colors.textInverse,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.3,
  },
  textSm: {
    fontSize: theme.typography.scale.xs + 1,
  },
  textMd: {
    fontSize: theme.typography.scale.sm + 1,
  },
  textLg: {
    fontSize: theme.typography.scale.md,
  },
});

export default GradientButton;
