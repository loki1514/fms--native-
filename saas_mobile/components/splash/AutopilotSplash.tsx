import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  ImageBackground,
  Image,
  Pressable,
  Text,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

// ═══════════════════════════════════════════════════════════════════════════
// ASSETS
// ═══════════════════════════════════════════════════════════════════════════

const BG_IMAGE = require('../../assets/images/launch-bg.png');
const LOGO_IMAGE = require('../../assets/images/autopilot-logo-new.png');

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface AutopilotSplashProps {
  onComplete: () => void;
  isReady?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SPLASH COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function AutopilotSplash({ onComplete, isReady = true }: AutopilotSplashProps) {
  // ── Animation values ────────────────────────────────────────────────────
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.85);

  const spinnerOpacity = useSharedValue(0);
  const spinnerRotation = useSharedValue(0);

  const containerOpacity = useSharedValue(1);
  const containerScale = useSharedValue(1);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const spinnerStyle = useAnimatedStyle(() => ({
    opacity: spinnerOpacity.value,
    transform: [{ rotate: `${spinnerRotation.value}deg` }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  // ── Animation sequence ──────────────────────────────────────────────────
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

    // Phase 2: Spinner fades in + starts rotating [400ms]
    spinnerOpacity.value = withDelay(
      400,
      withTiming(1, { duration: 400 })
    );
    spinnerRotation.value = withRepeat(
      withSequence(
        withTiming(360, { duration: 1000, easing: Easing.linear })
      ),
      -1,
      false
    );

    // Cleanup: cancel animations if component unmounts early
    return () => {
      // Animation callbacks check `finished` flag, so onComplete won't fire
      // when these shared values are implicitly cancelled on unmount
    };
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

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════

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

        {/* Spinner ring */}
        <Animated.View style={[styles.spinnerWrap, spinnerStyle]}>
          <View style={styles.spinnerRing} />
        </Animated.View>

        {/* Tap to continue */}
        <Pressable onPress={handleDismiss} style={styles.tapButton}>
          <Text style={styles.tapText}>Tap to continue</Text>
        </Pressable>
      </Animated.View>
    </ImageBackground>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

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
    width: 320,
    height: 90,
    tintColor: '#FFFFFF',
  },
  spinnerWrap: {
    marginTop: 32,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    borderTopColor: '#FFFFFF',
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
