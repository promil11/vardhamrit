import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../../theme';
import { GradientButton } from './GradientButton';
import { Icon, IconName } from './Icon';

interface EmptyStateProps {
  icon?: string;
  iconName?: IconName;
  title: string;
  subtitle: string;
  buttonLabel?: string;
  onButtonPress?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  iconName = 'coffee',
  title,
  subtitle,
  buttonLabel,
  onButtonPress,
  style,
}) => {
  // Map legacy string/emoji if passed
  const resolvedIconName: IconName =
    iconName ||
    (icon === '🛒' || icon === 'cart'
      ? 'shopping-bag'
      : icon === '📦' || icon === 'package'
      ? 'package'
      : icon === '🌱' || icon === 'leaf'
      ? 'leaf'
      : 'coffee');

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <Icon name={resolvedIconName} size={38} color={theme.colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {buttonLabel && onButtonPress ? (
        <GradientButton
          label={buttonLabel}
          onPress={onButtonPress}
          size="md"
          fullWidth={false}
          style={styles.button}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.xl,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: theme.colors.primaryMuted,
    borderWidth: 1.5,
    borderColor: theme.colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.base,
    ...theme.shadows.subtle,
  },
  title: {
    fontSize: theme.typography.scale.lg,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.scale.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeights.sm,
    maxWidth: 280,
    marginBottom: theme.spacing.lg,
  },
  button: {
    minWidth: 160,
  },
});

export default EmptyState;
