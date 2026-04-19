import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

interface PulseDotProps {
  color: string;
}

export default function PulseDot({ color }: PulseDotProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withSpring(0.85, { damping: 10, stiffness: 100 });
    opacity.value = withSpring(0.5, { damping: 10, stiffness: 100 });
    const t1 = setTimeout(() => {
      scale.value = withSpring(1, { damping: 10, stiffness: 100 });
      opacity.value = withSpring(1, { damping: 10, stiffness: 100 });
    }, 800);
    const t2 = setTimeout(() => {
      scale.value = withSpring(0.85, { damping: 10, stiffness: 100 });
      opacity.value = withSpring(0.5, { damping: 10, stiffness: 100 });
    }, 1600);
    const interval = setInterval(() => {
      scale.value = withSpring(0.85, { damping: 10, stiffness: 100 });
      opacity.value = withSpring(0.5, { damping: 10, stiffness: 100 });
      setTimeout(() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 100 });
        opacity.value = withSpring(1, { damping: 10, stiffness: 100 });
      }, 800);
    }, 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(interval);
    };
  }, [scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.statusDotBase,
        {
          backgroundColor: color,
          shadowColor: color,
          shadowOpacity: 1,
          shadowRadius: 6,
          elevation: 4,
        },
        animStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  statusDotBase: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
