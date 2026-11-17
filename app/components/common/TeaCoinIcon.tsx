import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Coins } from 'lucide-react-native';

interface TeaCoinIconProps {
  size?: number;
  style?: ViewStyle;
}

export const TeaCoinIcon: React.FC<TeaCoinIconProps> = ({ size = 26, style }) => {
  const iconSize = Math.max(12, Math.round(size * 0.56));
  const ringOffset = size > 24 ? 4 : 2;

  return (
    <LinearGradient
      colors={['#FDE68A', '#F59E0B', '#B45309']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.coinCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.innerRing,
          {
            width: size - ringOffset,
            height: size - ringOffset,
            borderRadius: (size - ringOffset) / 2,
          },
        ]}
      >
        <Coins size={iconSize} color="#78350F" strokeWidth={2.4} />
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  coinCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.25,
    shadowRadius: 2.5,
    elevation: 2,
  },
  innerRing: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    backgroundColor: 'rgba(254, 240, 138, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default TeaCoinIcon;
