import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, Image } from 'react-native';
import { theme } from '../../theme';
import { Icon, IconName } from '../common/Icon';
import { getFullImageUrl } from '../../utils/imageUtils';

export interface CategoryItem {
  id: string;
  label: string;
  name?: string;
  tagline?: string;
  imageUrl?: string;
  image?: string;
  iconName?: IconName;
  iconColor?: string;
  gradientColors?: readonly [string, string];
  borderColor?: string;
  shadowColor?: string;
  badge?: string;
  badgeBg?: string;
}

export const CATEGORY_IMAGE_FALLBACKS: Record<string, string> = {
  all: getFullImageUrl('/uploads/products/vardhamrit_4flavour_lineup.png'),
  normal: getFullImageUrl('/uploads/products/classic_200g.png'),
  kadak: getFullImageUrl('/uploads/products/classic_200g.png'),
  masala: getFullImageUrl('/uploads/products/masala_200g.png'),
  keser: getFullImageUrl('/uploads/products/kesar_200g.png'),
  chocolate: getFullImageUrl('/uploads/products/chocolate_200g.png'),
};

interface CategoryTileProps {
  item: CategoryItem;
  isSelected?: boolean;
  onPress: (id: string) => void;
  style?: ViewStyle;
}

export const CategoryTile: React.FC<CategoryTileProps> = ({
  item,
  isSelected = false,
  onPress,
  style,
}) => {
  const [imageError, setImageError] = useState(false);

  const rawUri =
    !imageError &&
    (item.imageUrl ||
      item.image ||
      CATEGORY_IMAGE_FALLBACKS[item.id] ||
      CATEGORY_IMAGE_FALLBACKS['all']);
  const imageUri = rawUri ? getFullImageUrl(rawUri) : null;

  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={() => onPress(item.id)}
      style={[styles.container, style]}
    >
      <View
        style={[
          styles.tileWrapper,
          isSelected ? styles.tileWrapperSelected : styles.tileWrapperUnselected,
        ]}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.realImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={styles.fallbackIconContainer}>
            <Icon
              name={item.iconName || 'coffee'}
              size={24}
              color={theme.colors.primary}
              strokeWidth={2}
            />
          </View>
        )}
      </View>

      {/* Category Name */}
      <Text
        style={[styles.label, isSelected && styles.labelSelected]}
        numberOfLines={2}
      >
        {item.label || item.name}
      </Text>

      {/* Active Underline Pill */}
      {isSelected ? <View style={styles.activePill} /> : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 76,
  },
  tileWrapper: {
    width: 62,
    height: 62,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tileWrapperUnselected: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  tileWrapperSelected: {
    borderWidth: 2.5,
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 4,
    transform: [{ scale: 1.05 }],
  },
  realImage: {
    width: '100%',
    height: '100%',
  },
  fallbackIconContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  label: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: theme.typography.weights.semiBold,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 14,
    minHeight: 28,
  },
  labelSelected: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.extraBold,
  },
  activePill: {
    marginTop: 2,
    width: 20,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.primary,
  },
});

export default CategoryTile;
