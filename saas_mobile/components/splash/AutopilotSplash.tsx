import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  AccessibilityInfo,
  Dimensions,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useDerivedValue,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  interpolateColor,
  Easing,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { Image, ImageBackground } from 'react-native';

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════

const BG = '#0B1220';
const INK = '#F7F8FA';
const INK_DIM = '#8A95A8';
const ACCENT = '#F5A524';

const BG_IMAGE = require('../../assets/images/launch-bg.png');
const LOGO_IMAGE = require('../../assets/images/logo.png');

// ═══════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════

/** Indian numbering: 500000 → "5,00,000" */
function formatIndianNumber(num: number): string {
  'worklet';
  const str = Math.floor(num).toString();
  if (str.length <= 3) return str;
  const last3 = str.slice(-3);
  const rest = str.slice(0, -3);
  const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return formatted + ',' + last3;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED SVG SETUP
// ═══════════════════════════════════════════════════════════════════════════

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedSvgText = Animated.createAnimatedComponent(SvgText);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// ═══════════════════════════════════════════════════════════════════════════
// LOGO MARK — filled triangle in the A (animates independently)
// ═══════════════════════════════════════════════════════════════════════════

interface LogoMarkProps {
  color: SharedValue<string>;
}

function LogoMark({ color }: LogoMarkProps) {
  const animatedProps = useAnimatedProps(() => ({
    fill: color.value,
  }));

  return (
    <AnimatedPath animatedProps={animatedProps} d="M4 36 L20 36 L20 4 Z" />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGO LETTERS — A right stroke + crossbar + "UTOPILOT"
// ═══════════════════════════════════════════════════════════════════════════

interface LogoLettersProps {
  opacity: SharedValue<number>;
  translateX: SharedValue<number>;
}

function LogoLetters({ opacity, translateX }: LogoLettersProps) {
  const animatedProps = useAnimatedProps(() => ({
    opacity: opacity.value,
    transform: `translate(${translateX.value}, 0)`,
  }));

  return (
    <AnimatedG animatedProps={animatedProps}>
      <Path
        d="M20 4 L36 36"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M10 22 L28 22"
        stroke={INK}
        strokeWidth={3.5}
        strokeLinecap="round"
        fill="none"
      />
      <SvgText
        x="44"
        y="33"
        fontFamily={FONT_DISP}
        fontWeight="800"
        fontSize="34"
        letterSpacing="3"
        fill={INK}
      >
        UTOPILOT
      </SvgText>
    </AnimatedG>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FULL LOGO — shared SVG coordinate space
// ═══════════════════════════════════════════════════════════════════════════

interface AutopilotLogoProps {
  markColor: SharedValue<string>;
  lettersOpacity: SharedValue<number>;
  lettersTranslateX: SharedValue<number>;
}

function AutopilotLogo({
  markColor,
  lettersOpacity,
  lettersTranslateX,
}: AutopilotLogoProps) {
  return (
    <Svg
      viewBox="0 0 280 40"
      width={280}
      height={40}
      accessibilityRole="image"
      accessibilityLabel="Autopilot"
    >
      <LogoMark color={markColor} />
      <LogoLetters opacity={lettersOpacity} translateX={lettersTranslateX} />
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED COUNTER
// ═══════════════════════════════════════════════════════════════════════════

interface CounterProps {
  value: SharedValue<number>;
  opacity: SharedValue<number>;
  translateY: SharedValue<number>;
}

function Counter({ value, opacity, translateY }: CounterProps) {
  const animatedProps = useAnimatedProps(() => ({
    value: formatIndianNumber(value.value),
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.counterContainer, containerStyle]}>
      <AnimatedTextInput
        animatedProps={animatedProps}
        editable={false}
        caretHidden
        style={styles.counterText}
        accessibilityLabel="500,000 square feet under management"
      />
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SPLASH COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface AutopilotSplashProps {
  onComplete: () => void;
}

export default function AutopilotSplash({ onComplete }: AutopilotSplashProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Phase values
  const markScale = useSharedValue(0);
  const markOpacity = useSharedValue(0);
  const markColorPhase = useSharedValue(0);

  const markColor = useDerivedValue(() =>
    interpolateColor(markColorPhase.value, [0, 1], [ACCENT, INK])
  );

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: markScale.value }],
    opacity: markOpacity.value,
  }));

  const lettersOpacity = useSharedValue(0);
  const lettersTranslateX = useSharedValue(-8);

  const underlineWidth = useSharedValue(0);
  const underlineStyle = useAnimatedStyle(() => ({
    width: underlineWidth.value,
  }));

  const counterOpacity = useSharedValue(0);
  const counterTranslateY = useSharedValue(16);
  const counterValue = useSharedValue(0);

  const captionOpacity = useSharedValue(0);

  const tagline1Opacity = useSharedValue(0);
  const tagline1TranslateY = useSharedValue(6);
  const tagline2Opacity = useSharedValue(0);
  const tagline2TranslateY = useSharedValue(6);

  const containerOpacity = useSharedValue(1);
  const containerScale = useSharedValue(1);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.08);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowOpacity.value,
  }));

  // ═══════════════════════════════════════════════════════════════════════
  // ANIMATION SEQUENCE
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (reduceMotion) {
      containerOpacity.value = withTiming(1, { duration: 300 });
    } else {
      // Phase 1: Mark enters [0 → 600ms]
      markScale.value = withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.back(1.4)),
      });
      markOpacity.value = withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.back(1.4)),
      });
      markColorPhase.value = withDelay(
        500,
        withTiming(1, { duration: 200 })
      );

      // Phase 2: Letters appear [400 → 900ms]
      lettersOpacity.value = withDelay(
        400,
        withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
      );
      lettersTranslateX.value = withDelay(
        400,
        withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) })
      );

      // Phase 2b: Underline draws [900ms]
      underlineWidth.value = withDelay(
        900,
        withTiming(180, { duration: 250, easing: Easing.out(Easing.exp) })
      );

      // Phase 3: Counter + Caption [1000 → 2200ms]
      counterOpacity.value = withDelay(
        1000,
        withTiming(1, { duration: 300 })
      );
      counterTranslateY.value = withDelay(
        1000,
        withTiming(0, { duration: 300 })
      );
      counterValue.value = withDelay(
        1000,
        withTiming(500000, {
          duration: 900,
          easing: Easing.out(Easing.cubic),
        })
      );
      captionOpacity.value = withDelay(
        1200,
        withTiming(1, { duration: 300 })
      );

      // Phase 4: Taglines [1900 → 2500ms]
      tagline1Opacity.value = withDelay(
        1900,
        withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) })
      );
      tagline1TranslateY.value = withDelay(
        1900,
        withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) })
      );
      tagline2Opacity.value = withDelay(
        2050,
        withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) })
      );
      tagline2TranslateY.value = withDelay(
        2050,
        withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) })
      );

      // Ambient glow (continuous)
      glowScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1400 }),
          withTiming(1.0, { duration: 1400 })
        ),
        -1,
        true
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.18, { duration: 1400 }),
          withTiming(0.08, { duration: 1400 })
        ),
        -1,
        true
      );
    }
  }, [reduceMotion]);

  // Manual dismiss handler
  const handleDismiss = () => {
    containerOpacity.value = withTiming(
      0,
      { duration: 500, easing: Easing.in(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) {
          runOnJS(onComplete)();
        }
      }
    );
    containerScale.value = withTiming(
      1.03,
      { duration: 500, easing: Easing.in(Easing.cubic) }
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <ImageBackground source={BG_IMAGE} style={styles.root} resizeMode="cover">
      <Animated.View style={[styles.overlay, containerStyle]}>
        {/* Logo */}
        <Animated.View style={[styles.logoWrap, markStyle]}>
          <Image
            source={LOGO_IMAGE}
            style={styles.logoImage}
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
  logoImage: {
    width: 320,
    height: 120,
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
