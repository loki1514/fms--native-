import React, { useEffect } from 'react';
import {
  Text,
  StyleSheet,
  Image,
  ImageBackground,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const BG_IMAGE = require('../../assets/images/launch-bg.png');
const LOGO_IMAGE = require('../../assets/images/logo.png');

export default function AutopilotSplash({ onComplete }: { onComplete: () => void }) {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.85);

  const containerOpacity = useSharedValue(1);
  const containerScale = useSharedValue(1);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  useEffect(() => {
    // Phase 1: Logo fades + scales in [0 → 700ms]
    logoOpacity.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
    logoScale.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.back(1.2)),
    });


  }, []);

  // Manual dismiss handler
  const handleDismiss = () => {
    containerOpacity.value = withTiming(
      0,
      { duration: 600, easing: Easing.in(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) {
          runOnJS(onComplete)();
        }
      }
    );
    containerScale.value = withTiming(
      1.02,
      { duration: 600, easing: Easing.in(Easing.cubic) }
    );
  };

  return (
    <ImageBackground source={BG_IMAGE} style={styles.root} resizeMode="cover">
      <Animated.View style={[styles.overlay, containerStyle]}>
        {/* Logo */}
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <Image
            source={LOGO_IMAGE}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Autopilot"
          />
        </Animated.View>

        {/* Tap to continue */}
        <Pressable onPress={handleDismiss} style={styles.tapButton}>
          <Text style={styles.tapText}>Tap to continue</Text>
        </Pressable>
      </Animated.View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 480,
    height: 180,
  },
  tapButton: {
    marginTop: 48,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  tapText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
